import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-4"
         [style.border-left]="accent ? '4px solid ' + accent : ''">
      <div class="text-xs font-medium text-slate-500 uppercase tracking-wide">{{ label }}</div>
      <div class="text-xl font-bold mt-1" [class]="valueClass">
        <ng-content></ng-content>
      </div>
      @if (subtext) {
        <div class="text-xs text-slate-400 mt-1">{{ subtext }}</div>
      }
    </div>
  `,
})
export class StatCardComponent {
  @Input() label = '';
  @Input() accent = '';
  @Input() subtext = '';
  @Input() valueClass = 'text-slate-800';
}
