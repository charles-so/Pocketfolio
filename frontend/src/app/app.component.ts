import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { ToastComponent } from './shared/components/toast/toast.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, ToastComponent],
  template: `
    @if (auth.isLoggedIn()) {
      <div class="flex min-h-screen bg-surface">
        <app-sidebar (collapsedChange)="sidebarCollapsed = $event" />
        <main class="flex-1 min-w-0 pt-14 md:pt-0">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <router-outlet />
          </div>
        </main>
      </div>
    } @else {
      <router-outlet />
    }
    <app-toast />
  `,
})
export class AppComponent {
  sidebarCollapsed = false;
  constructor(public auth: AuthService) {}
}
