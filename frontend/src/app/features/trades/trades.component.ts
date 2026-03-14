import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { TradeDto, InvestmentSummary, TradesResponse } from '../../core/models/trade.model';
import { HoldingDto } from '../../core/models/portfolio.model';
import { ToastService } from '../../shared/components/toast/toast.service';
import { AudCurrencyPipe } from '../../shared/pipes/currency-aud.pipe';

@Component({
  selector: 'app-trades',
  standalone: true,
  imports: [CommonModule, FormsModule, AudCurrencyPipe],
  template: `
    <div>
      <h2 class="text-2xl font-bold text-slate-800 mb-6">Trades</h2>

      <!-- Investment Cash Summary Cards -->
      @if (investmentSummary.length > 0) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          @for (inv of investmentSummary; track inv.ticker) {
            <div>
              <div class="bg-white rounded-xl shadow-sm border border-slate-100 h-full" [class.ring-2]="selectedTicker === inv.ticker" [class.ring-brand-500]="selectedTicker === inv.ticker"
                   style="cursor: pointer" (click)="selectTicker(inv.ticker)">
                <div class="p-4">
                  <div class="flex justify-between items-center mb-2">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{{ inv.ticker }}</span>
                    <div class="flex gap-1">
                      <button class="btn btn-outline-primary" (click)="openTradeModal(inv); \$event.stopPropagation()">Buy</button>
                      <button class="btn btn-outline-success" (click)="openSellModal(inv); \$event.stopPropagation()" [disabled]="!getHolding(inv.ticker)">Sell</button>
                    </div>
                  </div>
                  <div class="font-semibold mb-2">{{ inv.envelopeName }}</div>
                  <div class="mb-2">
                    <span class="text-slate-500 text-sm">Uninvested Cash</span>
                    <div class="text-xl font-bold"
                      [class.text-success]="inv.cash >= 0"
                      [class.text-danger]="inv.cash < 0">
                      {{ inv.cash >= 0 ? '' : '-' }}{{ absVal(inv.cash) | aud:2 }}
                    </div>
                  </div>
                  <div class="grid grid-cols-2 text-slate-500 text-sm">
                    <div>
                      <div>Deposited</div>
                      <div class="text-slate-800">{{ inv.deposited | aud:2 }}</div>
                    </div>
                    <div>
                      <div>Traded</div>
                      <div class="text-slate-800">{{ inv.traded | aud:2 }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }

          @if (investmentSummary.length > 1) {
            <div>
              <div class="bg-white rounded-xl shadow-sm border border-slate-100 h-full" [class.ring-2]="selectedTicker === ''" [class.ring-brand-500]="selectedTicker === ''"
                   style="cursor: pointer" (click)="selectTicker('')">
                <div class="p-4 flex flex-col justify-center">
                  <div class="text-slate-500 text-sm mb-1">Total Uninvested Cash</div>
                  <div class="text-2xl font-bold"
                    [class.text-success]="totalUninvestedCash >= 0"
                    [class.text-danger]="totalUninvestedCash < 0">
                    {{ totalUninvestedCash >= 0 ? '' : '-' }}{{ absVal(totalUninvestedCash) | aud:2 }}
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Trade History for Selected Ticker -->
      @if (selectedTicker !== null) {
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 mb-6">
          <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 class="font-semibold text-slate-800">{{ selectedTicker ? selectedTicker + ' Trades' : 'All Trades' }}</h3>
            <button class="btn btn-sm btn-outline-secondary" (click)="selectedTicker = null">Close</button>
          </div>
          <div class="p-0">
            <div class="table-responsive">
              <table class="w-full text-sm">
                <thead class="bg-slate-50">
                  <tr>
                    <th class="px-4 py-3">Date</th>
                    @if (!selectedTicker) {
                      <th class="px-4 py-3">Ticker</th>
                    }
                    <th class="px-4 py-3 text-end">Shares</th>
                    <th class="px-4 py-3 text-end">Price/Share</th>
                    <th class="px-4 py-3 text-end">Fees</th>
                    <th class="px-4 py-3 text-end">Total Cost</th>
                    <th class="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @if (tickerTrades.length > 0) {
                    @for (t of tickerTrades; track t.id) {
                      <tr>
                        <td class="px-4 py-2.5">{{ formatDate(t.date) }}</td>
                        @if (!selectedTicker) {
                          <td class="px-4 py-2.5"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{{ t.ticker }}</span></td>
                        }
                        <td class="px-4 py-2.5 text-end">{{ t.shares | number:'1.0-4' }}</td>
                        <td class="px-4 py-2.5 text-end">{{ t.price | aud:2 }}</td>
                        <td class="px-4 py-2.5 text-end">{{ t.fees | aud:2 }}</td>
                        <td class="px-4 py-2.5 text-end">{{ t.totalCost | aud:2 }}</td>
                        <td class="px-4 py-2.5 text-center">
                          <button class="btn btn-sm btn-outline-primary me-1" (click)="openEdit(t)" title="Edit">
                            <i class="bi bi-pencil"></i> Edit
                          </button>
                          <button class="btn btn-sm btn-outline-danger" (click)="confirmDelete(t)" title="Delete">
                            <i class="bi bi-trash"></i> Delete
                          </button>
                        </td>
                      </tr>
                    }
                  } @else {
                    <tr>
                      <td [attr.colspan]="selectedTicker ? 6 : 7" class="text-center text-slate-500 py-6">No trades found</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Sell Holding Modal -->
    @if (showSellModal && sellTarget) {
      <div class="modal-backdrop fade show"></div>
      <div class="modal fade show d-block" tabindex="-1" (click)="closeSell()">
        <div class="modal-dialog" (click)="\$event.stopPropagation()">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Sell {{ sellTarget.ticker }}</h5>
              <button type="button" class="btn-close" (click)="closeSell()"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Shares to sell</label>
                <input type="number" class="form-control" [(ngModel)]="sellForm.shares"
                  step="any" min="0" [max]="sellTarget.shares">
                <div class="form-text">Available: {{ sellTarget.shares }}</div>
              </div>
              <div class="mb-3">
                <label class="form-label">Sale price per share</label>
                <input type="number" class="form-control" [(ngModel)]="sellForm.price" step="0.01" min="0">
              </div>
              <div class="mb-3">
                <label class="form-label">Fees</label>
                <input type="number" class="form-control" [(ngModel)]="sellForm.fees" step="0.01" min="0">
              </div>
              <hr>
              <div class="row text-center">
                <div class="col">
                  <div class="text-muted small">Proceeds</div>
                  <div class="fw-bold">{{ sellProceeds | aud:2 }}</div>
                </div>
                <div class="col">
                  <div class="text-muted small">Avg Cost</div>
                  <div class="fw-bold">{{ sellAvgCost | aud:2 }}</div>
                </div>
                <div class="col">
                  <div class="text-muted small">Gain/Loss</div>
                  <div class="fw-bold"
                    [class.text-success]="sellGain >= 0"
                    [class.text-danger]="sellGain < 0">
                    {{ sellGain >= 0 ? '+' : '-' }}{{ absVal(sellGain) | aud:2 }}
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" (click)="closeSell()">Cancel</button>
              <button type="button" class="btn btn-success" (click)="executeSell()"
                [disabled]="saving || sellForm.shares <= 0 || sellForm.shares > sellTarget.shares || sellForm.price <= 0">
                @if (saving) {
                  <span class="spinner-border spinner-border-sm me-1"></span> Selling...
                } @else {
                  Confirm Sale
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Record Trade Modal -->
    @if (showTradeModal) {
      <div class="modal-backdrop fade show"></div>
      <div class="modal fade show d-block" tabindex="-1" (click)="closeTradeModal()">
        <div class="modal-dialog" (click)="\$event.stopPropagation()">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Record Trade</h5>
              <button type="button" class="btn-close" (click)="closeTradeModal()"></button>
            </div>
            <div class="modal-body">
              <div class="mb-2">
                <label class="form-label mb-0"><strong>Ticker</strong></label>
                <input type="text" class="form-control form-control-sm" [value]="tradeTicker" readonly>
              </div>
              <div class="mb-2">
                <label class="form-label mb-0"><strong>Envelope</strong></label>
                <input type="text" class="form-control form-control-sm" [value]="tradeEnvName" readonly>
              </div>
              <div class="mb-2">
                <label class="form-label mb-0"><strong>Cash to Invest</strong></label>
                <input type="text" class="form-control form-control-sm" [value]="'\$' + tradeCash.toFixed(2)" readonly>
                <div class="form-text">Total deposited minus previous trades</div>
              </div>
              <div class="mb-2">
                <label class="form-label mb-0"><strong>Date</strong></label>
                <input type="date" class="form-control form-control-sm" [(ngModel)]="tradeDate">
              </div>
              <div class="mb-2">
                <label class="form-label mb-0"><strong>Price per Share (\$)</strong></label>
                <div class="input-group input-group-sm">
                  <input type="number" step="0.01" min="0.01" class="form-control"
                         [(ngModel)]="tradePrice" (ngModelChange)="updateNewTotalCost()">
                  <button class="btn btn-outline-secondary" type="button"
                          [disabled]="priceLoading" (click)="refreshPrice()">
                    @if (priceLoading) {
                      <span class="spinner-border spinner-border-sm" role="status"></span>
                    }
                    Refresh
                  </button>
                </div>
              </div>
              <div class="mb-2">
                <label class="form-label mb-0"><strong>Number of Shares</strong></label>
                <input type="number" step="1" min="1" class="form-control form-control-sm"
                       [(ngModel)]="tradeShares" (ngModelChange)="updateNewTotalCost()">
              </div>
              <div class="mb-2">
                <label class="form-label mb-0"><strong>Brokerage Fees (\$)</strong></label>
                <input type="number" step="0.01" min="0" class="form-control form-control-sm"
                       [(ngModel)]="tradeFees" (ngModelChange)="updateNewTotalCost()">
              </div>
              <div class="mb-2">
                <label class="form-label mb-0"><strong>Total Cost</strong></label>
                <input type="text" class="form-control form-control-sm fw-bold"
                       [value]="newTradeTotalCost > 0 ? ('\$' + newTradeTotalCost.toFixed(2)) : ''" readonly>
              </div>
              @if (tradeError) {
                <div class="text-danger small mt-1">{{ tradeError }}</div>
              }
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary btn-sm" (click)="closeTradeModal()">Cancel</button>
              <button type="button" class="btn btn-primary btn-sm"
                      [disabled]="tradeSubmitting" (click)="submitTrade()">
                @if (tradeSubmitting) {
                  <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                }
                Record Trade
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Edit Trade Modal -->
    @if (showEditModal) {
      <div class="modal-backdrop fade show"></div>
      <div class="modal fade show d-block" tabindex="-1" (click)="closeEdit()">
        <div class="modal-dialog" (click)="\$event.stopPropagation()">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Edit Trade</h5>
              <button type="button" class="btn-close" (click)="closeEdit()"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Ticker</label>
                <input type="text" class="form-control" [value]="editForm.ticker" readonly disabled>
              </div>
              <div class="mb-3">
                <label class="form-label">Date</label>
                <input type="date" class="form-control" [(ngModel)]="editForm.date">
              </div>
              <div class="mb-3">
                <label class="form-label">Shares</label>
                <input type="number" class="form-control" [(ngModel)]="editForm.shares"
                  step="any" min="0" (ngModelChange)="recalcTotal()">
              </div>
              <div class="mb-3">
                <label class="form-label">Price per Share</label>
                <input type="number" class="form-control" [(ngModel)]="editForm.price"
                  step="0.01" min="0" (ngModelChange)="recalcTotal()">
              </div>
              <div class="mb-3">
                <label class="form-label">Fees</label>
                <input type="number" class="form-control" [(ngModel)]="editForm.fees"
                  step="0.01" min="0" (ngModelChange)="recalcTotal()">
              </div>
              <div class="mb-3">
                <label class="form-label">Total Cost</label>
                <input type="text" class="form-control" [value]="editForm.totalCost | aud:2" readonly disabled>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" (click)="closeEdit()">Cancel</button>
              <button type="button" class="btn btn-primary" (click)="saveEdit()" [disabled]="saving">
                @if (saving) {
                  <span class="spinner-border spinner-border-sm me-1"></span> Saving...
                } @else {
                  Save Changes
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Delete Confirmation Modal -->
    @if (showDeleteModal) {
      <div class="modal-backdrop fade show"></div>
      <div class="modal fade show d-block" tabindex="-1" (click)="closeDelete()">
        <div class="modal-dialog" (click)="\$event.stopPropagation()">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Confirm Delete</h5>
              <button type="button" class="btn-close" (click)="closeDelete()"></button>
            </div>
            <div class="modal-body">
              @if (deleteTarget) {
                <p>Are you sure you want to delete the trade for
                  <strong>{{ deleteTarget.shares }} shares of {{ deleteTarget.ticker }}</strong>
                  on {{ formatDate(deleteTarget.date) }}?
                </p>
                <p class="text-muted small">This action cannot be undone.</p>
              }
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" (click)="closeDelete()">Cancel</button>
              <button type="button" class="btn btn-danger" (click)="executeDelete()" [disabled]="saving">
                @if (saving) {
                  <span class="spinner-border spinner-border-sm me-1"></span> Deleting...
                } @else {
                  Delete
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  
  `,
  styles: []
})
export class TradesComponent implements OnInit {
  trades: TradeDto[] = [];
  tickerTrades: TradeDto[] = [];
  investmentSummary: InvestmentSummary[] = [];
  totalUninvestedCash = 0;
  selectedTicker: string | null = null;

