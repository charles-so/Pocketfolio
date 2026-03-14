import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalysisComponent } from './analysis.component';
import { PortfolioComponent } from '../portfolio/portfolio.component';
import { WatchlistComponent } from '../watchlist/watchlist.component';
import { InvestmentCalculatorComponent } from './investment-calculator.component';

@Component({
  selector: 'app-analysis-wrapper',
  standalone: true,
  imports: [CommonModule, AnalysisComponent, PortfolioComponent, WatchlistComponent, InvestmentCalculatorComponent],
  template: `
    <div class="py-2">
      <div class="flex gap-1 bg-slate-100 rounded-lg p-1 mb-6 w-fit">
        <button class="px-4 py-2 rounded-md text-sm font-medium transition-all"
                [class]="activeTab === 'spending' ? 'bg-white shadow-sm text-brand-500' : 'text-slate-500 hover:text-slate-700'"
                (click)="activeTab = 'spending'">Spending</button>
        <button class="px-4 py-2 rounded-md text-sm font-medium transition-all"
                [class]="activeTab === 'portfolio' ? 'bg-white shadow-sm text-brand-500' : 'text-slate-500 hover:text-slate-700'"
                (click)="activeTab = 'portfolio'">Portfolio</button>
        <button class="px-4 py-2 rounded-md text-sm font-medium transition-all"
                [class]="activeTab === 'watchlist' ? 'bg-white shadow-sm text-brand-500' : 'text-slate-500 hover:text-slate-700'"
                (click)="activeTab = 'watchlist'">Watchlist</button>
        <button class="px-4 py-2 rounded-md text-sm font-medium transition-all"
                [class]="activeTab === 'calculator' ? 'bg-white shadow-sm text-brand-500' : 'text-slate-500 hover:text-slate-700'"
                (click)="activeTab = 'calculator'">Calculator</button>
      </div>

      @switch (activeTab) {
        @case ('spending') { <app-analysis /> }
        @case ('portfolio') { <app-portfolio /> }
        @case ('watchlist') { <app-watchlist /> }
        @case ('calculator') { <app-investment-calculator /> }
      }
    </div>
  `,
})
export class AnalysisWrapperComponent {
  activeTab = 'spending';
}
