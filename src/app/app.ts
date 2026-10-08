import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { SalesService } from './services/sales';
import { KpiCards } from './components/kpi-cards';
import { DashboardCharts } from './components/charts';
import { Filters } from './components/filters';
import { DataTable } from './components/data-table';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    MatIconModule,
    KpiCards,
    DashboardCharts,
    Filters,
    DataTable
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gradient-to-br from-[#f4f7fb] to-[#eaf0f8] text-slate-800">
      <!-- Top Navigation Bar -->
      <header class="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <!-- Branding -->
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-sm">
                <mat-icon class="text-2xl">analytics</mat-icon>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h1 class="text-xl sm:text-2xl font-black text-[#14265c] tracking-tight">
                    Sales Dashboard
                  </h1>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    Live
                  </span>
                </div>
                <p class="text-xs text-slate-500 font-normal">
                  Upload your Excel sales data and explore interactive business insights
                </p>
              </div>
            </div>

            <!-- Actions Bar -->
            <div class="flex flex-wrap items-center gap-2.5">
              <!-- Upload Excel input -->
              <label class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#14265c] hover:bg-[#1f377d] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer">
                <mat-icon class="text-sm">upload_file</mat-icon>
                <span>Upload Excel</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  (change)="onFileSelected($event)"
                  class="hidden"
                />
              </label>

              <!-- Reset to Sample Dataset -->
              @if (!salesService.isSampleData()) {
                <button
                  type="button"
                  (click)="salesService.loadSampleData()"
                  class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  title="Switch back to default demo dataset">
                  <mat-icon class="text-sm text-slate-500">history</mat-icon>
                  Load Sample
                </button>
              }

              <!-- Export CSV -->
              <button
                type="button"
                (click)="salesService.downloadFilteredCsv()"
                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer">
                <mat-icon class="text-sm text-slate-500">file_download</mat-icon>
                Export CSV
              </button>

              <!-- Mobile Filters Toggle -->
              <button
                type="button"
                (click)="toggleMobileFilters()"
                class="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer">
                <mat-icon class="text-sm">filter_list</mat-icon>
                Filters
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Layout -->
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <!-- Active Dataset Banner & Notification -->
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3 bg-white/70 backdrop-blur-xs px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-600">
          <div class="flex items-center gap-2">
            <mat-icon class="text-sm text-blue-600">database</mat-icon>
            <span class="font-medium text-slate-700">Dataset:</span>
            <span class="font-semibold text-[#14265c]">{{ salesService.datasetName() }}</span>
            <span class="text-slate-400">•</span>
            <span>{{ salesService.filteredData().length }} matching records</span>
          </div>

          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium border border-emerald-200">
              <mat-icon class="text-xs">check_circle</mat-icon>
              Columns Verified: Date, Product, Category, Region, Sales, Quantity, Profit
            </span>
          </div>
        </div>

        <!-- Upload Feedback Banner -->
        @if (salesService.uploadFeedback(); as fb) {
          <div
            class="mb-6 p-4 rounded-xl border text-xs flex items-start justify-between gap-3"
            [class.bg-emerald-50]="fb.type === 'success'"
            [class.border-emerald-200]="fb.type === 'success'"
            [class.text-emerald-800]="fb.type === 'success'"
            [class.bg-amber-50]="fb.type === 'warning'"
            [class.border-amber-200]="fb.type === 'warning'"
            [class.text-amber-800]="fb.type === 'warning'"
            [class.bg-rose-50]="fb.type === 'error'"
            [class.border-rose-200]="fb.type === 'error'"
            [class.text-rose-800]="fb.type === 'error'">
            <div class="flex items-start gap-2.5">
              <mat-icon class="text-base mt-0.5">
                {{ fb.type === 'success' ? 'check_circle' : fb.type === 'warning' ? 'warning' : 'error' }}
              </mat-icon>
              <div>
                <p class="font-bold">{{ fb.message }}</p>
                @if (fb.sheets && fb.sheets.length > 0) {
                  <ul class="mt-1 list-disc list-inside space-y-0.5 text-[11px] opacity-90">
                    @for (s of fb.sheets; track s.sheetName) {
                      <li>
                        Sheet "{{ s.sheetName }}":
                        @if (s.skipped) {
                          <span class="font-medium text-rose-600">Skipped (missing columns: {{ s.missingColumns?.join(', ') || 'no rows' }})</span>
                        } @else {
                          <span class="font-medium text-emerald-600">Loaded {{ s.rowCount }} rows</span>
                        }
                      </li>
                    }
                  </ul>
                }
              </div>
            </div>
            <button
              type="button"
              (click)="salesService.uploadFeedback.set(null)"
              class="text-slate-400 hover:text-slate-600 cursor-pointer">
              <mat-icon class="text-sm">close</mat-icon>
            </button>
          </div>
        }

        <!-- Interactive Cross-Filter / Drill-down Active Banner -->
        @if (salesService.chartFilter(); as cf) {
          <div class="mb-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-3.5 rounded-2xl shadow-sm flex items-center justify-between gap-3 animate-fade-in">
            <div class="flex items-center gap-2.5 text-xs sm:text-sm font-medium">
              <span class="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                <mat-icon class="text-base text-white">filter_alt</mat-icon>
              </span>
              <span>
                Cross-filtering active:
                <strong class="underline decoration-white/40 underline-offset-2">{{ cf.dimension }} = {{ cf.value }}</strong>
              </span>
            </div>
            <button
              type="button"
              (click)="salesService.clearChartFilter()"
              class="inline-flex items-center gap-1 px-3 py-1 bg-white text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs">
              <mat-icon class="text-xs">close</mat-icon>
              Clear Drill-Down
            </button>
          </div>
        }

        <!-- 2 Column Responsive Layout: Sidebar Filters + Main Dashboard -->
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          <!-- Left Sidebar Filter Column -->
          <aside [class.hidden]="!showMobileFilters()" class="lg:block lg:col-span-1 sticky top-20 z-10">
            <app-filters></app-filters>
          </aside>

          <!-- Right Content Column: KPI Cards, Charts, Table -->
          <div class="lg:col-span-3 space-y-6">
            <!-- 4 KPI Summary Cards -->
            <app-kpi-cards></app-kpi-cards>

            <!-- 6 Interactive Visualizations -->
            <app-dashboard-charts></app-dashboard-charts>

            <!-- Recent Sales Data Table -->
            <app-data-table></app-data-table>
          </div>
        </div>
      </main>

      <!-- Footer -->
      <footer class="mt-12 py-6 border-t border-slate-200/80 bg-white/50 text-center text-xs text-slate-500">
        <p>Sales Analytics Dashboard • Interactive data visualization built with Angular 21, TypeScript & Chart.js</p>
      </footer>
    </div>
  `
})
export class App {
  readonly salesService = inject(SalesService);
  readonly showMobileFilters = signal<boolean>(false);

  toggleMobileFilters(): void {
    this.showMobileFilters.update(v => !v);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.salesService.parseAndLoadFile(file);
      input.value = ''; // Reset input to allow re-uploading same file
    }
  }
}
