export interface WatchlistResponse {
  tickers: WatchlistTickerDto[];
}

export interface WatchlistTickerDto {
  ticker: string;
  name: string;
  price: number;
  previousClose: number;
  dailyChange: number;
  dailyChangePct: number;
  isHolding: boolean;
  watchlistItemId: number | null;
}

export interface TickerDetailsResponse {
  details: TickerDetailsDto;
}

export interface TickerDetailsDto {
  weekChangePct: number;
  monthChangePct: number;
  ytdChangePct: number;
  yearChangePct: number;
  dividendYield: number | null;
  trailingPE: number | null;
  marketCap: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  beta: number | null;
  currency: string;
  exchange: string;
}
