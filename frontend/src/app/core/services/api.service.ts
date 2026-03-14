import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CacheService } from './cache.service';
import { DashboardResponse } from '../models/dashboard.model';
import { TransactionsResponse } from '../models/transaction.model';
import { PortfolioResponse, PortfolioHistoryResponse, SellHoldingRequest, SellHoldingResponse } from '../models/portfolio.model';
import { TradesResponse } from '../models/trade.model';
import { AnalysisResponse } from '../models/analysis.model';
import { WatchlistResponse, TickerDetailsResponse } from '../models/watchlist.model';
import { RecurringItem, PendingRecurringItem } from '../models/recurring.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient, private cache: CacheService) {}

  // Dashboard
  getDashboard(period?: number, date?: string): Observable<DashboardResponse> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    else if (period != null) params = params.set('period', period);
    const key = `dashboard:${period || 'current'}:${date || ''}`;
    const cached = this.cache.get<DashboardResponse>(key);
    if (cached) return of(cached);
    return this.http.get<DashboardResponse>(`${this.url}/api/dashboard`, { params }).pipe(
      tap(data => this.cache.set(key, data, 'dashboard'))
    );
  }

  // Transactions
  getTransactions(filters: { envelope_id?: number; group_name?: string; recurring_item_id?: number; date_from?: string; date_to?: string; limit?: number }): Observable<TransactionsResponse> {
    let params = new HttpParams();
    if (filters.envelope_id) params = params.set('envelope_id', filters.envelope_id);
    if (filters.group_name) params = params.set('group_name', filters.group_name);
    if (filters.recurring_item_id) params = params.set('recurring_item_id', filters.recurring_item_id);
    if (filters.date_from) params = params.set('date_from', filters.date_from);
    if (filters.date_to) params = params.set('date_to', filters.date_to);
    if (filters.limit) params = params.set('limit', filters.limit);
    const key = `transactions:${JSON.stringify(filters)}`;
    const cached = this.cache.get<TransactionsResponse>(key);
    if (cached) return of(cached);
    return this.http.get<TransactionsResponse>(`${this.url}/api/transactions`, { params }).pipe(
      tap(data => this.cache.set(key, data, 'transactions'))
    );
  }

  createTransaction(data: { date: string; envelopeId: number; amount: number; description: string }): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.url}/api/transactions`, data).pipe(tap(() => this.cache.invalidateFinancial()));
  }

  updateTransaction(id: number, data: { date: string; envelopeId: number; amount: number; description: string }): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.url}/api/transactions/${id}`, data).pipe(tap(() => this.cache.invalidateFinancial()));
  }

  deleteTransaction(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.url}/api/transactions/${id}`).pipe(tap(() => this.cache.invalidateFinancial()));
  }

  // Bonuses
  createBonus(data: { envelopeId: number; amount: number; period: number; description: string }): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.url}/api/bonus`, data).pipe(tap(() => this.cache.invalidateFinancial()));
  }

  updateBonus(id: number, data: { amount: number; description: string }): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.url}/api/bonus/${id}`, data).pipe(tap(() => this.cache.invalidateFinancial()));
  }

  deleteBonus(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.url}/api/bonus/${id}`).pipe(tap(() => this.cache.invalidateFinancial()));
  }

  // Envelopes
  createEnvelope(data: { name: string; groupName: string; budgetFn: number; ticker?: string }): Observable<{ ok: boolean; id: number }> {
    return this.http.post<{ ok: boolean; id: number }>(`${this.url}/api/envelopes`, data).pipe(tap(() => this.cache.invalidateFinancial()));
  }

  updateEnvelope(id: number, data: { name: string; groupName: string }): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.url}/api/envelopes/${id}`, data).pipe(tap(() => this.cache.invalidateFinancial()));
  }

  deleteEnvelope(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.url}/api/envelopes/${id}`).pipe(tap(() => this.cache.invalidateFinancial()));
  }

  updateBudget(id: number, budgetFn: number): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.url}/api/envelopes/${id}/budget`, { budgetFn }).pipe(tap(() => this.cache.invalidateFinancial()));
  }

  getTransactionCount(id: number): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.url}/api/envelopes/${id}/transaction_count`);
  }

  // Settings
  saveSettings(data: { payCycleStart: string }): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.url}/api/settings`, data).pipe(tap(() => this.cache.invalidateAll()));
  }

  // Tickers
  searchTickers(q: string): Observable<{ results: { ticker: string; name: string; exchange: string }[] }> {
    const key = `tickers:${q}`;
    const cached = this.cache.get<{ results: { ticker: string; name: string; exchange: string }[] }>(key);
    if (cached) return of(cached);
    return this.http.get<{ results: { ticker: string; name: string; exchange: string }[] }>(`${this.url}/api/tickers/search`, { params: { q } }).pipe(
      tap(data => this.cache.set(key, data, 'tickers'))
    );
  }


  getPrice(ticker: string): Observable<{ ticker: string; price: number; currency: string }> {
    return this.http.get<{ ticker: string; price: number; currency: string }>(`${this.url}/api/price/${ticker}`);
  }

  // Trades
  createTrade(data: { envelopeId: number; date: string; shares: number; price: number; fees: number }): Observable<{ ok: boolean; totalCost: number }> {
    return this.http.post<{ ok: boolean; totalCost: number }>(`${this.url}/api/trade`, data).pipe(tap(() => { this.cache.invalidateFinancial(); this.cache.invalidatePrefix('portfolio'); }));
  }

  getTrades(ticker?: string): Observable<TradesResponse> {
    let params: any = {};
    if (ticker) params.ticker = ticker;
    return this.http.get<TradesResponse>(`${this.url}/api/trades`, { params });
  }

  updateTrade(id: number, data: { date: string; shares: number; price: number; fees: number }): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.url}/api/trades/${id}`, data).pipe(tap(() => { this.cache.invalidateFinancial(); this.cache.invalidatePrefix('portfolio'); }));
  }

  deleteTrade(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.url}/api/trades/${id}`).pipe(tap(() => { this.cache.invalidateFinancial(); this.cache.invalidatePrefix('portfolio'); }));
  }

  // Analysis
  getAnalysis(periods = 6, filters: { envelope_id?: number; group_name?: string; date_from?: string; date_to?: string } = {}): Observable<AnalysisResponse> {
    let params = new HttpParams().set('periods', periods);
    if (filters.envelope_id) params = params.set('envelope_id', filters.envelope_id);
    if (filters.group_name) params = params.set('group_name', filters.group_name);
    if (filters.date_from) params = params.set('date_from', filters.date_from);
    if (filters.date_to) params = params.set('date_to', filters.date_to);
    const key = `analysis:${periods}:${JSON.stringify(filters)}`;
    const cached = this.cache.get<AnalysisResponse>(key);
    if (cached) return of(cached);
    return this.http.get<AnalysisResponse>(`${this.url}/api/analysis`, { params }).pipe(
      tap(data => this.cache.set(key, data, 'analysis'))
    );
  }

  // Investment Calculator
  getInvestmentProjection(): Observable<any> {
    return this.http.get(`${this.url}/api/analysis/investment-projection`);
  }

  // Portfolio
  getPortfolio(refresh = false): Observable<PortfolioResponse> {
    if (!refresh) {
      const cached = this.cache.get<PortfolioResponse>('portfolio');
      if (cached) return of(cached);
    }
    return this.http.get<PortfolioResponse>(`${this.url}/api/portfolio`, { params: { refresh: refresh ? '1' : '0' } }).pipe(
      tap(data => this.cache.set('portfolio', data, 'portfolio'))
    );
  }

  getPortfolioHistory(period = '6mo'): Observable<PortfolioHistoryResponse> {
    return this.http.get<PortfolioHistoryResponse>(`${this.url}/api/portfolio/history`, { params: { period } });
  }

  createHolding(data: { ticker: string; name: string; shares: number; costBasis: number }): Observable<{ ok: boolean; id: number }> {
    return this.http.post<{ ok: boolean; id: number }>(`${this.url}/api/portfolio/holdings`, data);
  }

  updateHolding(id: number, data: { ticker?: string; name?: string; shares?: number; costBasis?: number }): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.url}/api/portfolio/holdings/${id}`, data);
  }

  deleteHolding(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.url}/api/portfolio/holdings/${id}`);
  }

  sellHolding(data: SellHoldingRequest): Observable<SellHoldingResponse> {
    return this.http.post<SellHoldingResponse>(`${this.url}/api/portfolio/sell`, data).pipe(tap(() => { this.cache.invalidateFinancial(); this.cache.invalidatePrefix('portfolio'); }));
  }

  // Income
  createIncome(data: { date: string; amount: number; type: string; description: string }): Observable<{ ok: boolean; id: number }> {
    return this.http.post<{ ok: boolean; id: number }>(`${this.url}/api/income`, data).pipe(tap(() => this.cache.invalidateFinancial()));
  }

  updateIncome(id: number, data: { date: string; amount: number; type: string; description: string }): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.url}/api/income/${id}`, data).pipe(tap(() => this.cache.invalidateFinancial()));
  }

  deleteIncome(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.url}/api/income/${id}`).pipe(tap(() => this.cache.invalidateFinancial()));
  }

  // Watchlist
  getWatchlist(refresh = false): Observable<WatchlistResponse> {
    if (!refresh) {
      const cached = this.cache.get<WatchlistResponse>('watchlist');
      if (cached) return of(cached);
    }
    return this.http.get<WatchlistResponse>(`${this.url}/api/watchlist`, { params: { refresh: refresh ? '1' : '0' } }).pipe(
      tap(data => this.cache.set('watchlist', data, 'watchlist'))
    );
  }

  getWatchlistHistory(ticker: string, period = '6mo'): Observable<PortfolioHistoryResponse> {
    return this.http.get<PortfolioHistoryResponse>(`${this.url}/api/watchlist/history/${ticker}`, { params: { period } });
  }

  addWatchlistItem(data: { ticker: string; name?: string }): Observable<{ ok: boolean; id: number }> {
    return this.http.post<{ ok: boolean; id: number }>(`${this.url}/api/watchlist`, data);
  }

  removeWatchlistItem(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.url}/api/watchlist/${id}`);
  }

  getWatchlistDetails(ticker: string): Observable<TickerDetailsResponse> {
    return this.http.get<TickerDetailsResponse>(`${this.url}/api/watchlist/details/${ticker}`);
  }

  // Recurring Items
  getRecurringItems(): Observable<{ items: RecurringItem[] }> {
    return this.http.get<{ items: RecurringItem[] }>(`${this.url}/api/recurring`);
  }

  createRecurring(data: { type: string; amount: number; description: string; envelopeId?: number; incomeType?: string; startDate: string; frequency: string }): Observable<{ ok: boolean; id: number }> {
    return this.http.post<{ ok: boolean; id: number }>(`${this.url}/api/recurring`, data);
  }

  updateRecurring(id: number, data: { amount: number; description?: string; envelopeId?: number; incomeType?: string; frequency: string }): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.url}/api/recurring/${id}`, data);
  }

  toggleRecurring(id: number): Observable<{ ok: boolean; active: boolean }> {
    return this.http.put<{ ok: boolean; active: boolean }>(`${this.url}/api/recurring/${id}/toggle`, {});
  }

  deleteRecurring(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.url}/api/recurring/${id}`);
  }

  // Attachments (generic: entityType = 'txn' | 'income' | 'bonus')
  uploadAttachment(entityId: number, file: File, entityType = 'txn'): Observable<{ ok: boolean; id: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const params = new HttpParams().set('entityType', entityType).set('entityId', entityId);
    return this.http.post<{ ok: boolean; id: number }>(`${this.url}/api/attachments/upload`, formData, { params });
  }

  getAttachments(entityId: number, entityType = 'txn'): Observable<{ attachments: { id: number; fileName: string; contentType: string; size: number }[] }> {
    const params = new HttpParams().set('entityType', entityType).set('entityId', entityId);
    return this.http.get<{ attachments: { id: number; fileName: string; contentType: string; size: number }[] }>(`${this.url}/api/attachments`, { params });
  }

  deleteAttachment(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.url}/api/attachments/${id}`);
  }

  getAttachmentUrl(id: number): string {
    return `${this.url}/api/attachments/${id}`;
  }

  downloadAttachment(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/api/attachments/${id}`, { responseType: 'blob' });
  }

  getEnvelopeDetail(id: number): Observable<any> {
    return this.http.get(`${this.url}/api/envelopes/${id}/details`);
  }

  applyRecurring(): Observable<{ ok: boolean; applied: number }> {
    return this.http.post<{ ok: boolean; applied: number }>(`${this.url}/api/recurring/apply`, {}).pipe(tap(() => this.cache.invalidateFinancial()));
  }

  // Recurring - Pending / Confirm / Skip
  getPendingRecurring(): Observable<{ items: PendingRecurringItem[] }> {
    return this.http.get<{ items: PendingRecurringItem[] }>(`${this.url}/api/recurring/pending`);
  }

  confirmRecurring(data: { recurringItemId: number; dueDate: string }): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.url}/api/recurring/confirm`, data).pipe(tap(() => this.cache.invalidateFinancial()));
  }

  skipRecurring(data: { recurringItemId: number; dueDate: string }): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.url}/api/recurring/skip`, data).pipe(tap(() => this.cache.invalidateFinancial()));
  }

  confirmAllRecurring(): Observable<{ ok: boolean; applied: number }> {
    return this.http.post<{ ok: boolean; applied: number }>(`${this.url}/api/recurring/confirm-all`, {}).pipe(tap(() => this.cache.invalidateFinancial()));
  }
}
