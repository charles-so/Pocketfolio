import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { DashboardResponse } from '../../core/models/dashboard.model';
import { PendingRecurringItem } from '../../core/models/recurring.model';
import { ToastService } from '../../shared/components/toast/toast.service';
import { AudCurrencyPipe, AudSignedPipe } from '../../shared/pipes/currency-aud.pipe';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, AudCurrencyPipe, AudSignedPipe, RouterLink, StatCardComponent],
  template: `
    <!-- Pending Recurring Items Banner -->
    @if (pendingItems.length > 0) {
      <div class="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between cursor-pointer hover:bg-amber-100 transition-colors"
           (click)="showPendingModal = true">
        <div class="flex items-center gap-2">
          <i class="bi bi-clock-history text-amber-600"></i>
          <span class="text-sm text-amber-800"><strong>{{ pendingItems.length }}</strong> pending recurring item{{ pendingItems.length === 1 ? '' : 's' }} to review</span>
        </div>
        <button class="btn btn-warning btn-sm">Review</button>
      </div>
    }

    <!-- Period Navigation -->
    <div class="flex flex-col sm:flex-row items-center justify-between mb-6 gap-3">
      <button class="btn btn-outline-secondary btn-sm"
              [disabled]="dashboard && dashboard.period <= 1"
              (click)="navPeriod(-1)">
        <i class="bi bi-chevron-left me-1"></i> Prev
      </button>
      <h2 class="text-xl font-bold text-slate-800">{{ dashboard?.periodLabel || 'Loading...' }}</h2>
      <div class="flex items-center gap-2">
        <button class="btn btn-outline-secondary btn-sm" (click)="navPeriod(1)">Next <i class="bi bi-chevron-right ms-1"></i></button>
        <button class="btn btn-primary btn-sm" (click)="navToday()">Today</button>
        <input type="date" class="form-control form-control-sm" style="width:140px"
               [value]="jumpDate" (change)="navToDate($event)">
      </div>
    </div>

    <!-- Hero Stats -->
    @if (dashboard) {
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <app-stat-card label="Income" accent="#2563eb">
          {{ dashboard.income.periodIncome | aud }}
        </app-stat-card>
        <app-stat-card label="Spent" accent="#dc2626">
          {{ dashboard.totalSpent | aud }}
        </app-stat-card>
        <app-stat-card label="Available" accent="#16a34a">
          {{ dashboard.totalAvailable | aud }}
        </app-stat-card>
        <app-stat-card label="Remaining"
          [accent]="dashboard.income.cumulativeRemaining >= 0 ? '#16a34a' : '#dc2626'"
          [valueClass]="dashboard.income.cumulativeRemaining >= 0 ? 'text-ok' : 'text-over'">
          {{ dashboard.income.cumulativeRemaining | aud }}
        </app-stat-card>
      </div>
    }

    <!-- Income Section -->
    @if (dashboard) {
      <div class="flex items-center justify-between mt-6 mb-3">
        <h3 class="text-lg font-semibold text-slate-700">Income</h3>
      </div>

      @if (dashboard.income.records.length > 0) {
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-4">
          <div class="overflow-x-auto">
            <table class="table table-sm table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th class="text-end" style="width:120px">Amount</th>
                  <th>Description</th>
                  <th style="width:40px"></th>
                </tr>
              </thead>
              <tbody>
                @for (r of dashboard.income.records; track r.id) {
                  <tr>
                    <td>{{ r.date }}</td>
                    <td>
                      @switch (r.type) {
                        @case ('Paycheck') { <span class="badge bg-primary">Paycheck</span> }
                        @case ('StockSale') { <span class="badge bg-info">Stock Sale</span> }
                        @case ('Bonus') { <span class="badge bg-success">Bonus</span> }
                      }
                    </td>
                    <td class="text-end text-ok font-medium">{{ r.amount | aud }}</td>
                    <td>{{ r.description }}</td>
                    <td>
                      <button class="text-over hover:text-red-800 transition-colors text-lg" (click)="deleteIncome(r.id)" style="background:none;border:none;cursor:pointer">
                        &times;
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else {
        <p class="text-slate-400 text-sm mb-4">No income recorded this period.</p>
      }
    }

    <!-- Grouped Expense Envelope Table -->
    @if (dashboard) {
      <h3 class="text-lg font-semibold text-slate-700 mt-6 mb-3">Expenses</h3>
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-4">
        <div class="overflow-x-auto">
          <table class="table table-sm table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Envelope</th>
                <th class="text-end" style="width:100px">Budget/fn</th>
                <th class="text-end" style="width:100px">Spent</th>
                <th class="text-end" style="width:100px">Rollover</th>
                <th class="text-end" style="width:110px">Available</th>
              </tr>
            </thead>
            <tbody>
              @for (g of dashboard.groups; track g.name) {
                <tr class="group-row">
                  <td><strong>{{ g.name }}</strong></td>
                  <td class="text-end"><strong>{{ g.budgetFn | aud }}</strong></td>
                  <td class="text-end"><strong>{{ g.spent ? (g.spent | aud) : '' }}</strong></td>
                  <td class="text-end"></td>
                  <td class="text-end" [class.text-budget-ok]="g.available >= 0" [class.text-budget-over]="g.available < 0">
                    <strong>{{ g.available | aud }}</strong>
                  </td>
                </tr>
                @for (e of g.envelopes; track e.id) {
                  <tr>
                    <td class="ps-4">
                      <a [routerLink]="['/envelope', e.id]" class="text-slate-700 hover:text-brand-500 hover:underline transition-colors">{{ e.name }}</a>
                      @if (e.bonus) {
                        <span class="badge bg-success ms-1">+{{ e.bonus | aud }} bonus</span>
                      }
                    </td>
                    <td class="text-end">{{ e.budgetFn | aud }}</td>
                    <td class="text-end">{{ e.spent ? (e.spent | aud) : '' }}</td>
                    <td class="text-end">{{ e.rollover !== 0 ? (e.rollover | audSigned) : '' }}</td>
                    <td class="text-end" [class.text-budget-ok]="e.available >= 0" [class.text-budget-over]="e.available < 0">
                      {{ e.available | aud }}
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- Investment Section -->
    @if (dashboard && dashboard.investments.envelopes.length > 0) {
      <h3 class="text-lg font-semibold text-slate-700 mt-6 mb-3">
        <i class="bi bi-graph-up-arrow me-1"></i>Investments
      </h3>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <app-stat-card label="Budget/fn" accent="#2563eb">
          {{ dashboard.investments.totalBudgetFn | aud }}
        </app-stat-card>
        <app-stat-card label="Undeposited"
          [accent]="dashboard.investments.totalRollover > 0 ? '#dc2626' : '#16a34a'"
          [valueClass]="dashboard.investments.totalRollover > 0 ? 'text-over' : 'text-ok'">
          {{ dashboard.investments.totalRollover | aud }}
        </app-stat-card>
        <app-stat-card label="Deposited" accent="#2563eb">
          {{ dashboard.investments.totalDeposited | aud }}
        </app-stat-card>
        <app-stat-card label="Cash to Invest"
          [accent]="dashboard.investments.totalCashToInvest >= 0 ? '#16a34a' : '#dc2626'"
          [valueClass]="dashboard.investments.totalCashToInvest >= 0 ? 'text-ok' : 'text-over'">
          {{ dashboard.investments.totalCashToInvest | aud }}
        </app-stat-card>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-4">
        <div class="overflow-x-auto">
          <table class="table table-sm table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>Investment</th>
                <th class="text-end" style="width:100px">Budget/fn</th>
                <th class="text-end" style="width:110px">Undeposited</th>
                <th class="text-end" style="width:100px">Deposited</th>
                <th class="text-end" style="width:120px">Cash to Invest</th>
              </tr>
            </thead>
            <tbody>
              @for (inv of dashboard.investments.envelopes; track inv.id) {
                <tr>
                  <td>
                    {{ inv.name }}
                    @if (inv.ticker) {
                      <span class="text-slate-400 text-xs ms-1">({{ inv.ticker }})</span>
                    }
                    @if (inv.bonus) {
                      <span class="badge bg-success ms-1">+{{ inv.bonus | aud }} bonus</span>
                    }
                  </td>
                  <td class="text-end">{{ inv.budgetFn | aud }}</td>
                  <td class="text-end" [class.text-budget-ok]="inv.rollover >= 0" [class.text-budget-over]="inv.rollover < 0">
                    {{ inv.rollover | aud }}
                  </td>
                  <td class="text-end">{{ inv.deposited | aud }}</td>
                  <td class="text-end" [class.text-budget-ok]="inv.cashToInvest >= 0" [class.text-budget-over]="inv.cashToInvest < 0">
                    {{ inv.cashToInvest | aud }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- Pending Recurring Items Modal -->
    @if (showPendingModal) {
      <div class="modal-backdrop fade show"></div>
      <div class="modal fade show d-block" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Pending Recurring Items</h5>
              <button type="button" class="btn-close" (click)="showPendingModal = false"></button>
            </div>
            <div class="modal-body">
              @if (pendingItems.length > 0) {
                <div class="flex justify-end mb-3">
                  <button class="btn btn-success btn-sm" [disabled]="pendingActionLoading"
                          (click)="confirmAllPending()">
                    @if (pendingActionLoading) {
                      <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                    }
                    Confirm All ({{ pendingItems.length }})
                  </button>
                </div>
                <div class="overflow-x-auto">
                  <table class="table table-sm table-hover mb-0">
                    <thead class="table-light">
                      <tr>
                        <th>Type</th>
                        <th>Details</th>
                        <th class="text-end" style="width:100px">Amount</th>
                        <th style="width:100px">Due Date</th>
                        <th style="width:100px">Frequency</th>
                        <th style="width:140px" class="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (p of pendingItems; track p.recurringItemId + '-' + p.dueDate) {
                        <tr>
                          <td>
                            @if (p.type === 'Income') {
                              <span class="badge bg-success">Income</span>
                            } @else {
                              <span class="badge bg-danger">Expense</span>
                            }
                          </td>
                          <td>
                            @if (p.type === 'Income') {
                              {{ p.incomeType }}
                            } @else {
                              {{ p.envelopeName }}
                            }
                            @if (p.description) {
                              <span class="text-slate-400 text-xs ms-1">- {{ p.description }}</span>
                            }
                          </td>
                          <td class="text-end">{{ p.amount | aud }}</td>
                          <td>{{ p.dueDate }}</td>
                          <td>{{ p.frequency }}</td>
                          <td class="text-end">
                            <button class="btn btn-outline-success btn-sm py-0 px-2 me-1"
                                    (click)="confirmPending(p)">Confirm</button>
                            <button class="btn btn-outline-secondary btn-sm py-0 px-2"
                                    (click)="skipPending(p)">Skip</button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <p class="text-slate-400 text-sm">No pending recurring items.</p>
              }
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary btn-sm" (click)="showPendingModal = false">Close</button>
            </div>
          </div>
        </div>
      </div>
    }

  `,
})
export class DashboardComponent implements OnInit {
  dashboard: DashboardResponse | null = null;
  currentPeriod: number | undefined;
  jumpDate = '';

