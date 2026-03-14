export interface TransactionDto {
  id: number;
  envelopeId: number;
  amount: number;
  date: string;
  description: string;
  createdAt: string;
  envelopeName: string;
  groupName: string;
  rowType: 'txn' | 'bonus' | 'income';
  period?: number;
  periodLabel?: string;
  attachmentCount?: number;
  attachmentName?: string;
  status?: string;
}

export interface TransactionsResponse {
  transactions: TransactionDto[];
  envelopes: { id: number; name: string; groupName: string }[];
  groups: string[];
  totalCount: number;
  shownCount: number;
  currentPeriod: number;
  cycleStart: string;
  totalSpending: number;
  totalRefunds: number;
  totalIncome: number;
  totalBonuses: number;
}
