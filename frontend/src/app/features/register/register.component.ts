import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div class="text-center mb-6">
          <img src="money-pouch.png" alt="Pocketfolio" width="80" height="80" class="mx-auto mb-3">
          <h2 class="text-2xl font-bold text-slate-800">Pocketfolio</h2>
          <p class="text-sm text-slate-500 mt-1">Create your account</p>
        </div>
        @if (error) {
          <div class="alert alert-danger py-2 mb-4">{{ error }}</div>
        }
        <form (ngSubmit)="onSubmit()">
          <div class="mb-4">
            <label class="form-label">Username</label>
            <input type="text" class="form-control" [(ngModel)]="username" name="username" required autofocus />
          </div>
          <div class="mb-4">
            <label class="form-label">Password</label>
            <input type="password" class="form-control" [(ngModel)]="password" name="password" required />
          </div>
          <div class="mb-4">
            <label class="form-label">Confirm Password</label>
            <input type="password" class="form-control" [(ngModel)]="confirmPassword" name="confirmPassword" required />
          </div>
          <button type="submit" class="btn btn-primary w-full py-2.5" [disabled]="loading">
            {{ loading ? 'Creating account...' : 'Create Account' }}
          </button>
        </form>
        <p class="text-center mt-4 text-sm text-slate-500">
          Already have an account? <a routerLink="/login" class="text-brand-500 hover:text-brand-700 font-medium">Sign in</a>
        </p>
      </div>
    </div>
  `,
})
export class RegisterComponent {
  username = '';
  password = '';
  confirmPassword = '';
  error = '';
  loading = false;

  constructor(public auth: AuthService, private router: Router) {}

  onSubmit(): void {
    this.error = '';
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }
    if (this.password.length < 6) {
      this.error = 'Password must be at least 6 characters.';
      return;
    }
    this.loading = true;
    this.auth.register(this.username, this.password).subscribe({
      next: () => this.router.navigate([this.auth.getHomePath()]),
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Registration failed.';
      },
    });
  }
}
