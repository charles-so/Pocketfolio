import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-budget-progress',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full">
      <div class="flex justify-between text-xs mb-1">
        <span class="text-slate-500">{{ spent | number:'1.0-0' }} / {{ budget | number:'1.0-0' }}</span>
        <span [class]="pctClass">{{ pct | number:'1.0-0' }}%</span>
      </div>
      <div class="h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div class="h-full rounded-full transition-all duration-300"
             [style.width.%]="barWidth"
             [class]="barClass">
        </div>
      </div>
    </div>
  `,
})
export class BudgetProgressComponent implements OnChanges {
  @Input() spent = 0;
  @Input() budget = 0;

  pct = 0;
  barWidth = 0;
  barClass = 'bg-ok';
  pctClass = 'text-ok';

  ngOnChanges(): void {
    this.pct = this.budget > 0 ? (this.spent / this.budget) * 100 : 0;
    this.barWidth = Math.min(this.pct, 100);

    if (this.pct <= 75) {
      this.barClass = 'bg-ok';
      this.pctClass = 'text-ok';
    } else if (this.pct <= 100) {
      this.barClass = 'bg-pending';
      this.pctClass = 'text-pending';
    } else {
      this.barClass = 'bg-over';
      this.pctClass = 'text-over';
    }
  }
}
