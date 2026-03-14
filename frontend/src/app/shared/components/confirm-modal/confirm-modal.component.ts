import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open) {
      <div class="modal-backdrop fade show"></div>
      <div class="modal fade show d-block" tabindex="-1">
        <div class="modal-dialog modal-sm">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">{{ title }}</h5>
              <button type="button" class="btn-close" (click)="cancel.emit()"></button>
            </div>
            <div class="modal-body">
              <p>{{ message }}</p>
              <ng-content></ng-content>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary btn-sm" (click)="cancel.emit()">Cancel</button>
              <button class="btn btn-sm" [class]="confirmBtnClass" (click)="confirm.emit()" [disabled]="loading">
                @if (loading) {
                  <span class="spinner-border spinner-border-sm me-1"></span>
                }
                {{ confirmLabel }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmModalComponent {
  @Input() open = false;
  @Input() title = 'Confirm';
  @Input() message = 'Are you sure?';
  @Input() confirmLabel = 'Confirm';
  @Input() confirmBtnClass = 'btn-danger';
  @Input() loading = false;
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
}
