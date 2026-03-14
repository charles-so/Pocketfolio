import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WatchlistResponse, WatchlistTickerDto, TickerDetailsDto } from '../../core/models/watchlist.model';
import { PortfolioHistoryResponse } from '../../core/models/portfolio.model';
import { ToastService } from '../../shared/components/toast/toast.service';
import { AudCurrencyPipe } from '../../shared/pipes/currency-aud.pipe';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [CommonModule, FormsModule, AudCurrencyPipe],
  template: `
    <div>
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-slate-800">Watchlist</h2>
        <button class="btn btn-primary" (click)="refreshPrices()" [disabled]="refreshing">
          @if (refreshing) {
            <span class="spinner-border spinner-border-sm me-1"></span> Refreshing...
          } @else {
            &#x21bb; Refresh Prices
          }
        </button>
      </div>

      <!-- Add Ticker Search -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 mb-6">
        <div class="p-6">
          <div class="flex items-end gap-4">
            <div class="flex-1">
              <label class="form-label font-semibold">Add Ticker to Watchlist</label>
              <div class="position-relative">
                <input type="text" class="form-control"
                  placeholder="Search by ticker or company name..."
                  [(ngModel)]="searchQuery"
                  (ngModelChange)="onSearchChange($event)"
                  (focus)="showDropdown = searchResults.length > 0"
                  (keydown.escape)="showDropdown = false">
                @if (showDropdown && searchResults.length > 0) {
                  <div class="dropdown-menu show w-100" style="max-height: 250px; overflow-y: auto;">
                    @for (r of searchResults; track r.ticker) {
                      <button class="dropdown-item d-flex justify-content-between align-items-center"
                        (mousedown)="addTicker(r)">
                        <div>
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 mr-2">{{ r.ticker }}</span>
                          <span>{{ r.name }}</span>
                        </div>
                        <span class="text-slate-500 text-sm">{{ r.exchange }}</span>
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Watchlist Table -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 mb-6">
        <div class="px-6 py-4 border-b border-slate-100">
          <h3 class="font-semibold text-slate-800">Market Watch</h3>
        </div>
        <div class="p-0">
          <div class="table-responsive">
            <table class="w-full text-sm">
              <thead class="bg-slate-50">
                <tr>
                  <th class="px-4 py-3">Ticker</th>
                  <th class="px-4 py-3">Name</th>
                  <th class="px-4 py-3 text-end">Price</th>
                  <th class="px-4 py-3 text-end">Daily Change</th>
                  <th class="px-4 py-3 text-center">Source</th>
                  <th class="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                @if (watchlist && watchlist.tickers.length > 0) {
                  @for (t of watchlist.tickers; track t.ticker) {
                    <tr>
                      <td class="px-4 py-2.5"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{{ t.ticker }}</span></td>
                      <td class="px-4 py-2.5">{{ t.name }}</td>
                      <td class="px-4 py-2.5 text-end">{{ t.price | aud:2 }}</td>
                      <td class="px-4 py-2.5 text-end"
                        [class.text-success]="t.dailyChange >= 0"
                        [class.text-danger]="t.dailyChange < 0">
                        {{ t.dailyChange >= 0 ? '+' : '-' }}{{ absVal(t.dailyChange) | aud:2 }}
                        <span class="text-slate-500 text-sm">({{ t.dailyChangePct >= 0 ? '+' : '' }}{{ t.dailyChangePct.toFixed(2) }}%)</span>
                      </td>
                      <td class="px-4 py-2.5 text-center">
                        @if (t.isHolding) {
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Portfolio</span>
                        } @else {
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">Watching</span>
                        }
                      </td>
                      <td class="px-4 py-2.5 text-center whitespace-nowrap">
                        <button class="btn btn-sm btn-outline-primary"
                          (click)="toggleChart(t)"
                          [class.active]="chartTicker === t.ticker"
                          title="Chart">
                          Chart
                        </button>
                        <button class="btn btn-sm btn-outline-danger ms-1"
                          (click)="removeTicker(t)"
                          title="Remove">
                          &#x2715;
                        </button>
                      </td>
                    </tr>
                  }
                } @else {
                  <tr>
                    <td colspan="6" class="text-center text-slate-500 py-6">
                      @if (loading) {
                        <span class="spinner-border spinner-border-sm me-1"></span> Loading watchlist...
                      } @else {
                        No tickers in watchlist. Add some above or they will appear automatically from your portfolio.
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Per-ticker Price Chart -->
      @if (chartTicker) {
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 mb-6">
          <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 class="font-semibold text-slate-800">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 mr-2">{{ chartTicker }}</span> Price History
            </h3>
            <div class="flex items-center gap-2">
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
              <button class="btn btn-sm btn-outline-secondary" (click)="closeChart()">
                &#x2715;
              </button>
            </div>
          </div>
          <div class="p-6">
            @if (chartLoading) {
              <div class="text-center py-5">
                <span class="spinner-border"></span>
              </div>
            } @else {
              <canvas #chartCanvas height="300"></canvas>
            }
          </div>
        </div>

        <!-- Ticker Details Panel -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 mb-6">
          <div class="px-6 py-4 border-b border-slate-100">
            <h3 class="font-semibold text-slate-800">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 mr-2">{{ chartTicker }}</span> Details
            </h3>
          </div>
          <div class="p-6">
            @if (detailsLoading) {
              <div class="text-center py-4">
                <span class="spinner-border spinner-border-sm"></span> Loading details...
              </div>
            } @else if (tickerDetails) {
              <h4 class="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Performance</h4>
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <div class="bg-slate-50 rounded-lg h-full">
                    <div class="p-3 text-center">
                      <div class="text-slate-500 text-xs">Week</div>
                      <div class="text-lg font-bold"
                        [class.text-success]="tickerDetails.weekChangePct >= 0"
                        [class.text-danger]="tickerDetails.weekChangePct < 0">
                        {{ tickerDetails.weekChangePct >= 0 ? '+' : '' }}{{ tickerDetails.weekChangePct.toFixed(2) }}%
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div class="bg-slate-50 rounded-lg h-full">
                    <div class="p-3 text-center">
                      <div class="text-slate-500 text-xs">Month</div>
                      <div class="text-lg font-bold"
                        [class.text-success]="tickerDetails.monthChangePct >= 0"
                        [class.text-danger]="tickerDetails.monthChangePct < 0">
                        {{ tickerDetails.monthChangePct >= 0 ? '+' : '' }}{{ tickerDetails.monthChangePct.toFixed(2) }}%
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div class="bg-slate-50 rounded-lg h-full">
                    <div class="p-3 text-center">
                      <div class="text-slate-500 text-xs">YTD</div>
                      <div class="text-lg font-bold"
                        [class.text-success]="tickerDetails.ytdChangePct >= 0"
                        [class.text-danger]="tickerDetails.ytdChangePct < 0">
                        {{ tickerDetails.ytdChangePct >= 0 ? '+' : '' }}{{ tickerDetails.ytdChangePct.toFixed(2) }}%
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div class="bg-slate-50 rounded-lg h-full">
                    <div class="p-3 text-center">
                      <div class="text-slate-500 text-xs">1 Year</div>
                      <div class="text-lg font-bold"
                        [class.text-success]="tickerDetails.yearChangePct >= 0"
                        [class.text-danger]="tickerDetails.yearChangePct < 0">
                        {{ tickerDetails.yearChangePct >= 0 ? '+' : '' }}{{ tickerDetails.yearChangePct.toFixed(2) }}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <h4 class="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Fundamentals</h4>
              <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <div class="bg-slate-50 rounded-lg h-full">
                    <div class="p-3 text-center">
                      <div class="text-slate-500 text-xs">Dividend Yield</div>
                      <div class="text-lg font-bold">
                        {{ tickerDetails.dividendYield != null ? tickerDetails.dividendYield.toFixed(2) + '%' : 'N/A' }}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div class="bg-slate-50 rounded-lg h-full">
                    <div class="p-3 text-center">
                      <div class="text-slate-500 text-xs">P/E Ratio</div>
                      <div class="text-lg font-bold">
                        {{ tickerDetails.trailingPE != null ? tickerDetails.trailingPE.toFixed(2) : 'N/A' }}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div class="bg-slate-50 rounded-lg h-full">
                    <div class="p-3 text-center">
                      <div class="text-slate-500 text-xs">Market Cap</div>
                      <div class="text-lg font-bold">
                        {{ formatMarketCap(tickerDetails.marketCap) }}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div class="bg-slate-50 rounded-lg h-full">
                    <div class="p-3 text-center">
                      <div class="text-slate-500 text-xs">52-Week Range</div>
                      <div class="font-bold">
                        @if (tickerDetails.fiftyTwoWeekLow != null && tickerDetails.fiftyTwoWeekHigh != null) {
                          {{ tickerDetails.fiftyTwoWeekLow.toFixed(2) }} &ndash; {{ tickerDetails.fiftyTwoWeekHigh.toFixed(2) }}
                        } @else {
                          N/A
                        }
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div class="bg-slate-50 rounded-lg h-full">
                    <div class="p-3 text-center">
                      <div class="text-slate-500 text-xs">Beta</div>
                      <div class="text-lg font-bold">
                        {{ tickerDetails.beta != null ? tickerDetails.beta.toFixed(2) : 'N/A' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: []
})
export class WatchlistComponent implements OnInit, OnDestroy {
  watchlist: WatchlistResponse | null = null;
  loading = true;
  refreshing = false;

  // Search
  searchQuery = '';
  searchResults: { ticker: string; name: string; exchange: string }[] = [];
  showDropdown = false;
  private searchSubject = new Subject<string>();

  // Chart
  chart: Chart | null = null;
  chartTicker: string | null = null;
  chartLoading = false;
  private pendingChartData: PortfolioHistoryResponse | null = null;
  private chartCanvasRef: ElementRef<HTMLCanvasElement> | null = null;

  @ViewChild('chartCanvas')
  set chartCanvas(ref: ElementRef<HTMLCanvasElement> | undefined) {
    if (ref) {
      this.chartCanvasRef = ref;
      if (this.pendingChartData) {
        const data = this.pendingChartData;
        this.pendingChartData = null;
        this.renderChart(data);
      }
    } else {
      this.chartCanvasRef = null;
    }
  }
  chartPeriods = [
    { label: '1M', value: '1mo' },
    { label: '3M', value: '3mo' },
    { label: '6M', value: '6mo' },
    { label: '1Y', value: '1y' },
  ];
  selectedPeriod = '6mo';

  // Ticker details
  tickerDetails: TickerDetailsDto | null = null;
  detailsLoading = false;

  constructor(
    private apiService: ApiService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadWatchlist(false);

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        if (q.length < 2) {
          this.showDropdown = false;
          return of({ results: [] });
        }
        return this.apiService.searchTickers(q);
      })
    ).subscribe({
      next: (res) => {
        this.searchResults = res.results;
        this.showDropdown = this.searchResults.length > 0;
      }
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.searchSubject.complete();
  }

  loadWatchlist(refresh: boolean): void {
    this.apiService.getWatchlist(refresh).subscribe({
      next: (res) => {
        this.watchlist = res;
        this.loading = false;
        this.refreshing = false;
      },
      error: () => {
        this.toast.error('Failed to load watchlist');
        this.loading = false;
        this.refreshing = false;
      }
    });
  }

  refreshPrices(): void {
    this.refreshing = true;
    this.loadWatchlist(true);
  }

  // Search
  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  addTicker(result: { ticker: string; name: string; exchange: string }): void {
    this.showDropdown = false;
    this.searchQuery = '';
    this.searchResults = [];

    this.apiService.addWatchlistItem({ ticker: result.ticker, name: result.name }).subscribe({
      next: () => {
        this.toast.success(`Added ${result.ticker} to watchlist`);
        this.loadWatchlist(false);
      },
      error: (err) => {
        const msg = err.error?.error || 'Failed to add ticker';
        this.toast.error(msg);
      }
    });
  }

  removeTicker(t: WatchlistTickerDto): void {
    if (!t.watchlistItemId) return;
    this.apiService.removeWatchlistItem(t.watchlistItemId).subscribe({
      next: () => {
        this.toast.success(`Removed ${t.ticker} from watchlist`);
        if (this.chartTicker === t.ticker) {
          this.closeChart();
        }
        this.loadWatchlist(false);
      },
      error: () => {
        this.toast.error('Failed to remove ticker');
      }
    });
  }

  // Chart
  toggleChart(t: WatchlistTickerDto): void {
    if (this.chartTicker === t.ticker) {
      this.closeChart();
      return;
    }
    this.chartTicker = t.ticker;
    this.selectedPeriod = '6mo';
    this.loadChart();
    this.loadDetails();
  }

  closeChart(): void {
    this.chartTicker = null;
    this.chart?.destroy();
    this.chart = null;
    this.tickerDetails = null;
  }

  changePeriod(period: string): void {
    this.selectedPeriod = period;
    this.loadChart();
  }

  loadChart(): void {
    if (!this.chartTicker) return;
    this.chartLoading = true;

    this.apiService.getWatchlistHistory(this.chartTicker, this.selectedPeriod).subscribe({
      next: (res) => {
        this.chartLoading = false;
        // Store data; the ViewChild setter will render when canvas appears
        this.pendingChartData = res;
      },
      error: () => {
        this.toast.error('Failed to load price history');
        this.chartLoading = false;
      }
    });
  }

  renderChart(data: PortfolioHistoryResponse): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    if (!this.chartCanvasRef) return;

    const ctx = this.chartCanvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = data.history.map(h => {
      const d = new Date(h.date);
      return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    });
    const values = data.history.map(h => h.value);

    // Determine color based on overall trend
    const isUp = values.length >= 2 && values[values.length - 1] >= values[0];
    const color = isUp ? '#198754' : '#dc3545';

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, isUp ? 'rgba(25, 135, 84, 0.15)' : 'rgba(220, 53, 69, 0.15)');
    gradient.addColorStop(1, isUp ? 'rgba(25, 135, 84, 0.01)' : 'rgba(220, 53, 69, 0.01)');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `${this.chartTicker} Price`,
          data: values,
          borderColor: color,
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

  loadDetails(): void {
    if (!this.chartTicker) return;
    this.detailsLoading = true;
    this.tickerDetails = null;

    this.apiService.getWatchlistDetails(this.chartTicker).subscribe({
      next: (res) => {
        this.tickerDetails = res.details;
        this.detailsLoading = false;
      },
      error: () => {
        this.toast.error('Failed to load ticker details');
        this.detailsLoading = false;
      }
    });
  }

  formatMarketCap(value: number | null): string {
    if (value == null) return 'N/A';
    if (value >= 1_000_000_000_000) return '$' + (value / 1_000_000_000_000).toFixed(2) + 'T';
    if (value >= 1_000_000_000) return '$' + (value / 1_000_000_000).toFixed(2) + 'B';
    if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M';
    return '$' + value.toLocaleString('en-AU');
  }

  absVal(n: number): number {
    return Math.abs(n);
  }
}
