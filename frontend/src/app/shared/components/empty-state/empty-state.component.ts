import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col items-center justify-center py-12 text-center">
      @if (icon) {
        <i class="bi text-4xl text-slate-300 mb-3" [class]="icon"></i>
      }
      <p class="text-slate-400 text-sm">{{ message }}</p>
      <ng-content></ng-content>
    </div>
  `,
})
export class EmptyStateComponent {
  @Input() icon = '';
  @Input() message = 'Nothing to show';
}