  saving = false;

  // Holdings (for sell)
  holdings: HoldingDto[] = [];

  // Sell modal
  showSellModal = false;
  sellTarget: HoldingDto | null = null;
  sellForm = { shares: 0, price: 0, fees: 0 };

  // Record Trade modal
  showTradeModal = false;
  tradeEnvId = 0;
  tradeTicker = '';
  tradeEnvName = '';
  tradeCash = 0;
  tradeDate = '';
  tradePrice: number | null = null;
  tradeShares: number | null = null;
  tradeFees = 0;
  newTradeTotalCost = 0;
  tradeError = '';
  priceLoading = false;
  tradeSubmitting = false;

  // Edit modal
  showEditModal = false;
  editTradeId = 0;
  editForm = { ticker: '', date: '', shares: 0, price: 0, fees: 0, totalCost: 0 };

  // Delete modal
  showDeleteModal = false;
  deleteTarget: TradeDto | null = null;

  constructor(
    private apiService: ApiService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadTrades();
    this.loadHoldings();
  }

  loadTrades(): void {
    this.apiService.getTrades().subscribe({
      next: (res: TradesResponse) => {
        this.trades = res.trades;
        this.investmentSummary = res.investmentSummary;
        this.totalUninvestedCash = this.investmentSummary.reduce((sum, inv) => sum + inv.cash, 0);
        this.filterTickerTrades();
      },
      error: () => {
        this.toast.error('Failed to load trades');
      }
    });
  }

