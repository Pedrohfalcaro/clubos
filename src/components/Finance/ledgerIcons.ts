import type { LedgerEntryType } from '../../types/Finance';

/**
 * Ícone por tipo de lançamento (Extrato V2 — spec §3.3). `Record` completo força o
 * TypeScript a barrar o build se um `LedgerEntryType` novo ficar sem ícone.
 * Compartilhado entre o Extrato e o ranking de maiores lançamentos.
 */
export const LEDGER_ICON: Record<LedgerEntryType, string> = {
  ticket: '🎟️',
  travel: '✈️',
  stadium_ops: '🏟️',
  wage: '💼',
  prize: '🏆',
  sponsor: '📄',
  transfer_fee: '🤝',
  loan_fee: '🤝',
  loan_credit: '🏦',
  loan_repay: '🏦',
  debt_repay: '⚠️',
  other_in: '➕',
  other_out: '➖',
  adjustment: '⚙️',
};
