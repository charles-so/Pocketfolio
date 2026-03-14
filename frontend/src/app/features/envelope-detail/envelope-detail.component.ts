import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { EnvelopeDetailResponse } from '../../core/models/dashboard.model';
import { AudCurrencyPipe } from '../../shared/pipes/currency-aud.pipe';
import { TransactionsComponent } from '../transactions/transactions.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';

@Component({
  selector: 'app-envelope-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, AudCurrencyPipe, TransactionsComponent, StatCardComponent],
  template: `
    <div>
      <a routerLink="/dashboard" class="text-brand-500 hover:text-brand-700 text-sm inline-flex items-center gap-1 mb-3">
        <i class="bi bi-chevron-left"></i> Back to Dashboard
      </a>

      @if (detail) {
        <div class="flex flex-wrap items-center gap-3 mt-2 mb-6">
          <h1 class="text-2xl font-bold text-slate-800">{{ detail.name }}</h1>
          <span class="badge bg-secondary">{{ detail.groupName }}</span>
          @if (detail.ticker) {
            <span class="badge bg-primary">{{ detail.ticker }}</span>
          }
          <span class="text-slate-400 text-sm">{{ detail.budgetFn | aud }}/fn</span>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <app-stat-card label="Total Spent">{{ detail.stats.totalSpent | aud }}</app-stat-card>
          <app-stat-card label="Avg / Fortnight">{{ detail.stats.avgPerPeriod | aud }}</app-stat-card>
          <app-stat-card label="Avg / Transaction">{{ detail.stats.avgPerTransaction | aud }}</app-stat-card>
          <app-stat-card label="Transactions">{{ detail.stats.transactionCount }}</app-stat-card>
          <app-stat-card label="This Period">{{ detail.stats.currentPeriodSpent | aud }}</app-stat-card>
          <app-stat-card label="Last Period">{{ detail.stats.lastPeriodSpent | aud }}</app-stat-card>
        </div>

        @if (detail.stats.highest || detail.stats.lowest) {
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            @if (detail.stats.highest) {
              <div class="bg-white rounded-xl shadow-sm border-l-4 border-over p-4">
                <div class="text-xs text-slate-500 uppercase tracking-wide">Highest Transaction</div>
                <div class="text-lg font-bold text-over mt-1">{{ detail.stats.highest.amount | aud }}</div>
                <div class="text-xs text-slate-400 mt-1">{{ detail.stats.highest.description }} ({{ detail.stats.highest.date }})</div>
              </div>
            }
            @if (detail.stats.lowest) {
              <div class="bg-white rounded-xl shadow-sm border-l-4 border-ok p-4">
                <div class="text-xs text-slate-500 uppercase tracking-wide">Lowest Transaction</div>
                <div class="text-lg font-bold text-ok mt-1">{{ detail.stats.lowest.amount | aud }}</div>
                <div class="text-xs text-slate-400 mt-1">{{ detail.stats.lowest.description }} ({{ detail.stats.lowest.date }})</div>
              </div>
            }
          </div>
        }

        <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">Transaction History</div>
          <div class="p-0">
            <app-transactions [envelopeId]="detail.id"></app-transactions>
          </div>
        </div>
      } @else if (loading) {
        <div class="flex justify-center py-12">
          <span class="spinner-border"></span>
        </div>
      } @else {
        <div class="alert alert-warning mt-4">Envelope not found.</div>
      }
    </div>
  `,
})
export class EnvelopeDetailComponent implements OnInit {
  detail: EnvelopeDetailResponse | null = null;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    public apiService: ApiService,
  ) {}

  ngOnInit(): void {
    this.loadDetail();
  }

  loadDetail(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.apiService.getEnvelopeDetail(id).subscribe({
      next: (data) => {
        this.detail = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
