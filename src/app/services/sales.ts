import { Injectable, signal, computed } from '@angular/core';
import { SAMPLE_SALES_DATA, SaleRecord } from '../data/sample-sales';
import * as XLSX from 'xlsx';

export interface ChartFilter {
  dimension: 'Category' | 'Region' | 'Product' | 'Month' | 'Date';
  value: string;
}

export interface SheetParseResult {
  sheetName: string;
  rowCount: number;
  skipped: boolean;
  missingColumns?: string[];
}

export interface UploadFeedback {
  type: 'success' | 'warning' | 'error';
  message: string;
  sheets?: SheetParseResult[];
}

const REQUIRED_COLUMNS = ['Date', 'Product', 'Category', 'Region', 'Sales', 'Quantity', 'Profit'];

const COLUMN_ALIASES: Record<string, string> = {
  'Order Date': 'Date',
  'OrderDate': 'Date',
  'order_date': 'Date',
  'Product Name': 'Product',
  'Product_Name': 'Product',
  'product_name': 'Product',
  'Sub-Category': 'Category',
  'Sub Category': 'Category',
  'sub_category': 'Category',
  'Region Name': 'Region',
  'region_name': 'Region',
  'Amount': 'Sales',
  'Revenue': 'Sales',
  'revenue': 'Sales',
  'Units': 'Quantity',
  'Qty': 'Quantity',
  'qty': 'Quantity',
  'Cost Profit': 'Profit',
  'cost_profit': 'Profit',
};

@Injectable({
  providedIn: 'root'
})
export class SalesService {
  // Raw records
  private readonly rawData = signal<SaleRecord[]>(SAMPLE_SALES_DATA);
  readonly datasetName = signal<string>('Default Sample Dataset');
  readonly isSampleData = signal<boolean>(true);
  readonly uploadFeedback = signal<UploadFeedback | null>(null);

  // Filters
  readonly startDate = signal<string>('2026-01-01');
  readonly endDate = signal<string>('2026-12-31');
  readonly selectedRegions = signal<string[]>([]);
  readonly selectedCategories = signal<string[]>([]);
  readonly selectedProducts = signal<string[]>([]);
  readonly chartFilter = signal<ChartFilter | null>(null);

  // Distinct options from raw data
  readonly allRegions = computed(() => {
    const list = Array.from(new Set(this.rawData().map(d => d.Region))).filter(Boolean).sort();
    return list;
  });

  readonly allCategories = computed(() => {
    const list = Array.from(new Set(this.rawData().map(d => d.Category))).filter(Boolean).sort();
    return list;
  });

  readonly allProducts = computed(() => {
    const list = Array.from(new Set(this.rawData().map(d => d.Product))).filter(Boolean).sort();
    return list;
  });

  readonly minDataDate = computed(() => {
    const dates = this.rawData().map(d => d.Date).filter(Boolean);
    if (!dates.length) return '2026-01-01';
    return dates.reduce((min, cur) => cur < min ? cur : min, dates[0]);
  });

  readonly maxDataDate = computed(() => {
    const dates = this.rawData().map(d => d.Date).filter(Boolean);
    if (!dates.length) return '2026-12-31';
    return dates.reduce((max, cur) => cur > max ? cur : max, dates[0]);
  });

  constructor() {
    this.resetFiltersToAll();
  }

  resetFiltersToAll(): void {
    const data = this.rawData();
    const dates = data.map(d => d.Date).filter(Boolean);
    const minD = dates.length ? dates.reduce((m, c) => c < m ? c : m, dates[0]) : '2026-01-01';
    const maxD = dates.length ? dates.reduce((m, c) => c > m ? c : m, dates[0]) : '2026-12-31';

    this.startDate.set(minD);
    this.endDate.set(maxD);
    this.selectedRegions.set([...this.allRegions()]);
    this.selectedCategories.set([...this.allCategories()]);
    this.selectedProducts.set([...this.allProducts()]);
    this.chartFilter.set(null);
  }

  clearChartFilter(): void {
    this.chartFilter.set(null);
  }

  setChartFilter(filter: ChartFilter): void {
    const cur = this.chartFilter();
    if (cur && cur.dimension === filter.dimension && cur.value === filter.value) {
      this.chartFilter.set(null);
    } else {
      this.chartFilter.set(filter);
    }
  }

  loadSampleData(): void {
    this.rawData.set(SAMPLE_SALES_DATA);
    this.datasetName.set('Default Sample Dataset');
    this.isSampleData.set(true);
    this.uploadFeedback.set(null);
    this.resetFiltersToAll();
  }

