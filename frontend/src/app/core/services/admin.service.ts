import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminUser {
  id: number;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  envelopeCount: number;
  transactionCount: number;
}

export interface AdminUserDetail {
  id: number;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  stats: {
    envelopes: number;
    transactions: number;
    incomes: number;
    holdings: number;
    trades: number;
  };
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly url = environment.apiUrl + '/api/admin';

  constructor(private http: HttpClient) {}

  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(this.url + '/users');
  }

  getUser(id: number): Observable<AdminUserDetail> {
    return this.http.get<AdminUserDetail>(this.url + '/users/' + id);
  }

  resetPassword(id: number, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(this.url + '/users/' + id + '/reset-password', { newPassword });
  }

  toggleAdmin(id: number): Observable<{ message: string; isAdmin: boolean }> {
    return this.http.post<{ message: string; isAdmin: boolean }>(this.url + '/users/' + id + '/toggle-admin', {});
  }

  deleteUser(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(this.url + '/users/' + id);
  }
}
