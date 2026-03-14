import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Toast, ToastService } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-4 right-4 z-[1100] flex flex-col gap-2">
      @for (toast of toasts; track $index) {
        <div class="rounded-lg shadow-lg px-4 py-3 text-sm text-white min-w-[250px] animate-slide-in"
             [class.bg-ok]="toast.type === 'success'"
             [class.bg-over]="toast.type === 'error'">
          {{ toast.message }}
        </div>
      }
    </div>
  `,
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private sub!: Subscription;

  constructor(private toastService: ToastService) {}

  ngOnInit() {
    this.sub = this.toastService.toast$.subscribe(toast => {
      this.toasts.push(toast);
      setTimeout(() => this.toasts.shift(), 3000);
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}
