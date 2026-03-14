import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <!-- Mobile top bar -->
    <div class="md:hidden fixed top-0 left-0 right-0 z-30 bg-sidebar h-14 flex items-center px-4 justify-between">
      <div class="flex items-center gap-2">
        <img src="money-pouch.png" alt="Pocketfolio" width="28" height="28">
        <span class="text-white font-semibold text-lg">Pocketfolio</span>
      </div>
      <button class="text-white p-2" (click)="mobileOpen = !mobileOpen">
        <i class="bi" [class.bi-list]="!mobileOpen" [class.bi-x-lg]="mobileOpen" style="font-size:1.25rem"></i>
      </button>
    </div>

    <!-- Mobile backdrop -->
    @if (mobileOpen) {
      <div class="md:hidden fixed inset-0 bg-black/40 z-30" (click)="mobileOpen = false"></div>
    }

    <!-- Sidebar -->
    <aside [class]="sidebarClass">
      <!-- Logo (desktop only) -->
      <div class="hidden md:flex items-center py-5"
           [class.justify-center]="collapsed" [class.px-5]="!collapsed" [class.gap-3]="!collapsed">
        <img src="money-pouch.png" alt="Pocketfolio" width="32" height="32" class="shrink-0">
        @if (!collapsed) {
          <span class="text-white font-bold text-lg tracking-tight">Pocketfolio</span>
        }
      </div>

      <!-- Mobile logo -->
      <div class="md:hidden flex items-center gap-3 px-5 py-5">
        <img src="money-pouch.png" alt="Pocketfolio" width="32" height="32">
        <span class="text-white font-bold text-lg tracking-tight">Pocketfolio</span>
      </div>

      <!-- Nav links -->
      <nav class="flex-1 space-y-1 mt-2" [class.px-3]="!collapsed || mobileOpen" [class.px-2]="collapsed && !mobileOpen">
        @if (auth.isAdmin()) {
          <a routerLink="/admin" routerLinkActive="bg-sidebar-hover text-white"
             class="nav-link-item" [class.justify-center]="collapsed && !mobileOpen" (click)="closeMobile()">
            <i class="bi bi-people text-lg w-6 text-center shrink-0"></i>
            @if (!collapsed || mobileOpen) { <span>Users</span> }
          </a>
        } @else {
          @for (link of links; track link.path) {
            <a [routerLink]="link.path" routerLinkActive="bg-sidebar-hover text-white"
               class="nav-link-item" [class.justify-center]="collapsed && !mobileOpen"
               [attr.title]="collapsed && !mobileOpen ? link.label : null" (click)="closeMobile()">
              <i class="bi text-lg w-6 text-center shrink-0" [class]="link.icon"></i>
              @if (!collapsed || mobileOpen) { <span>{{ link.label }}</span> }
            </a>
          }
        }
      </nav>

      <!-- Collapse toggle (desktop only) -->
      <div class="hidden md:block mb-2" [class.px-3]="!collapsed" [class.px-2]="collapsed">
        <button class="nav-link-item w-full justify-center" (click)="toggleCollapse()">
          <i class="bi text-lg" [class.bi-chevron-left]="!collapsed" [class.bi-chevron-right]="collapsed"></i>
        </button>
      </div>

      <!-- User info -->
      <div class="pb-4 border-t border-white/10 pt-3" [class.px-3]="!collapsed || mobileOpen" [class.px-2]="collapsed && !mobileOpen">
        @if (collapsed && !mobileOpen) {
          <!-- Collapsed: just centered avatar with logout on click -->
          <div class="flex justify-center">
            <button class="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-bold hover:bg-brand-600 transition-colors"
                    (click)="auth.logout()" title="Logout">
              {{ auth.getUsername()?.charAt(0)?.toUpperCase() }}
            </button>
          </div>
        } @else {
          <!-- Expanded: avatar + name + logout button -->
          <div class="flex items-center gap-3 px-3">
            <div class="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {{ auth.getUsername()?.charAt(0)?.toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-white text-sm font-medium truncate">{{ auth.getUsername() }}</div>
            </div>
            <button class="text-slate-400 hover:text-white transition-colors" (click)="auth.logout()" title="Logout">
              <i class="bi bi-box-arrow-right text-lg"></i>
            </button>
          </div>
        }
      </div>
    </aside>
  `,
  styles: [`
    :host { display: contents; }
    .nav-link-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      color: #94a3b8;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 150ms;
      text-decoration: none;
      cursor: pointer;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
    }
    .nav-link-item:hover {
      background-color: #334155;
      color: #fff;
    }
  `]
})
export class SidebarComponent {
  @Output() collapsedChange = new EventEmitter<boolean>();

  collapsed = false;
  mobileOpen = false;

  links = [
    { path: '/dashboard', label: 'Dashboard', icon: 'bi-grid-1x2' },
    { path: '/transactions', label: 'Transactions', icon: 'bi-receipt' },
    { path: '/analysis', label: 'Analysis', icon: 'bi-bar-chart-line' },
    { path: '/settings', label: 'Settings', icon: 'bi-gear' },
  ];

  constructor(public auth: AuthService) {}

  get sidebarClass(): string {
    const base = 'flex flex-col bg-sidebar h-screen overflow-y-auto z-40 transition-all duration-200';
    // Mobile: slide from left
    if (this.mobileOpen) {
      return `${base} fixed top-0 left-0 w-64 md:sticky md:top-0`;
    }
    // Desktop: sticky sidebar
    return `${base} fixed top-0 left-0 -translate-x-full md:translate-x-0 md:sticky md:top-0 ${this.collapsed ? 'md:w-16' : 'md:w-64'}`;
  }

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    this.collapsedChange.emit(this.collapsed);
  }

  closeMobile(): void {
    this.mobileOpen = false;
  }
}
