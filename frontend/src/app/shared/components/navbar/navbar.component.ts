import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
      <div class="container-fluid">
        <a class="navbar-brand d-flex align-items-center" [routerLink]="auth.getHomePath()">
          <img src="money-pouch.png" alt="Pocketfolio" width="28" height="28" class="me-2">
          Pocketfolio
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav">
            @if (auth.isAdmin()) {
              <li class="nav-item">
                <a class="nav-link" routerLink="/admin" routerLinkActive="active">Users</a>
              </li>
            } @else {
              @for (link of links; track link.path) {
                <li class="nav-item">
                  <a class="nav-link" [routerLink]="link.path" routerLinkActive="active">{{ link.label }}</a>
                </li>
              }
            }
          </ul>
          <ul class="navbar-nav ms-auto">
            <li class="nav-item">
              <span class="nav-link text-light">{{ auth.getUsername() }}</span>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="javascript:void(0)" (click)="auth.logout()">Logout</a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  `,
})
export class NavbarComponent {
  links = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/transactions', label: 'Transactions' },
    { path: '/analysis', label: 'Analysis' },
    { path: '/settings', label: 'Settings' },
  ];

  constructor(public auth: AuthService) {}
}
