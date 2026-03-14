import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

interface AuthResponse {
  token: string;
  username: string;
  isAdmin: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly url = environment.apiUrl;
  private loggedIn$ = new BehaviorSubject<boolean>(this.hasToken());

  isAuthenticated$ = this.loggedIn$.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  private hasToken(): boolean {
    return !!localStorage.getItem('token');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getUsername(): string | null {
    return localStorage.getItem('username');
  }

  isLoggedIn(): boolean {
    return this.hasToken();
  }

  isAdmin(): boolean {
    return localStorage.getItem('isAdmin') === 'true';
  }

  getHomePath(): string {
    return this.isAdmin() ? '/admin' : '/dashboard';
  }

  register(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.url + '/api/auth/register', { username, password }).pipe(
      tap(res => this.setSession(res))
    );
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.url + '/api/auth/login', { username, password }).pipe(
      tap(res => this.setSession(res))
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(this.url + '/api/auth/change-password', { currentPassword, newPassword });
  }

  masterResetPassword(masterKey: string, username: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(this.url + '/api/auth/master-reset-password', { masterKey, username, newPassword });
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('isAdmin');
    this.loggedIn$.next(false);
    window.location.href = '/login';
  }

  private setSession(res: AuthResponse): void {
    localStorage.setItem('token', res.token);
    localStorage.setItem('username', res.username);
    localStorage.setItem('isAdmin', String(res.isAdmin));
    this.loggedIn$.next(true);
  }
}
