import { Injectable } from '@angular/core';

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

@Injectable({ providedIn: 'root' })
export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();

  private readonly TTL: Record<string, number> = {
    dashboard: 5 * 60 * 1000,
    transactions: 2 * 60 * 1000,
    analysis: 10 * 60 * 1000,
    portfolio: 5 * 60 * 1000,
    watchlist: 5 * 60 * 1000,
    tickers: 60 * 60 * 1000,
  };

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, category: string): void {
    const ttl = this.TTL[category] || 5 * 60 * 1000;
    this.cache.set(key, { data, expiry: Date.now() + ttl });
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  invalidateFinancial(): void {
    this.invalidatePrefix('dashboard');
    this.invalidatePrefix('transactions');
    this.invalidatePrefix('analysis');
  }
}
