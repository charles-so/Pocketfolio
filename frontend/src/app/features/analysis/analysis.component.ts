import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AnalysisResponse } from '../../core/models/analysis.model';
import { AudCurrencyPipe } from '../../shared/pipes/currency-aud.pipe';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const COLORS = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, AudCurrencyPipe],
  template: `
    <!-- Time Range Selector -->
    <div class="flex items-center justify-between mb-4">

      <select class="form-select form-select-sm" style="width:180px"
              [(ngModel)]="selectedPeriods" (ngModelChange)="loadAnalysis()">
        <option [ngValue]="3">Last 3 periods</option>
        <option [ngValue]="6">Last 6 periods</option>
        <option [ngValue]="12">Last 12 periods</option>
        <option [ngValue]="0">All time</option>
      </select>
    </div>

    <!-- Summary Panels -->
    @if (data) {
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-4">
        <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Spending Summary</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div class="text-xs text-slate-400">Total Expenses</div>
            <div class="text-lg font-bold text-slate-800">{{ data.totalSpent | aud }}</div>
          </div>
          <div>
            <div class="text-xs text-slate-400">This Period</div>
            <div class="text-lg font-bold text-slate-800">{{ data.thisPeriodSpent | aud }}</div>
          </div>
          <div>
            <div class="text-xs text-slate-400">Last Period</div>
            <div class="text-lg font-bold text-slate-800">{{ data.lastPeriodSpent | aud }}</div>
          </div>
          <div>
            <div class="text-xs text-slate-400">Avg / Fortnight</div>
            <div class="text-lg font-bold text-slate-800">{{ data.avgPerPeriod | aud }}</div>
          </div>
          <div>
            <div class="text-xs text-slate-400">Transactions</div>
            <div class="text-lg font-bold text-slate-800">{{ data.transactionCount | number }}</div>
          </div>
          <div>
            <div class="text-xs text-slate-400">Avg / Year</div>
            <div class="text-lg font-bold text-slate-800">{{ data.avgPerPeriod * 26 | aud }}</div>
          </div>
          <div>
            <div class="text-xs text-slate-400">Periods</div>
            <div class="text-lg font-bold text-slate-800">{{ data.trend.length }} <span class="text-xs text-slate-400">({{ (data.trend.length / 26).toFixed(1) }} yrs)</span></div>
          </div>
          <div>
            <div class="text-xs text-slate-400">Uninvested Cash</div>
            <div class="text-lg font-bold text-slate-800">{{ uninvestedCash | aud }}</div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-4">
        <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Income Summary</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div class="text-xs text-slate-400">Total Income</div>
            <div class="text-lg font-bold text-ok">{{ data.totalIncome | aud }}</div>
          </div>
          <div>
            <div class="text-xs text-slate-400">Income This Period</div>
            <div class="text-lg font-bold text-ok">{{ data.thisPeriodIncome | aud }}</div>
          </div>
          <div>
            <div class="text-xs text-slate-400">Income Last Period</div>
            <div class="text-lg font-bold text-ok">{{ data.lastPeriodIncome | aud }}</div>
          </div>
          <div>
            <div class="text-xs text-slate-400">Avg Income / fn</div>
            <div class="text-lg font-bold text-ok">{{ data.avgIncomePerPeriod | aud }}</div>
          </div>
          <div>
            <div class="text-xs text-slate-400">Avg Income / Year</div>
            <div class="text-lg font-bold text-ok">{{ data.avgIncomePerPeriod * 26 | aud }}</div>
          </div>
          <div>
            <div class="text-xs text-slate-400">Net (Income - Spent)</div>
            <div class="text-lg font-bold"
                 [class.text-ok]="data.totalIncome - data.totalSpent >= 0"
                 [class.text-over]="data.totalIncome - data.totalSpent < 0">
              {{ data.totalIncome - data.totalSpent | aud }}
            </div>
          </div>
          <div>
            <div class="text-xs text-slate-400">Net / Year</div>
            <div class="text-lg font-bold"
                 [class.text-ok]="data.totalIncome - data.totalSpent >= 0"
                 [class.text-over]="data.totalIncome - data.totalSpent < 0">
              {{ (data.avgIncomePerPeriod - data.avgPerPeriod) * 26 | aud }}
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Charts Row 1: Spending -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div class="bg-white rounded-xl shadow-sm border border-slate-100">
        <div class="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">Spending by Group</div>
        <div class="p-4 chart-container">
          <canvas id="groupChart"></canvas>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-slate-100">
        <div class="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">Spending Trend</div>
        <div class="p-4 chart-container">
          <canvas id="trendChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Charts Row 2: Income -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div class="bg-white rounded-xl shadow-sm border border-slate-100">
        <div class="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">Income vs Spending Trend</div>
        <div class="p-4 chart-container">
          <canvas id="incomeVsSpendingChart"></canvas>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-slate-100">
        <div class="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">Income by Type</div>
        <div class="p-4 chart-container">
          <canvas id="incomeTypeChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Charts Row 3: Envelopes -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div class="bg-white rounded-xl shadow-sm border border-slate-100">
        <div class="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">Top 10 Envelopes</div>
        <div class="p-4 chart-container">
          <canvas id="envChart"></canvas>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-slate-100">
        <div class="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">Budget vs Actual</div>
        <div class="p-0" style="max-height:350px;overflow-y:auto">
          <table class="table table-sm table-hover mb-0">
            <thead class="table-light" style="position:sticky;top:0">
              <tr>
                <th>Envelope</th>
                <th class="text-end" style="width:90px">Budget</th>
                <th class="text-end" style="width:90px">Actual</th>
                <th class="text-end" style="width:90px">Variance</th>
              </tr>
            </thead>
            <tbody>
              @if (data) {
                @for (row of data.budgetVsActual; track row.name) {
                  <tr>
                    <td>
                      <small class="text-muted">{{ row.group }}</small>
                      {{ row.name }}
                    </td>
                    <td class="text-end">{{ row.budget | aud }}</td>
                    <td class="text-end">{{ row.actual | aud }}</td>
                    <td class="text-end"
                        [class.text-budget-ok]="row.budget - row.actual >= 0"
                        [class.text-budget-over]="row.budget - row.actual < 0">
                      {{ formatVariance(row.budget - row.actual) }}
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class AnalysisComponent implements OnInit, OnDestroy {
  data: AnalysisResponse | null = null;
  selectedPeriods = 6;
  uninvestedCash = 0;

  private groupChart: Chart | null = null;
  private trendChart: Chart | null = null;
  private envChart: Chart | null = null;
  private incomeVsSpendingChart: Chart | null = null;
  private incomeTypeChart: Chart | null = null;

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadAnalysis();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  loadAnalysis(): void {
    this.apiService.getAnalysis(this.selectedPeriods).subscribe({
      next: (data) => {
        this.data = data;
        const inv = data.investmentSummary || [];
        this.uninvestedCash = inv.reduce((sum, i) => sum + i.cash, 0);
        // Allow Angular to render the canvases before building charts
        setTimeout(() => this.buildCharts(data), 0);
      },
    });
  }

  formatVariance(v: number): string {
    const rounded = Math.round(v);
    const formatted = Math.abs(rounded).toLocaleString('en-AU');
    if (rounded >= 0) return '+$' + formatted;
    return '-$' + formatted;
  }

  private destroyCharts(): void {
    if (this.groupChart) { this.groupChart.destroy(); this.groupChart = null; }
    if (this.trendChart) { this.trendChart.destroy(); this.trendChart = null; }
    if (this.envChart) { this.envChart.destroy(); this.envChart = null; }
    if (this.incomeVsSpendingChart) { this.incomeVsSpendingChart.destroy(); this.incomeVsSpendingChart = null; }
    if (this.incomeTypeChart) { this.incomeTypeChart.destroy(); this.incomeTypeChart = null; }
  }

  private buildCharts(d: AnalysisResponse): void {
    this.destroyCharts();

    // Spending by Group - vertical bar chart
    const groupCanvas = document.getElementById('groupChart') as HTMLCanvasElement;
    if (groupCanvas) {
      const groupCtx = groupCanvas.getContext('2d');
      if (groupCtx) {
        this.groupChart = new Chart(groupCtx, {
          type: 'bar',
          data: {
            labels: d.byGroup.map(g => g.groupName),
            datasets: [{
              data: d.byGroup.map(g => g.total),
              backgroundColor: COLORS,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { callback: (v) => '$' + v },
              },
            },
          },
        });
      }
    }

    // Spending Trend - line chart with fill
    const trendCanvas = document.getElementById('trendChart') as HTMLCanvasElement;
    if (trendCanvas) {
      const trendCtx = trendCanvas.getContext('2d');
      if (trendCtx) {
        this.trendChart = new Chart(trendCtx, {
          type: 'line',
          data: {
            labels: d.trend.map(t => t.label),
            datasets: [{
              label: 'Spending',
              data: d.trend.map(t => t.total),
              borderColor: '#4e79a7',
              backgroundColor: 'rgba(78,121,167,0.1)',
              fill: true,
              tension: 0.3,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { callback: (v) => '$' + v },
              },
            },
          },
        });
      }
    }

    // Income vs Spending Trend
    const ivsCanvas = document.getElementById('incomeVsSpendingChart') as HTMLCanvasElement;
    if (ivsCanvas) {
      const ivsCtx = ivsCanvas.getContext('2d');
      if (ivsCtx) {
        this.incomeVsSpendingChart = new Chart(ivsCtx, {
          type: 'line',
          data: {
            labels: d.trend.map(t => t.label),
            datasets: [
              {
                label: 'Income',
                data: d.incomeTrend.map(t => t.total),
                borderColor: '#59a14f',
                backgroundColor: 'rgba(89,161,79,0.1)',
                fill: true,
                tension: 0.3,
              },
              {
                label: 'Spending',
                data: d.trend.map(t => t.total),
                borderColor: '#e15759',
                backgroundColor: 'rgba(225,87,89,0.1)',
                fill: true,
                tension: 0.3,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                ticks: { callback: (v) => '$' + v },
              },
            },
          },
        });
      }
    }

    // Income by Type
    const itCanvas = document.getElementById('incomeTypeChart') as HTMLCanvasElement;
    if (itCanvas) {
      const itCtx = itCanvas.getContext('2d');
      if (itCtx) {
        this.incomeTypeChart = new Chart(itCtx, {
          type: 'bar',
          data: {
            labels: d.incomeByType.map(t => t.type),
            datasets: [{
              data: d.incomeByType.map(t => t.total),
              backgroundColor: ['#59a14f', '#4e79a7', '#f28e2b', '#76b7b2'],
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { callback: (v) => '$' + v },
              },
            },
          },
        });
      }
    }

    // Top 10 Envelopes
    const envCanvas = document.getElementById('envChart') as HTMLCanvasElement;
    if (envCanvas) {
      const envCtx = envCanvas.getContext('2d');
      if (envCtx) {
        this.envChart = new Chart(envCtx, {
          type: 'bar',
          data: {
            labels: d.topEnvelopes.map(e => e.name),
            datasets: [{
              data: d.topEnvelopes.map(e => e.total),
              backgroundColor: COLORS,
            }],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: {
                beginAtZero: true,
                ticks: { callback: (v) => '$' + v },
              },
            },
          },
        });
      }
    }
  }
}
