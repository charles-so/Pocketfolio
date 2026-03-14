import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TransactionsComponent } from './transactions.component';
import { TradesComponent } from '../trades/trades.component';

@Component({
  selector: 'app-transactions-wrapper',
  standalone: true,
  imports: [CommonModule, TransactionsComponent, TradesComponent],
  template: `
    <div class="py-2">
      <div class="flex gap-1 bg-slate-100 rounded-lg p-1 mb-6 w-fit">
        <button class="px-4 py-2 rounded-md text-sm font-medium transition-all"
                [class]="activeTab === 'transactions' ? 'bg-white shadow-sm text-brand-500' : 'text-slate-500 hover:text-slate-700'"
                (click)="activeTab = 'transactions'">Transactions</button>
        <button class="px-4 py-2 rounded-md text-sm font-medium transition-all"
                [class]="activeTab === 'trades' ? 'bg-white shadow-sm text-brand-500' : 'text-slate-500 hover:text-slate-700'"
                (click)="activeTab = 'trades'">Trades</button>
      </div>

      @switch (activeTab) {
        @case ('transactions') { <app-transactions /> }
        @case ('trades') { <app-trades /> }
      }
    </div>
  `,
})
export class TransactionsWrapperComponent {
  activeTab = 'transactions';
}