  // Pending recurring items
  pendingItems: PendingRecurringItem[] = [];
  showPendingModal = false;
  pendingActionLoading = false;

  constructor(
    private apiService: ApiService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
    this.loadPendingItems();
  }

  loadDashboard(): void {
    this.apiService.getDashboard(this.currentPeriod).subscribe({
      next: (data) => {
        this.dashboard = data;
        this.currentPeriod = data.period;
        this.jumpDate = data.periodStart;
      },
      error: (err) => {
        this.toast.error('Failed to load dashboard: ' + (err.error?.error || err.message));
      },
    });
  }

  loadPendingItems(): void {
    this.apiService.getPendingRecurring().subscribe({
      next: (data) => {
        this.pendingItems = data.items;
      },
      error: () => {
        // Silently fail - pending items are non-critical
      },
    });
  }

  navPeriod(delta: number): void {
    if (this.currentPeriod != null) {
      const next = this.currentPeriod + delta;
      if (next < 1) return;
      this.currentPeriod = next;
    }
    this.loadDashboard();
  }

  navToDate(event: Event): void {
    const date = (event.target as HTMLInputElement).value;
    if (!date) return;
    this.currentPeriod = undefined;
    this.apiService.getDashboard(undefined, date).subscribe({
      next: (data) => {
        this.dashboard = data;
        this.currentPeriod = data.period;
        this.jumpDate = data.periodStart;
      },
      error: (err) => {
        this.toast.error('Failed to load dashboard: ' + (err.error?.error || err.message));
      },
    });
  }