  selectTicker(ticker: string): void {
    if (this.selectedTicker === ticker) {
      this.selectedTicker = null;
    } else {
      this.selectedTicker = ticker;
    }
    this.filterTickerTrades();
  }

  filterTickerTrades(): void {
    if (this.selectedTicker === null) {
      this.tickerTrades = [];
    } else if (this.selectedTicker === '') {
      this.tickerTrades = this.trades;
    } else {
      this.tickerTrades = this.trades.filter(t => t.ticker === this.selectedTicker);
    }
  }

  loadHoldings(): void {
    this.apiService.getPortfolio(false).subscribe({
      next: (res) => { this.holdings = res.holdings; },
      error: () => {},
    });
  }

  getHolding(ticker: string): HoldingDto | undefined {
    return this.holdings.find(h => h.ticker === ticker);
  }

  absVal(n: number): number { return Math.abs(n); }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Sell modal
  get sellProceeds(): number { return (this.sellForm.shares * this.sellForm.price) - this.sellForm.fees; }
  get sellAvgCost(): number {
    if (!this.sellTarget || this.sellTarget.shares === 0) return 0;
    return this.sellTarget.costBasis / this.sellTarget.shares;
  }
  get sellGain(): number { return this.sellProceeds - (this.sellAvgCost * this.sellForm.shares); }

