import { IncomeRecord } from './income.model';

export interface DashboardResponse {
  period: number;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  totalBudget: number;
  totalSpent: number;
  totalAvailable: number;
  groups: EnvelopeGroup[];
  investments: InvestmentsSummary;
  income: IncomeSummary;
}

export interface IncomeSummary {
  periodIncome: number;
  cumulativeIncome: number;
  remaining: number;
  cumulativeRemaining: number;
  records: IncomeRecord[];
}

export interface EnvelopeGroup {
  name: string;
  budgetFn: number;
  spent: number;
  available: number;
  envelopes: EnvelopeStatus[];
}

export interface EnvelopeStatus {
  id: number;
  name: string;
  budgetFn: number;
  spent: number;
  rollover: number;
  available: number;
  bonus: number;
  ticker: string | null;
  groupName: string;
  investmentCash?: number;
}

export interface InvestmentsSummary {
  totalBudgetFn: number;
  totalRollover: number;
  totalDeposited: number;
  totalCashToInvest: number;
  envelopes: InvestmentEnvelope[];
}

export interface InvestmentEnvelope {
  id: number;
  name: string;
  ticker: string | null;
  budgetFn: number;
  cumulativeBudget: number;
  rollover: number;
  deposited: number;
  cashToInvest: number;
  bonus: number;
}

export interface EnvelopeDetailResponse {
  id: number;
  name: string;
  groupName: string;
  budgetFn: number;
  ticker: string | null;
  stats: EnvelopeStats;
  transactions: EnvelopeTransaction[];
}

export interface EnvelopeStats {
  totalSpent: number;
  avgPerPeriod: number;
  avgPerTransaction: number;
  transactionCount: number;
  currentPeriodSpent: number;
  lastPeriodSpent: number;
  highest: { amount: number; description: string; date: string } | null;
  lowest: { amount: number; description: string; date: string } | null;
}

export interface EnvelopeTransaction {
  id: number;
  date: string;
  amount: number;
  description: string;
  attachmentCount: number;
  attachmentName: string | null;
}