  navToday(): void {
    this.currentPeriod = undefined;
    this.loadDashboard();
  }

  // ── Pending Recurring Items ──

  confirmPending(item: PendingRecurringItem): void {
    this.apiService.confirmRecurring({
      recurringItemId: item.recurringItemId,
      dueDate: item.dueDate,
    }).subscribe({
      next: () => {
        this.toast.success('Recurring item confirmed.');
        this.loadPendingItems();
        this.loadDashboard();
      },
      error: (err) => {
        this.toast.error('Failed to confirm: ' + (err.error?.error || err.message));
      },
    });
  }

  skipPending(item: PendingRecurringItem): void {
    this.apiService.skipRecurring({
      recurringItemId: item.recurringItemId,
      dueDate: item.dueDate,
    }).subscribe({
      next: () => {
        this.toast.success('Recurring item skipped.');
        this.loadPendingItems();
      },
      error: (err) => {
        this.toast.error('Failed to skip: ' + (err.error?.error || err.message));
      },
    });
  }
  confirmAllPending(): void {
    this.pendingActionLoading = true;
    this.apiService.confirmAllRecurring().subscribe({
      next: (res) => {
        this.pendingActionLoading = false;
        this.toast.success('Confirmed ' + res.applied + ' recurring item' + (res.applied === 1 ? '' : 's') + '.');
        this.pendingItems = [];
        this.showPendingModal = false;
        this.loadDashboard();
      },
      error: (err) => {
        this.pendingActionLoading = false;
        this.toast.error('Failed to confirm all: ' + (err.error?.error || err.message));
      },
    });
  }

  deleteIncome(id: number): void {
    this.apiService.deleteIncome(id).subscribe({
      next: () => {
        this.toast.success('Income deleted.');
        this.loadDashboard();
      },
      error: (err) => {
        this.toast.error('Failed to delete: ' + (err.error?.error || err.message));
      },
    });
  }
}