  openSellModal(inv: InvestmentSummary): void {
    const h = this.getHolding(inv.ticker);
    if (!h) return;
    this.sellTarget = h;
    this.sellForm = { shares: h.shares, price: h.price, fees: 0 };
    this.showSellModal = true;
  }

  closeSell(): void { this.showSellModal = false; this.sellTarget = null; }

  executeSell(): void {
    if (!this.sellTarget) return;
    this.saving = true;
    this.apiService.sellHolding({
      holdingId: this.sellTarget.id,
      shares: this.sellForm.shares,
      price: this.sellForm.price,
      fees: this.sellForm.fees,
    }).subscribe({
      next: (res) => {
        const sign = res.gain >= 0 ? '+' : '-';
        const gainStr = sign + '$' + Math.abs(res.gain).toFixed(2);
        this.toast.success('Sold! Proceeds: $' + res.proceeds.toFixed(2) + ', Gain: ' + gainStr);
        this.saving = false;
        this.closeSell();
        this.loadTrades();
        this.loadHoldings();
      },
      error: () => {
        this.toast.error('Failed to sell holding');
        this.saving = false;
      }
    });
  }

  // Record Trade
  openTradeModal(inv: InvestmentSummary): void {
    this.tradeEnvId = inv.envelopeId;
    this.tradeTicker = inv.ticker;
    this.tradeEnvName = inv.envelopeName;
    this.tradeCash = inv.cash;
    this.tradeDate = new Date().toISOString().slice(0, 10);
    this.tradePrice = null;
    this.tradeShares = null;
    this.tradeFees = 0;
    this.newTradeTotalCost = 0;
    this.tradeError = '';
    this.showTradeModal = true;
    this.refreshPrice();
  }