  // Filtered dataset
  readonly filteredData = computed<SaleRecord[]>(() => {
    const data = this.rawData();
    const start = this.startDate();
    const end = this.endDate();
    const regions = new Set(this.selectedRegions());
    const categories = new Set(this.selectedCategories());
    const products = new Set(this.selectedProducts());
    const cf = this.chartFilter();

    return data.filter(item => {
      // Date filter
      if (start && item.Date < start) return false;
      if (end && item.Date > end) return false;

      // Dropdown filters
      if (regions.size > 0 && !regions.has(item.Region)) return false;
      if (categories.size > 0 && !categories.has(item.Category)) return false;
      if (products.size > 0 && !products.has(item.Product)) return false;

      // Cross-chart interactive filter
      if (cf) {
        if (cf.dimension === 'Category' && item.Category !== cf.value) return false;
        if (cf.dimension === 'Region' && item.Region !== cf.value) return false;
        if (cf.dimension === 'Product' && item.Product !== cf.value) return false;
        if (cf.dimension === 'Month') {
          const itemMonth = item.Date.substring(0, 7); // YYYY-MM
          if (itemMonth !== cf.value) return false;
        }
        if (cf.dimension === 'Date' && item.Date !== cf.value) return false;
      }

      return true;
    });
  });

  // KPI Metrics
  readonly kpis = computed(() => {
    const list = this.filteredData();
    const totalOrders = list.length;
    let totalSales = 0;
    let totalProfit = 0;
    let totalQuantity = 0;

    for (const r of list) {
      totalSales += r.Sales;
      totalProfit += r.Profit;
      totalQuantity += r.Quantity;
    }

    const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    return {
      totalSales: Math.round(totalSales * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalOrders,
      totalQuantity,
      profitMargin: Math.round(profitMargin * 10) / 10,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    };
  });

  // Monthly Sales Trend
  readonly monthlyTrend = computed(() => {
    const list = this.filteredData();
    const map = new Map<string, { sales: number; profit: number; count: number }>();

    for (const r of list) {
      const month = r.Date.substring(0, 7); // YYYY-MM
      if (!month) continue;
      const cur = map.get(month) || { sales: 0, profit: 0, count: 0 };
      cur.sales += r.Sales;
      cur.profit += r.Profit;
      cur.count += 1;
      map.set(month, cur);
    }

    const sortedMonths = Array.from(map.keys()).sort();
    return sortedMonths.map(month => {
      const val = map.get(month)!;
      // Convert "2026-03" to readable "Mar 2026"
      const [year, m] = month.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${monthNames[parseInt(m, 10) - 1] || m} ${year}`;

      return {
        month,
        label,
        sales: Math.round(val.sales * 100) / 100,
        profit: Math.round(val.profit * 100) / 100,
        count: val.count,
      };
    });
  });

  // Category Sales (Donut)
  readonly categorySales = computed(() => {
    const list = this.filteredData();
    const map = new Map<string, number>();
    let total = 0;

    for (const r of list) {
      const cat = r.Category || 'Other';
      map.set(cat, (map.get(cat) || 0) + r.Sales);
      total += r.Sales;
    }

    return Array.from(map.entries())
      .map(([category, sales]) => ({
        category,
        sales: Math.round(sales * 100) / 100,
        percentage: total > 0 ? Math.round((sales / total) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.sales - a.sales);
  });

  // Sales & Profit by Region
  readonly regionPerformance = computed(() => {
    const list = this.filteredData();
    const map = new Map<string, { sales: number; profit: number }>();

    for (const r of list) {
      const reg = r.Region || 'Unknown';
      const cur = map.get(reg) || { sales: 0, profit: 0 };
      cur.sales += r.Sales;
      cur.profit += r.Profit;
      map.set(reg, cur);
    }

    return Array.from(map.entries())
      .map(([region, val]) => ({
        region,
        sales: Math.round(val.sales * 100) / 100,
        profit: Math.round(val.profit * 100) / 100,
      }))
      .sort((a, b) => b.sales - a.sales);
  });

  // Profit by Category
  readonly categoryProfit = computed(() => {
    const list = this.filteredData();
    const map = new Map<string, number>();

    for (const r of list) {
      const cat = r.Category || 'Other';
      map.set(cat, (map.get(cat) || 0) + r.Profit);
    }

    return Array.from(map.entries())
      .map(([category, profit]) => ({
        category,
        profit: Math.round(profit * 100) / 100
      }))
      .sort((a, b) => b.profit - a.profit);
  });

  // Top 10 Products by Sales
  readonly topProducts = computed(() => {
    const list = this.filteredData();
    const map = new Map<string, { sales: number; quantity: number }>();

    for (const r of list) {
      const prod = r.Product || 'Unknown';
      const cur = map.get(prod) || { sales: 0, quantity: 0 };
      cur.sales += r.Sales;
      cur.quantity += r.Quantity;
      map.set(prod, cur);
    }

    return Array.from(map.entries())
      .map(([product, val]) => ({
        product,
        sales: Math.round(val.sales * 100) / 100,
        quantity: val.quantity
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);
  });

  // Scatter Data (Quantity vs Sales, sized by profit)
  readonly scatterData = computed(() => {
    const list = this.filteredData();
    // Cap at 150 points for chart performance if large dataset
    const sample = list.slice(0, 150);
    return sample.map(item => ({
      product: item.Product,
      category: item.Category,
      region: item.Region,
      date: item.Date,
      quantity: item.Quantity,
      sales: item.Sales,
      profit: item.Profit,
      bubbleSize: Math.max(4, Math.min(22, Math.sqrt(Math.abs(item.Profit)) * 1.5))
    }));
  });

  // Excel / CSV File Parsing
  async parseAndLoadFile(file: File): Promise<void> {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      
      const parsedRecords: SaleRecord[] = [];
      const sheetsFeedback: SheetParseResult[] = [];

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) continue;

        // Convert sheet to json rows
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
        if (!rawRows.length) {
          sheetsFeedback.push({ sheetName, rowCount: 0, skipped: true });
          continue;
        }

        // Clean columns and match aliases
        const cleanedRows: SaleRecord[] = [];
        let missingCols: string[] = [];

        for (const rawRow of rawRows) {
          const rowNorm: Record<string, unknown> = {};
          for (const key of Object.keys(rawRow)) {
            const trimmed = key.trim();
            const alias = COLUMN_ALIASES[trimmed] || trimmed;
            rowNorm[alias] = rawRow[key];
          }

          // Check required columns once on first row
          if (cleanedRows.length === 0) {
            missingCols = REQUIRED_COLUMNS.filter(c => !(c in rowNorm));
            if (missingCols.length > 0) {
              break;
            }
          }

          // Parse values
          const rawDate = rowNorm['Date'];
          let dateStr = '';
          if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
            dateStr = rawDate.toISOString().substring(0, 10);
          } else if (typeof rawDate === 'number') {
            // Excel serial date
            const dateObj = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
            dateStr = !isNaN(dateObj.getTime()) ? dateObj.toISOString().substring(0, 10) : String(rawDate);
          } else {
            const parsed = new Date(String(rawDate));
            dateStr = !isNaN(parsed.getTime()) ? parsed.toISOString().substring(0, 10) : String(rawDate);
          }

          const sales = Number(rowNorm['Sales']);
          const quantity = Number(rowNorm['Quantity']);
          const profit = Number(rowNorm['Profit']);

          if (!dateStr || isNaN(sales) || isNaN(quantity) || isNaN(profit)) {
            continue;
          }

          cleanedRows.push({
            Date: dateStr,
            Product: String(rowNorm['Product'] || 'Unknown').trim(),
            Category: String(rowNorm['Category'] || 'Unknown').trim(),
            Region: String(rowNorm['Region'] || 'Unknown').trim(),
            Sales: Math.round(sales * 100) / 100,
            Quantity: Math.round(quantity),
            Profit: Math.round(profit * 100) / 100,
          });
        }

        if (missingCols.length > 0) {
          sheetsFeedback.push({
            sheetName,
            rowCount: 0,
            skipped: true,
            missingColumns: missingCols
          });
        } else if (cleanedRows.length > 0) {
          sheetsFeedback.push({
            sheetName,
            rowCount: cleanedRows.length,
            skipped: false
          });
          parsedRecords.push(...cleanedRows);
        }
      }

      if (parsedRecords.length === 0) {
        this.uploadFeedback.set({
          type: 'error',
          message: 'No valid sales records found in workbook. Ensure required columns exist: Date, Product, Category, Region, Sales, Quantity, Profit.',
          sheets: sheetsFeedback
        });
        return;
      }

      this.rawData.set(parsedRecords);
      this.datasetName.set(file.name);
      this.isSampleData.set(false);
      this.resetFiltersToAll();

      const skippedCount = sheetsFeedback.filter(s => s.skipped).length;
      if (skippedCount > 0) {
        this.uploadFeedback.set({
          type: 'warning',
          message: `Loaded ${parsedRecords.length.toLocaleString()} records from ${file.name}. (${skippedCount} worksheet(s) skipped without sales columns).`,
          sheets: sheetsFeedback
        });
      } else {
        this.uploadFeedback.set({
          type: 'success',
          message: `Successfully loaded ${parsedRecords.length.toLocaleString()} sales records from ${file.name}.`,
          sheets: sheetsFeedback
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown parsing error';
      this.uploadFeedback.set({
        type: 'error',
        message: `Failed to parse file: ${msg}`
      });
    }
  }

  // Download filtered data as CSV
  downloadFilteredCsv(): void {
    const list = this.filteredData();
    if (!list.length) return;

    const headers = ['Date', 'Product', 'Category', 'Region', 'Sales', 'Quantity', 'Profit'];
    const rows = list.map(item => [
      item.Date,
      `"${item.Product.replace(/"/g, '""')}"`,
      `"${item.Category.replace(/"/g, '""')}"`,
      `"${item.Region.replace(/"/g, '""')}"`,
      item.Sales,
      item.Quantity,
      item.Profit
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `filtered_sales_data_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
