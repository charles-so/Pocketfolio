import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { PortfolioResponse, HoldingDto, PortfolioHistoryResponse } from '../../core/models/portfolio.model';
import { ToastService } from '../../shared/components/toast/toast.service';
import { AudCurrencyPipe } from '../../shared/pipes/currency-aud.pipe';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, AudCurrencyPipe],
  template: `
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-slate-800">Portfolio</h2>
        <button class="btn btn-primary btn-sm" (click)="refreshPrices()" [disabled]="refreshing">
          @if (refreshing) {
            <span class="spinner-border spinner-border-sm me-1"></span> Refreshing...
          } @else {
            <i class="bi bi-arrow-clockwise me-1"></i> Refresh Prices
          }
        </button>
      </div>

      @if (portfolio) {
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-4 text-center">
            <div class="text-xs text-slate-500 uppercase tracking-wide">Portfolio Value</div>
            <div class="text-xl font-bold mt-1">{{ portfolio.totalValue | aud:2 }}</div>
          </div>
          <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-4 text-center">
            <div class="text-xs text-slate-500 uppercase tracking-wide">Cost Basis</div>
            <div class="text-xl font-bold mt-1">{{ portfolio.totalCost | aud:2 }}</div>
          </div>
          <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-4 text-center">
            <div class="text-xs text-slate-500 uppercase tracking-wide">Daily Change</div>
            <div class="text-xl font-bold mt-1"
              [class.text-ok]="portfolio.dailyChange >= 0"
              [class.text-over]="portfolio.dailyChange < 0">
              {{ portfolio.dailyChange >= 0 ? '+' : '-' }}{{ absVal(portfolio.dailyChange) | aud:2 }}
              <span class="text-sm">({{ portfolio.dailyChangePct >= 0 ? '+' : '' }}{{ portfolio.dailyChangePct.toFixed(2) }}%)</span>
            </div>
          </div>
          <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-4 text-center">
            <div class="text-xs text-slate-500 uppercase tracking-wide">Total Change</div>
            <div class="text-xl font-bold mt-1"
              [class.text-ok]="portfolio.totalValue - portfolio.totalCost >= 0"
              [class.text-over]="portfolio.totalValue - portfolio.totalCost < 0">
              {{ portfolio.totalValue - portfolio.totalCost >= 0 ? '+' : '-' }}{{ absVal(portfolio.totalValue - portfolio.totalCost) | aud:2 }}
            </div>
          </div>
        </div>
      }

      <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-6">
        <div class="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">Holdings</div>
        <div class="overflow-x-auto">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Ticker</th>
                <th>Name</th>
                <th class="text-end">Shares</th>
                <th class="text-end">Avg Cost</th>
                <th class="text-end">Price</th>
                <th class="text-end">Market Value</th>
                <th class="text-end">Daily Change</th>
              </tr>
            </thead>
            <tbody>
              @if (portfolio && portfolio.holdings.length > 0) {
                @for (h of portfolio.holdings; track h.id) {
                  <tr>
                    <td><span class="badge bg-primary">{{ h.ticker }}</span></td>
                    <td>{{ h.name }}</td>
                    <td class="text-end">{{ h.shares | number:'1.0-4' }}</td>
                    <td class="text-end">{{ avgCost(h) | aud:2 }}</td>
                    <td class="text-end">{{ h.price | aud:2 }}</td>
                    <td class="text-end">{{ marketValue(h) | aud:2 }}</td>
                    <td class="text-end"
                      [class.text-ok]="h.dailyChange >= 0"
                      [class.text-over]="h.dailyChange < 0">
                      {{ h.dailyChange >= 0 ? '+' : '-' }}{{ absVal(h.dailyChange) | aud:2 }}
                      <span class="text-xs text-slate-500">({{ h.dailyChangePct >= 0 ? '+' : '' }}{{ h.dailyChangePct.toFixed(2) }}%)</span>
                    </td>
                  </tr>
                }
              } @else {
                <tr>
                  <td colspan="7" class="text-center text-slate-400 py-8">No holdings found</td>
                </tr>
              }
            </tbody>

          </table>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-6">
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <span class="font-semibold text-slate-800">Portfolio Growth</span>
          <div class="btn-group btn-group-sm">
            @for (p of chartPeriods; track p.value) {
              <button class="btn"
                [class.btn-primary]="selectedPeriod === p.value"
                [class.btn-outline-primary]="selectedPeriod !== p.value"
                (click)="changePeriod(p.value)">
                {{ p.label }}
              </button>
            }
          </div>
        </div>
        <div class="p-4">
          <canvas #chartCanvas height="300"></canvas>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class PortfolioComponent implements OnInit, OnDestroy {
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;

  portfolio: PortfolioResponse | null = null;

  refreshing = false;
  // Chart
  chart: Chart | null = null;
  chartPeriods = [
    { label: '1M', value: '1mo' },
    { label: '3M', value: '3mo' },
    { label: '6M', value: '6mo' },
    { label: '1Y', value: '1y' },
  ];
  selectedPeriod = '6mo';

  constructor(
    private apiService: ApiService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadPortfolio(false);
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  loadPortfolio(refresh: boolean): void {
    this.apiService.getPortfolio(refresh).subscribe({
      next: (res) => {
        this.portfolio = res;
        this.refreshing = false;
        this.loadChart();
      },
      error: () => {
        this.toast.error('Failed to load portfolio');
        this.refreshing = false;
      }
    });
  }

  refreshPrices(): void {
    this.refreshing = true;
    this.loadPortfolio(true);
  }

  // Holding calculations
  avgCost(h: HoldingDto): number {
    return h.shares !== 0 ? h.costBasis / h.shares : 0;
  }

  marketValue(h: HoldingDto): number {
    return h.shares * h.price;
  }

  absVal(n: number): number {
    return Math.abs(n);
  }

  // Chart
  loadChart(): void {
    this.apiService.getPortfolioHistory(this.selectedPeriod).subscribe({
      next: (res) => {
        this.renderChart(res);
      },
      error: () => {
        this.toast.error('Failed to load portfolio history');
      }
    });
  }

  changePeriod(period: string): void {
    this.selectedPeriod = period;
    this.loadChart();
  }

  renderChart(data: PortfolioHistoryResponse): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    if (!this.chartCanvas) return;

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = data.history.map(h => {
      const d = new Date(h.date);
      return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    });
    const values = data.history.map(h => h.value);

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(13, 110, 253, 0.15)');
    gradient.addColorStop(1, 'rgba(13, 110, 253, 0.01)');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Portfolio Value',
          data: values,
          borderColor: '#0d6efd',
          backgroundColor: gradient,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHitRadius: 10,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed.y;
                return `$${val.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxTicksLimit: 8,
              font: { size: 11 }
            }
          },
          y: {
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              callback: (value) => `$${Number(value).toLocaleString('en-AU')}`,
              font: { size: 11 }
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false,
        }
      }
    });
  }

}