  closeTradeModal(): void { this.showTradeModal = false; }

  refreshPrice(): void {
    if (!this.tradeTicker) return;
    this.priceLoading = true;
    this.apiService.getPrice(this.tradeTicker).subscribe({
      next: (data) => {
        if (data.price > 0) { this.tradePrice = parseFloat(data.price.toFixed(2)); this.updateNewTotalCost(); }
        this.priceLoading = false;
      },
      error: () => { this.priceLoading = false; },
    });
  }

  updateNewTotalCost(): void {
    this.newTradeTotalCost = (this.tradeShares || 0) * (this.tradePrice || 0) + (this.tradeFees || 0);
  }

  submitTrade(): void {
    this.tradeError = '';
    const price = this.tradePrice || 0;
    const shares = this.tradeShares || 0;
    const fees = this.tradeFees || 0;
    const total = shares * price + fees;
    if (shares <= 0) { this.tradeError = 'Enter a positive number of shares.'; return; }
    if (price <= 0) { this.tradeError = 'Enter a positive price.'; return; }
    if (total > this.tradeCash) {
      this.tradeError = 'Total cost ($' + total.toFixed(2) + ') exceeds cash to invest ($' + this.tradeCash.toFixed(2) + ').';
      return;
    }
    this.tradeSubmitting = true;
    this.apiService.createTrade({ envelopeId: this.tradeEnvId, date: this.tradeDate, shares, price, fees }).subscribe({
      next: () => {
        this.tradeSubmitting = false;
        this.closeTradeModal();
        this.toast.success('Trade recorded successfully.');
        this.loadTrades();
      },
      error: (err) => {
        this.tradeSubmitting = false;
        this.tradeError = err.error?.error || 'Network error: ' + err.message;
      },
    });
  }

  // Edit modal
  openEdit(t: TradeDto): void {
    this.editTradeId = t.id;
    this.editForm = { ticker: t.ticker, date: t.date.substring(0, 10), shares: t.shares, price: t.price, fees: t.fees, totalCost: t.totalCost };
    this.showEditModal = true;
  }

  closeEdit(): void { this.showEditModal = false; }

  recalcTotal(): void { this.editForm.totalCost = (this.editForm.shares * this.editForm.price) + this.editForm.fees; }

  saveEdit(): void {
    this.saving = true;
    this.apiService.updateTrade(this.editTradeId, { date: this.editForm.date, shares: this.editForm.shares, price: this.editForm.price, fees: this.editForm.fees }).subscribe({
      next: () => { this.toast.success('Trade updated'); this.saving = false; this.closeEdit(); this.loadTrades(); },
      error: () => { this.toast.error('Failed to update trade'); this.saving = false; }
    });
  }

  // Delete modal
  confirmDelete(t: TradeDto): void { this.deleteTarget = t; this.showDeleteModal = true; }
  closeDelete(): void { this.showDeleteModal = false; this.deleteTarget = null; }

  executeDelete(): void {
    if (!this.deleteTarget) return;
    this.saving = true;
    this.apiService.deleteTrade(this.deleteTarget.id).subscribe({
      next: () => { this.toast.success('Trade deleted'); this.saving = false; this.closeDelete(); this.loadTrades(); },
      error: () => { this.toast.error('Failed to delete trade'); this.saving = false; }
    });
  }
}
