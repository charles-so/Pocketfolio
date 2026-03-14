export interface PortfolioResponse {
  holdings: HoldingDto[];
  totalValue: number;
  totalCost: number;
  totalDividendsYtd: number;
  dailyChange: number;
  dailyChangePct: number;
}

export interface HoldingDto {
  id: number;
  ticker: string;
  name: string;
  shares: number;
  costBasis: number;
  price: number;
  previousClose: number;
  dailyChange: number;
  dailyChangePct: number;
}

export interface PortfolioHistoryResponse {
  history: { date: string; value: number }[];
}

export interface SellHoldingRequest {
  holdingId: number;
  shares: number;
  price: number;
  fees: number;
}

export interface SellHoldingResponse {
  ok: boolean;
  proceeds: number;
  gain: number;
}
