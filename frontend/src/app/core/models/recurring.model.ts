export interface RecurringItem {
  id: number;
  type: 'Income' | 'Expense';
  amount: number;
  description: string;
  envelopeId: number | null;
  envelopeName: string | null;
  envelopeGroupName: string | null;
  incomeType: string | null;
  startDate: string;
  frequency: string;
  active: boolean;
  lastAppliedDate: string | null;
  nextDate: string | null;
}

export interface PendingRecurringItem {
  recurringItemId: number;
  type: 'Income' | 'Expense';
  amount: number;
  description: string;
  envelopeId: number | null;
  envelopeName: string | null;
  incomeType: string | null;
  dueDate: string;
  frequency: string;
}
