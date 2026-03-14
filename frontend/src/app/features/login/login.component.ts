import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div class="text-center mb-6">
          <img src="money-pouch.png" alt="Pocketfolio" width="80" height="80" class="mx-auto mb-3">
          <h2 class="text-2xl font-bold text-slate-800">Pocketfolio</h2>
          <p class="text-sm text-slate-500 mt-1">{{ resetMode ? 'Reset Password' : 'Sign in to your account' }}</p>
        </div>
        @if (error) {
          <div class="alert alert-danger py-2 mb-4">{{ error }}</div>
        }
        @if (success) {
          <div class="alert alert-success py-2 mb-4">{{ success }}</div>
        }
        @if (!resetMode) {
          <form (ngSubmit)="onSubmit()">
            <div class="mb-4">
              <label class="form-label">Username</label>
              <input type="text" class="form-control" [(ngModel)]="username" name="username" required autofocus />
            </div>
            <div class="mb-4">
              <label class="form-label">Password</label>
              <input type="password" class="form-control" [(ngModel)]="password" name="password" required />
            </div>
            <button type="submit" class="btn btn-primary w-full py-2.5" [disabled]="loading">
              {{ loading ? 'Signing in...' : 'Sign In' }}
            </button>
          </form>
          <div class="mt-4 text-center space-y-2">
            <p class="text-sm text-slate-500">
              <a href="javascript:void(0)" class="text-brand-500 hover:text-brand-700" (click)="toggleReset()">Forgot password?</a>
            </p>
            <p class="text-sm text-slate-500">
              Don't have an account? <a routerLink="/register" class="text-brand-500 hover:text-brand-700 font-medium">Create one</a>
            </p>
          </div>
        } @else {
          <form (ngSubmit)="onReset()">
            <div class="mb-4">
              <label class="form-label">Master Key</label>
              <input type="password" class="form-control" [(ngModel)]="masterKey" name="masterKey" required autofocus />
            </div>
            <div class="mb-4">
              <label class="form-label">Username</label>
              <input type="text" class="form-control" [(ngModel)]="username" name="username" required />
            </div>
            <div class="mb-4">
              <label class="form-label">New Password</label>
              <input type="password" class="form-control" [(ngModel)]="newPassword" name="newPassword" required />
            </div>
            <button type="submit" class="btn btn-warning w-full py-2.5" [disabled]="loading">
              {{ loading ? 'Resetting...' : 'Reset Password' }}
            </button>
          </form>
          <p class="text-center mt-4 text-sm text-slate-500">
            <a href="javascript:void(0)" class="text-brand-500 hover:text-brand-700" (click)="toggleReset()">Back to Sign In</a>
          </p>
        }
      </div>
    </div>
  `,
})
export class LoginComponent {
  username = '';
  password = '';
  masterKey = '';
  newPassword = '';
  error = '';
  success = '';
  loading = false;
  resetMode = false;

  constructor(private auth: AuthService, private router: Router) {}

  toggleReset(): void {
    this.resetMode = !this.resetMode;
    this.error = '';
    this.success = '';
  }

  onSubmit(): void {
    this.error = '';
    this.loading = true;
    this.auth.login(this.username, this.password).subscribe({
      next: () => this.router.navigate([this.auth.getHomePath()]),
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Login failed.';
      },
    });
  }

  onReset(): void {
    this.error = '';
    this.success = '';
    this.loading = true;
    this.auth.masterResetPassword(this.masterKey, this.username, this.newPassword).subscribe({
      next: (res) => {
        this.loading = false;
        this.success = res.message;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Reset failed.';
      },
    });
  }
}
