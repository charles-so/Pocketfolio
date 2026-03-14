export interface IncomeRecord {
  id: number;
  amount: number;
  date: string;
  type: 'Paycheck' | 'StockSale' | 'Bonus';
  description: string;
}
