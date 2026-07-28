import type { ClubFinance, FinanceLedgerEntry, LedgerEntryType, Currency } from '../types/Finance';
import { currencySymbol } from '../types/Finance';
import type { Player } from '../types/Player';

export function formatMoney(value: number, currency: Currency = 'BRL'): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  const symbol = currencySymbol(currency);

  if (abs >= 1_000_000_000) {
    return `${sign}${symbol} ${(abs / 1_000_000_000).toFixed(1).replace('.', ',')}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${symbol} ${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${symbol} ${(abs / 1_000).toFixed(0)}K`;
  }
  return `${sign}${symbol} ${abs.toLocaleString('pt-BR')}`;
}

export function formatMoneyFull(value: number, currency: Currency = 'BRL'): string {
  const symbol = currencySymbol(currency);
  return `${symbol} ${Math.abs(value).toLocaleString('pt-BR')}`;
}

export function wageBill(players: Player[]): number {
  return players.reduce((sum, p) => sum + (p.salary ?? 0), 0);
}

export function runwayMonths(finance: ClubFinance, players: Player[]): number {
  const bill = wageBill(players);
  if (bill <= 0) return Infinity;
  return Math.floor(finance.balance / bill);
}

export function newLedgerEntry(
  type: LedgerEntryType,
  amount: number,
  label: string,
  season: number,
  extras?: Partial<Pick<FinanceLedgerEntry, 'relatedPlayerId' | 'relatedTransferId' | 'matchId'>>,
): FinanceLedgerEntry {
  return {
    id: `ledger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: new Date().toISOString().slice(0, 10),
    season,
    type,
    amount,
    label,
    ...extras,
  };
}

export function ledgerEntryTypeLabel(type: LedgerEntryType): string {
  switch (type) {
    case 'wage': return 'Folha salarial';
    case 'prize': return 'Premiação';
    case 'transfer_fee': return 'Taxa de transferência';
    case 'loan_fee': return 'Taxa de empréstimo';
    case 'sponsor': return 'Patrocínio';
    case 'other_in': return 'Receita';
    case 'other_out': return 'Despesa';
    case 'adjustment': return 'Ajuste';
  }
}

export function isIncome(type: LedgerEntryType): boolean {
  return ['prize', 'transfer_fee', 'loan_fee', 'sponsor', 'other_in'].includes(type);
}

export function balanceFromLedger(initialBalance: number, ledger: FinanceLedgerEntry[]): number {
  return ledger.reduce((sum, e) => sum + e.amount, initialBalance);
}
