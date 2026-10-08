import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { SalesService } from '../services/sales';
import { SaleRecord } from '../data/sample-sales';

type SortField = keyof SaleRecord;
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-data-table',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <!-- Table Header & Controls -->
      <div class="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-bold text-[#14265c] flex items-center gap-2">
            <mat-icon class="text-blue-600">table_chart</mat-icon>
            Recent Sales Transactions
          </h2>
          <p class="text-xs text-slate-500">
            Showing {{ displayedRecords().length }} of {{ salesService.filteredData().length }} matching records
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <!-- Quick search -->
          <div class="relative w-full sm:w-56">
            <input
              type="text"
              [formControl]="searchControl"
              placeholder="Search transactions..."
              class="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-hidden text-slate-800"
            />
            <mat-icon class="absolute left-2.5 top-2 text-slate-400 text-sm">search</mat-icon>
          </div>

          <!-- Download CSV -->
          <button
            type="button"
            (click)="salesService.downloadFilteredCsv()"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
            title="Download current filtered data as CSV">
            <mat-icon class="text-sm">download</mat-icon>
            Export CSV
          </button>
        </div>
      </div>

      <!-- Table Container -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-700">
          <thead class="bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th scope="col" (click)="setSort('Date')" class="py-3 px-4 cursor-pointer hover:text-blue-600 select-none">
                <div class="flex items-center gap-1">
                  <span>Date</span>
                  <mat-icon class="text-xs">{{ getSortIcon('Date') }}</mat-icon>
                </div>
              </th>
              <th scope="col" (click)="setSort('Product')" class="py-3 px-4 cursor-pointer hover:text-blue-600 select-none">
                <div class="flex items-center gap-1">
                  <span>Product</span>
                  <mat-icon class="text-xs">{{ getSortIcon('Product') }}</mat-icon>
                </div>
              </th>
              <th scope="col" (click)="setSort('Category')" class="py-3 px-4 cursor-pointer hover:text-blue-600 select-none">
                <div class="flex items-center gap-1">
                  <span>Category</span>
                  <mat-icon class="text-xs">{{ getSortIcon('Category') }}</mat-icon>
                </div>
              </th>
              <th scope="col" (click)="setSort('Region')" class="py-3 px-4 cursor-pointer hover:text-blue-600 select-none">
                <div class="flex items-center gap-1">
                  <span>Region</span>
                  <mat-icon class="text-xs">{{ getSortIcon('Region') }}</mat-icon>
                </div>
              </th>
              <th scope="col" (click)="setSort('Sales')" class="py-3 px-4 text-right cursor-pointer hover:text-blue-600 select-none">
                <div class="flex items-center justify-end gap-1">
                  <span>Sales</span>
                  <mat-icon class="text-xs">{{ getSortIcon('Sales') }}</mat-icon>
                </div>
              </th>
              <th scope="col" (click)="setSort('Quantity')" class="py-3 px-4 text-right cursor-pointer hover:text-blue-600 select-none">
                <div class="flex items-center justify-end gap-1">
                  <span>Qty</span>
                  <mat-icon class="text-xs">{{ getSortIcon('Quantity') }}</mat-icon>
                </div>
              </th>
              <th scope="col" (click)="setSort('Profit')" class="py-3 px-4 text-right cursor-pointer hover:text-blue-600 select-none">
                <div class="flex items-center justify-end gap-1">
                  <span>Profit</span>
                  <mat-icon class="text-xs">{{ getSortIcon('Profit') }}</mat-icon>
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (row of paginatedRecords(); track $index) {
              <tr class="hover:bg-slate-50/60 transition-colors">
                <td class="py-3 px-4 font-mono text-slate-600">{{ row.Date }}</td>
                <td class="py-3 px-4 font-semibold text-slate-900">{{ row.Product }}</td>
                <td class="py-3 px-4">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                    {{ row.Category }}
                  </span>
                </td>
                <td class="py-3 px-4 text-slate-600">{{ row.Region }}</td>
                <td class="py-3 px-4 text-right font-medium text-slate-900">{{ formatCurrency(row.Sales) }}</td>
                <td class="py-3 px-4 text-right text-slate-600">{{ row.Quantity }}</td>
                <td class="py-3 px-4 text-right font-semibold" [class.text-emerald-600]="row.Profit >= 0" [class.text-rose-600]="row.Profit < 0">
                  {{ formatCurrency(row.Profit) }}
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="py-8 text-center text-slate-400">
                  No records match the current filter criteria
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div class="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div class="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            [value]="pageSize()"
            (change)="onPageSizeChange($event)"
            class="text-xs px-2 py-1 rounded-md border border-slate-200 bg-white">
            <option [value]="10">10</option>
            <option [value]="15">15</option>
            <option [value]="25">25</option>
            <option [value]="50">50</option>
          </select>
          <span class="text-slate-400">|</span>
          <span>
            Page {{ currentPage() }} of {{ totalPages() || 1 }}
          </span>
        </div>

        <div class="flex items-center gap-1.5">
          <button
            type="button"
            (click)="goToPage(currentPage() - 1)"
            [disabled]="currentPage() <= 1"
            class="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
            <mat-icon class="text-sm">chevron_left</mat-icon>
          </button>
          <button
            type="button"
            (click)="goToPage(currentPage() + 1)"
            [disabled]="currentPage() >= totalPages()"
            class="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
            <mat-icon class="text-sm">chevron_right</mat-icon>
          </button>
        </div>
      </div>
    </div>
  `
})
export class DataTable {
  readonly salesService = inject(SalesService);

  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly searchQuery = signal<string>('');

  readonly sortField = signal<SortField>('Date');
  readonly sortDirection = signal<SortDirection>('desc');

  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(15);

  constructor() {
    this.searchControl.valueChanges.subscribe(val => {
      this.searchQuery.set(val || '');
      this.currentPage.set(1);
    });
  }

  readonly displayedRecords = computed(() => {
    let list = [...this.salesService.filteredData()];
    const query = this.searchQuery().toLowerCase().trim();

    if (query) {
      list = list.filter(r =>
        r.Product.toLowerCase().includes(query) ||
        r.Category.toLowerCase().includes(query) ||
        r.Region.toLowerCase().includes(query) ||
        r.Date.includes(query)
      );
    }

    const field = this.sortField();
    const dir = this.sortDirection() === 'asc' ? 1 : -1;

    list.sort((a, b) => {
      const valA = a[field];
      const valB = b[field];
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });

    return list;
  });

  readonly totalPages = computed(() => {
    return Math.ceil(this.displayedRecords().length / this.pageSize()) || 1;
  });

  readonly paginatedRecords = computed(() => {
    const list = this.displayedRecords();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  setSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('desc');
    }
  }

  getSortIcon(field: SortField): string {
    if (this.sortField() !== field) return 'unfold_more';
    return this.sortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  onPageSizeChange(event: Event): void {
    const val = Number((event.target as HTMLSelectElement).value);
    this.pageSize.set(val || 15);
    this.currentPage.set(1);
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(val);
  }
}
