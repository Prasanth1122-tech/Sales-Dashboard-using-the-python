import {
  Component,
  ChangeDetectionStrategy,
  inject,
  viewChild,
  ElementRef,
  afterNextRender,
  effect,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { SalesService } from '../services/sales';
import { Chart, registerables, ChartConfiguration } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard-charts',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Section 1: Monthly Sales & Profit Trend -->
      <div class="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 class="text-lg font-bold text-[#14265c] flex items-center gap-2">
              <mat-icon class="text-blue-600">show_chart</mat-icon>
              Monthly Sales & Profit Trend
            </h2>
            <p class="text-xs text-slate-500">Track revenue and net profit trajectory over monthly cycles (click point to drill down)</p>
          </div>
          <div class="flex items-center gap-4 text-xs font-medium">
            <span class="inline-flex items-center gap-1.5 text-blue-600">
              <span class="w-3 h-3 rounded-full bg-[#4f7df3]"></span> Sales
            </span>
            <span class="inline-flex items-center gap-1.5 text-orange-500">
              <span class="w-3 h-3 rounded-full bg-[#f28e2b]"></span> Profit
            </span>
          </div>
        </div>
        <div class="relative h-72 sm:h-80 w-full">
          <canvas #trendCanvas></canvas>
        </div>
      </div>

      <!-- Section 2: Category Donut & Region Performance (2 Columns) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Sales by Category (Donut) -->
        <div class="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col">
          <div class="mb-4">
            <h2 class="text-lg font-bold text-[#14265c] flex items-center gap-2">
              <mat-icon class="text-indigo-600">pie_chart</mat-icon>
              Sales by Category
            </h2>
            <p class="text-xs text-slate-500">Share of revenue across product departments (click slice to filter)</p>
          </div>
          <div class="relative h-72 w-full flex-1 flex items-center justify-center">
            <canvas #categoryDonutCanvas></canvas>
          </div>
        </div>

        <!-- Sales & Profit by Region (Combo Bar + Line) -->
        <div class="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col">
          <div class="mb-4">
            <h2 class="text-lg font-bold text-[#14265c] flex items-center gap-2">
              <mat-icon class="text-emerald-600">public</mat-icon>
              Sales & Profit by Region
            </h2>
            <p class="text-xs text-slate-500">Geographic market comparison with margin overlay (click bar to filter)</p>
          </div>
          <div class="relative h-72 w-full flex-1">
            <canvas #regionCanvas></canvas>
          </div>
        </div>
      </div>

      <!-- Section 3: Profit by Category & Top Products (2 Columns) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Profit by Category -->
        <div class="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col">
          <div class="mb-4">
            <h2 class="text-lg font-bold text-[#14265c] flex items-center gap-2">
              <mat-icon class="text-teal-600">bar_chart</mat-icon>
              Profit by Category
            </h2>
            <p class="text-xs text-slate-500">Net operating profit contribution by category</p>
          </div>
          <div class="relative h-72 w-full flex-1">
            <canvas #categoryProfitCanvas></canvas>
          </div>
        </div>

        <!-- Top 10 Products by Sales -->
        <div class="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col">
          <div class="mb-4">
            <h2 class="text-lg font-bold text-[#14265c] flex items-center gap-2">
              <mat-icon class="text-amber-600">leaderboard</mat-icon>
              Top 10 Products by Sales
            </h2>
            <p class="text-xs text-slate-500">Highest grossing product lines (click bar to filter)</p>
          </div>
          <div class="relative h-72 w-full flex-1">
            <canvas #topProductsCanvas></canvas>
          </div>
        </div>
      </div>

      <!-- Section 4: Sales vs Profit Scatter Analysis -->
      <div class="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 class="text-lg font-bold text-[#14265c] flex items-center gap-2">
              <mat-icon class="text-purple-600">scatter_plot</mat-icon>
              Sales vs. Profit Distribution
            </h2>
            <p class="text-xs text-slate-500">
              Quantity (X-axis) vs. Sales (Y-axis), bubble size proportional to Profit volume
            </p>
          </div>
          <div class="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
            Tip: Hover over points to examine transaction details
          </div>
        </div>
        <div class="relative h-80 sm:h-96 w-full">
          <canvas #scatterCanvas></canvas>
        </div>
      </div>
    </div>
  `
})
export class DashboardCharts implements OnDestroy {
  readonly salesService = inject(SalesService);

  readonly trendCanvas = viewChild<ElementRef<HTMLCanvasElement>>('trendCanvas');
  readonly categoryDonutCanvas = viewChild<ElementRef<HTMLCanvasElement>>('categoryDonutCanvas');
  readonly regionCanvas = viewChild<ElementRef<HTMLCanvasElement>>('regionCanvas');
  readonly categoryProfitCanvas = viewChild<ElementRef<HTMLCanvasElement>>('categoryProfitCanvas');
  readonly topProductsCanvas = viewChild<ElementRef<HTMLCanvasElement>>('topProductsCanvas');
  readonly scatterCanvas = viewChild<ElementRef<HTMLCanvasElement>>('scatterCanvas');

  private trendChart?: Chart;
  private categoryDonutChart?: Chart;
  private regionChart?: Chart;
  private categoryProfitChart?: Chart;
  private topProductsChart?: Chart;
  private scatterChart?: Chart;

  private isRendered = false;

  constructor() {
    afterNextRender(() => {
      this.isRendered = true;
      this.initCharts();
    });

    effect(() => {
      // Track signals to update charts reactively
      const trend = this.salesService.monthlyTrend();
      const catSales = this.salesService.categorySales();
      const reg = this.salesService.regionPerformance();
      const catProfit = this.salesService.categoryProfit();
      const topProd = this.salesService.topProducts();
      const scatter = this.salesService.scatterData();
      const cf = this.salesService.chartFilter();

      if (this.isRendered) {
        this.updateCharts(trend, catSales, reg, catProfit, topProd, scatter, cf);
      }
    });
  }

  private initCharts(): void {
    this.initTrendChart();
    this.initCategoryDonutChart();
    this.initRegionChart();
    this.initCategoryProfitChart();
    this.initTopProductsChart();
    this.initScatterChart();

    // Trigger initial data render
    this.updateCharts(
      this.salesService.monthlyTrend(),
      this.salesService.categorySales(),
      this.salesService.regionPerformance(),
      this.salesService.categoryProfit(),
      this.salesService.topProducts(),
      this.salesService.scatterData(),
      this.salesService.chartFilter()
    );
  }

  private initTrendChart(): void {
    const canvas = this.trendCanvas()?.nativeElement;
    if (!canvas) return;

    this.trendChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Sales',
            data: [],
            borderColor: '#4f7df3',
            backgroundColor: 'rgba(79, 125, 243, 0.1)',
            borderWidth: 2.5,
            pointBackgroundColor: '#4f7df3',
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.3,
            fill: true
          },
          {
            label: 'Profit',
            data: [],
            borderColor: '#f28e2b',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointBackgroundColor: '#f28e2b',
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.3,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#14265c',
            titleColor: '#ffffff',
            bodyColor: '#e2e8f0',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: $${Number(ctx.parsed.y).toLocaleString()}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { size: 11 } }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#64748b',
              font: { size: 11 },
              callback: (val) => `$${Number(val).toLocaleString()}`
            }
          }
        },
        onClick: (_, elements) => {
          if (!elements.length) return;
          const index = elements[0].index;
          const trend = this.salesService.monthlyTrend();
          if (trend[index]) {
            this.salesService.setChartFilter({
              dimension: 'Month',
              value: trend[index].month
            });
          }
        }
      }
    });
  }

  private initCategoryDonutChart(): void {
    const canvas = this.categoryDonutCanvas()?.nativeElement;
    if (!canvas) return;

    const colors = ['#4f7df3', '#f28e2b', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4'];

    this.categoryDonutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 14,
              color: '#475569',
              font: { size: 12 }
            }
          },
          tooltip: {
            backgroundColor: '#14265c',
            titleColor: '#ffffff',
            bodyColor: '#e2e8f0',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const current = Number(ctx.raw);
                const pct = total > 0 ? ((current / total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: $${current.toLocaleString()} (${pct}%)`;
              }
            }
          }
        },
        onClick: (_, elements) => {
          if (!elements.length) return;
          const index = elements[0].index;
          const catSales = this.salesService.categorySales();
          if (catSales[index]) {
            this.salesService.setChartFilter({
              dimension: 'Category',
              value: catSales[index].category
            });
          }
        }
      }
    });
  }

  private initRegionChart(): void {
    const canvas = this.regionCanvas()?.nativeElement;
    if (!canvas) return;

    this.regionChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            type: 'bar',
            label: 'Sales',
            data: [],
            backgroundColor: '#4f7df3',
            borderRadius: 6,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: 'Profit',
            data: [],
            borderColor: '#f28e2b',
            backgroundColor: '#f28e2b',
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 7,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, color: '#475569', font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: '#14265c',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: $${Number(ctx.raw).toLocaleString()}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b' }
          },
          y: {
            type: 'linear',
            position: 'left',
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#64748b',
              callback: (v) => `$${Number(v).toLocaleString()}`
            }
          },
          y1: {
            type: 'linear',
            position: 'right',
            grid: { display: false },
            ticks: {
              color: '#f28e2b',
              callback: (v) => `$${Number(v).toLocaleString()}`
            }
          }
        },
        onClick: (_, elements) => {
          if (!elements.length) return;
          const index = elements[0].index;
          const regions = this.salesService.regionPerformance();
          if (regions[index]) {
            this.salesService.setChartFilter({
              dimension: 'Region',
              value: regions[index].region
            });
          }
        }
      }
    });
  }

  private initCategoryProfitChart(): void {
    const canvas = this.categoryProfitCanvas()?.nativeElement;
    if (!canvas) return;

    this.categoryProfitChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Profit',
            data: [],
            backgroundColor: '#10b981',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#14265c',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ` Profit: $${Number(ctx.raw).toLocaleString()}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b' }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#64748b',
              callback: (v) => `$${Number(v).toLocaleString()}`
            }
          }
        },
        onClick: (_, elements) => {
          if (!elements.length) return;
          const index = elements[0].index;
          const catProfit = this.salesService.categoryProfit();
          if (catProfit[index]) {
            this.salesService.setChartFilter({
              dimension: 'Category',
              value: catProfit[index].category
            });
          }
        }
      }
    });
  }

  private initTopProductsChart(): void {
    const canvas = this.topProductsCanvas()?.nativeElement;
    if (!canvas) return;

    this.topProductsChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Sales',
            data: [],
            backgroundColor: '#3b82f6',
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#14265c',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ` Sales: $${Number(ctx.raw).toLocaleString()}`
            }
          }
        },
        scales: {
          y: {
            grid: { display: false },
            ticks: { color: '#334155', font: { size: 11, weight: 'bold' } }
          },
          x: {
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#64748b',
              callback: (v) => `$${Number(v).toLocaleString()}`
            }
          }
        },
        onClick: (_, elements) => {
          if (!elements.length) return;
          const index = elements[0].index;
          const topProd = this.salesService.topProducts();
          if (topProd[index]) {
            this.salesService.setChartFilter({
              dimension: 'Product',
              value: topProd[index].product
            });
          }
        }
      }
    });
  }

  private initScatterChart(): void {
    const canvas = this.scatterCanvas()?.nativeElement;
    if (!canvas) return;

    this.scatterChart = new Chart(canvas, {
      type: 'bubble',
      data: {
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, color: '#475569', font: { size: 12 } }
          },
          tooltip: {
            backgroundColor: '#14265c',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              title: (items) => {
                if (!items.length) return '';
                const raw = items[0].raw as any;
                return raw.product || 'Item';
              },
              label: (ctx) => {
                const raw = ctx.raw as any;
                return [
                  ` Category: ${raw.category}`,
                  ` Region: ${raw.region}`,
                  ` Quantity: ${raw.x}`,
                  ` Sales: $${raw.y.toLocaleString()}`,
                  ` Profit: $${raw.profit.toLocaleString()}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Quantity Sold (Units)', color: '#475569', font: { weight: 'bold' } },
            grid: { color: '#f1f5f9' },
            ticks: { color: '#64748b' }
          },
          y: {
            title: { display: true, text: 'Sales Revenue ($)', color: '#475569', font: { weight: 'bold' } },
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#64748b',
              callback: (v) => `$${Number(v).toLocaleString()}`
            }
          }
        },
        onClick: (_, elements) => {
          if (!elements.length) return;
          const elem = elements[0];
          const ds = this.scatterChart?.data.datasets[elem.datasetIndex];
          if (ds && ds.data[elem.index]) {
            const raw = ds.data[elem.index] as any;
            if (raw.category) {
              this.salesService.setChartFilter({
                dimension: 'Category',
                value: raw.category
              });
            }
          }
        }
      }
    });
  }

  private updateCharts(
    trend: any[],
    catSales: any[],
    reg: any[],
    catProfit: any[],
    topProd: any[],
    scatter: any[],
    cf: any
  ): void {
    // 1. Trend Chart
    if (this.trendChart) {
      this.trendChart.data.labels = trend.map(t => t.label);
      this.trendChart.data.datasets[0].data = trend.map(t => t.sales);
      this.trendChart.data.datasets[1].data = trend.map(t => t.profit);
      this.trendChart.update();
    }

    // 2. Category Donut
    if (this.categoryDonutChart) {
      this.categoryDonutChart.data.labels = catSales.map(c => c.category);
      this.categoryDonutChart.data.datasets[0].data = catSales.map(c => c.sales);
      this.categoryDonutChart.update();
    }

    // 3. Region Combo
    if (this.regionChart) {
      this.regionChart.data.labels = reg.map(r => r.region);
      this.regionChart.data.datasets[0].data = reg.map(r => r.sales);
      this.regionChart.data.datasets[1].data = reg.map(r => r.profit);
      this.regionChart.update();
    }

    // 4. Category Profit
    if (this.categoryProfitChart) {
      this.categoryProfitChart.data.labels = catProfit.map(c => c.category);
      this.categoryProfitChart.data.datasets[0].data = catProfit.map(c => c.profit);
      this.categoryProfitChart.update();
    }

    // 5. Top Products (reverse to show highest at the top)
    if (this.topProductsChart) {
      const reversed = [...topProd].reverse();
      this.topProductsChart.data.labels = reversed.map(p => p.product);
      this.topProductsChart.data.datasets[0].data = reversed.map(p => p.sales);
      this.topProductsChart.update();
    }

    // 6. Scatter Chart Grouped by Category
    if (this.scatterChart) {
      const catMap = new Map<string, any[]>();
      const colors = ['#4f7df3', '#f28e2b', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4'];

      for (const item of scatter) {
        const cat = item.category || 'Other';
        if (!catMap.has(cat)) {
          catMap.set(cat, []);
        }
        catMap.get(cat)!.push({
          x: item.quantity,
          y: item.sales,
          r: item.bubbleSize,
          product: item.product,
          category: item.category,
          region: item.region,
          profit: item.profit,
          date: item.date
        });
      }

      const datasets = Array.from(catMap.entries()).map(([cat, points], i) => {
        const color = colors[i % colors.length];
        return {
          label: cat,
          data: points,
          backgroundColor: color + '99', // with transparency
          borderColor: color,
          borderWidth: 1.5,
          hoverBorderWidth: 2
        };
      });

      this.scatterChart.data.datasets = datasets;
      this.scatterChart.update();
    }
  }

  ngOnDestroy(): void {
    this.trendChart?.destroy();
    this.categoryDonutChart?.destroy();
    this.regionChart?.destroy();
    this.categoryProfitChart?.destroy();
    this.topProductsChart?.destroy();
    this.scatterChart?.destroy();
  }
}
