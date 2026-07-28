export type LedgerEntryType =
  | 'wage'
  | 'prize'
  | 'transfer_fee'
  | 'loan_fee'
  | 'sponsor'
  | 'other_in'
  | 'other_out'
  | 'adjustment';

export interface FinanceLedgerEntry {
  id: string;
  date: string; // ISO date string
  season: number;
  type: LedgerEntryType;
  /** Positive = income, negative = expense */
  amount: number;
  label: string;
  relatedPlayerId?: string;
  relatedTransferId?: string;
  matchId?: string;
}

export type Currency = 'BRL' | 'EUR' | 'GBP' | 'USD';

export const CURRENCIES: { code: Currency; symbol: string; label: string }[] = [
  { code: 'BRL', symbol: 'R$', label: 'Real (R$)' },
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'GBP', symbol: '£', label: 'Libra (£)' },
  { code: 'USD', symbol: '$', label: 'Dólar (US$)' },
];

export function currencySymbol(currency: Currency): string {
  return CURRENCIES.find(c => c.code === currency)?.symbol ?? 'R$';
}

export function currencyLabel(currency: Currency): string {
  return CURRENCIES.find(c => c.code === currency)?.label ?? currency;
}

export interface PrizeTableEntry {
  win?: number;
  draw?: number;
  knockout?: number;
  champion?: number;
}

export interface ClubFinance {
  balance: number;
  currency: Currency;
  /** keyed by competition name */
  prizeTable: Record<string, PrizeTableEntry>;
  ledger: FinanceLedgerEntry[];
}

export function createDefaultFinance(initialBudget = 5_000_000): ClubFinance {
  return {
    balance: initialBudget,
    currency: 'BRL',
    prizeTable: {},
    ledger: [],
  };
}
