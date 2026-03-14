import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./features/register/register.component').then(m => m.RegisterComponent) },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'transactions',
    canActivate: [authGuard],
    loadComponent: () => import('./features/transactions/transactions-wrapper.component').then(m => m.TransactionsWrapperComponent),
  },
  {
    path: 'analysis',
    canActivate: [authGuard],
    loadComponent: () => import('./features/analysis/analysis-wrapper.component').then(m => m.AnalysisWrapperComponent),
  },
  {
    path: 'envelope/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/envelope-detail/envelope-detail.component').then(m => m.EnvelopeDetailComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
  },
];
