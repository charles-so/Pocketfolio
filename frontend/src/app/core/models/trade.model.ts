export interface TradeDto {
  id: number;
  envelopeId: number;
  holdingId: number;
  date: string;
  shares: number;
  price: number;
  fees: number;
  totalCost: number;
  envelopeName: string;
  ticker: string;
}

export interface InvestmentSummary {
  envelopeId: number;
  ticker: string;
  envelopeName: string;
  deposited: number;
  traded: number;
  cash: number;
}

export interface TradesResponse {
  trades: TradeDto[];
  investmentSummary: InvestmentSummary[];
}
