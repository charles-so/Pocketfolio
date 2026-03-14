import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminUser } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-slate-800">User Management</h1>
      </div>

      @if (message) {
        <div class="alert mb-4" [class.alert-success]="!isError" [class.alert-danger]="isError">
          {{ message }}
        </div>
      }

      <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Role</th>
                <th>Created</th>
                <th>Envelopes</th>
                <th>Transactions</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (user of users; track user.id) {
                <tr>
                  <td>{{ user.id }}</td>
                  <td><strong>{{ user.username }}</strong></td>
                  <td>
                    @if (user.isAdmin) {
                      <span class="badge bg-primary">Admin</span>
                    } @else {
                      <span class="badge bg-secondary">User</span>
                    }
                  </td>
                  <td>{{ user.createdAt | date:'mediumDate' }}</td>
                  <td>{{ user.envelopeCount }}</td>
                  <td>{{ user.transactionCount }}</td>
                  <td class="text-end">
                    <div class="btn-group btn-group-sm">
                      <button class="btn btn-outline-warning" (click)="openResetPassword(user)">Reset PW</button>
                      <button class="btn btn-outline-info" (click)="toggleAdmin(user)">
                        {{ user.isAdmin ? 'Demote' : 'Promote' }}
                      </button>
                      <button class="btn btn-outline-danger" (click)="confirmDelete(user)" [disabled]="user.isAdmin">Delete</button>
                    </div>
                  </td>
                </tr>

                @if (resetTarget?.id === user.id) {
                  <tr>
                    <td colspan="7">
                      <div class="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                        <span class="text-sm text-slate-500">New password for <strong>{{ user.username }}</strong>:</span>
                        <input type="password" class="form-control form-control-sm" style="max-width: 200px"
                          [(ngModel)]="newPassword" placeholder="Min 6 characters" />
                        <button class="btn btn-sm btn-warning" (click)="resetPassword()" [disabled]="newPassword.length < 6">Reset</button>
                        <button class="btn btn-sm btn-secondary" (click)="resetTarget = null">Cancel</button>
                      </div>
                    </td>
                  </tr>
                }

                @if (deleteTarget?.id === user.id) {
                  <tr>
                    <td colspan="7">
                      <div class="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                        <span class="text-sm text-over">Delete <strong>{{ user.username }}</strong> and all their data?</span>
                        <button class="btn btn-sm btn-danger" (click)="deleteUser()">Yes, Delete</button>
                        <button class="btn btn-sm btn-secondary" (click)="deleteTarget = null">Cancel</button>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>

      <p class="text-slate-400 text-sm mt-4">{{ users.length }} user(s) registered</p>
    </div>
  `,
})
export class AdminComponent implements OnInit {
  users: AdminUser[] = [];
  message = '';
  isError = false;
  resetTarget: AdminUser | null = null;
  deleteTarget: AdminUser | null = null;
  newPassword = '';

  constructor(private admin: AdminService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.admin.getUsers().subscribe({
      next: (users) => this.users = users,
      error: () => this.showMessage('Failed to load users.', true),
    });
  }

  openResetPassword(user: AdminUser): void {
    this.resetTarget = user;
    this.deleteTarget = null;
    this.newPassword = '';
  }

  resetPassword(): void {
    if (!this.resetTarget) return;
    this.admin.resetPassword(this.resetTarget.id, this.newPassword).subscribe({
      next: (res) => {
        this.showMessage(res.message, false);
        this.resetTarget = null;
        this.newPassword = '';
      },
      error: (err) => this.showMessage(err.error?.error || 'Reset failed.', true),
    });
  }

  toggleAdmin(user: AdminUser): void {
    this.admin.toggleAdmin(user.id).subscribe({
      next: (res) => {
        this.showMessage(res.message, false);
        user.isAdmin = res.isAdmin;
      },
      error: (err) => this.showMessage(err.error?.error || 'Failed.', true),
    });
  }

  confirmDelete(user: AdminUser): void {
    this.deleteTarget = user;
    this.resetTarget = null;
  }

  deleteUser(): void {
    if (!this.deleteTarget) return;
    this.admin.deleteUser(this.deleteTarget.id).subscribe({
      next: (res) => {
        this.showMessage(res.message, false);
        this.deleteTarget = null;
        this.loadUsers();
      },
      error: (err) => this.showMessage(err.error?.error || 'Delete failed.', true),
    });
  }

  private showMessage(msg: string, error: boolean): void {
    this.message = msg;
    this.isError = error;
    setTimeout(() => this.message = '', 4000);
  }
}
