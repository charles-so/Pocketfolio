export interface AnalysisResponse {
  totalSpent: number;
  thisPeriodSpent: number;
  lastPeriodSpent: number;
  avgPerPeriod: number;
  transactionCount: number;
  totalIncome: number;
  thisPeriodIncome: number;
  lastPeriodIncome: number;
  avgIncomePerPeriod: number;
  byGroup: { groupName: string; total: number }[];
  incomeByType: { type: string; total: number }[];
  topEnvelopes: { id: number; name: string; groupName: string; total: number }[];
  trend: { period: number; label: string; total: number }[];
  incomeTrend: { period: number; label: string; total: number }[];
  budgetVsActual: { name: string; group: string; budget: number; actual: number }[];
  investmentSummary: { ticker: string; envelopeName: string; deposited: number; traded: number; cash: number }[];
}
