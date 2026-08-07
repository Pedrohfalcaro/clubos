import type { ClubFinance, FinanceLedgerEntry, LedgerEntryType } from '../types/Finance';
import type { Player } from '../types/Player';
import { wageBill } from './finance';

/** `YYYY-MM` */
export type MonthKey = string;

export interface MonthlyCashFlowPoint {
  month: MonthKey;
  income: number;
  /** Valor positivo representando o total de despesas do mês. */
  expense: number;
}

export type ExpenseCategoryGroup = 'payroll' | 'stadium_travel' | 'loans_debts' | 'transfers' | 'other';

export interface CategoryBreakdownEntry {
  group: ExpenseCategoryGroup;
  /** Valor positivo. */
  total: number;
}

export interface CategoryBreakdown {
  monthKey: MonthKey;
  groups: CategoryBreakdownEntry[];
  /** Soma de todos os grupos — usado pelo teto de gastos (Fase 4). */
  total: number;
}

export interface CashFlowProjectionPoint {
  month: MonthKey;
  projectedIncome: number;
  projectedExpense: number;
}

const CATEGORY_GROUP_BY_TYPE: Partial<Record<LedgerEntryType, ExpenseCategoryGroup>> = {
  wage: 'payroll',
  stadium_ops: 'stadium_travel',
  travel: 'stadium_travel',
  loan_repay: 'loans_debts',
  debt_repay: 'loans_debts',
  transfer_fee: 'transfers',
  loan_fee: 'transfers',
  other_out: 'other',
  adjustment: 'other',
};

const EXPENSE_CATEGORY_GROUPS: ExpenseCategoryGroup[] = [
  'payroll',
  'stadium_travel',
  'loans_debts',
  'transfers',
  'other',
];

export function monthKeyFromDate(date: string): MonthKey {
  return date.slice(0, 7);
}

export function addMonths(monthKey: MonthKey, delta: number): MonthKey {
  const [year, month] = monthKey.split('-').map(Number);
  const total = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

export function latestLedgerMonthKey(ledger: FinanceLedgerEntry[]): MonthKey | null {
  if (!ledger.length) return null;
  const latestDate = ledger.reduce((max, e) => (e.date > max ? e.date : max), ledger[0].date);
  return monthKeyFromDate(latestDate);
}

/**
 * Agrega o ledger em `months` pontos mensais (mais antigo primeiro), ancorados em
 * `currentDate`. Sem `currentDate` (carreira sem LiveLife), ancora na entrada mais
 * recente do ledger; sem ledger nenhum, não há em que ancorar e retorna `[]`.
 */
export function getMonthlyCashFlow(
  ledger: FinanceLedgerEntry[],
  currentDate: string | null,
  months = 6,
): MonthlyCashFlowPoint[] {
  const anchorMonth = currentDate ? monthKeyFromDate(currentDate) : latestLedgerMonthKey(ledger);
  if (!anchorMonth) return [];

  const monthKeys = Array.from({ length: months }, (_, i) => addMonths(anchorMonth, i - (months - 1)));
  const totals = new Map<MonthKey, { income: number; expense: number }>(
    monthKeys.map(m => [m, { income: 0, expense: 0 }]),
  );

  for (const entry of ledger) {
    const bucket = totals.get(monthKeyFromDate(entry.date));
    if (!bucket) continue;
    if (entry.amount >= 0) bucket.income += entry.amount;
    else bucket.expense += Math.abs(entry.amount);
  }

  return monthKeys.map(month => ({ month, ...totals.get(month)! }));
}

/**
 * Soma um conjunto qualquer de lançamentos por grupo de categoria de despesa. Só
 * considera `amount < 0` — receitas não entram no breakdown de gastos. Não filtra
 * por data: quem chama decide o recorte (um mês, um período, a temporada inteira).
 */
export function sumExpensesByCategory(entries: FinanceLedgerEntry[]): CategoryBreakdownEntry[] {
  const totals: Record<ExpenseCategoryGroup, number> = {
    payroll: 0,
    stadium_travel: 0,
    loans_debts: 0,
    transfers: 0,
    other: 0,
  };

  for (const entry of entries) {
    if (entry.amount >= 0) continue;
    const group = CATEGORY_GROUP_BY_TYPE[entry.type] ?? 'other';
    totals[group] += Math.abs(entry.amount);
  }

  return EXPENSE_CATEGORY_GROUPS.map(group => ({ group, total: totals[group] }));
}

/** Soma as despesas de **um mês específico** por grupo de categoria (usado pelo teto de gastos). */
export function getCategoryBreakdown(ledger: FinanceLedgerEntry[], monthKey: MonthKey): CategoryBreakdown {
  const monthEntries = ledger.filter(e => monthKeyFromDate(e.date) === monthKey);
  const groups = sumExpensesByCategory(monthEntries);
  const total = groups.reduce((sum, g) => sum + g.total, 0);
  return { monthKey, groups, total };
}

/**
 * Projeta receita/despesa dos próximos `monthsAhead` meses a partir de compromissos
 * já conhecidos: folha fixa, parcelas de empréstimo já agendadas, parcela mensal de
 * dívidas ativas (despesa) e cota mensal de patrocínios ativos (receita).
 *
 * Não projeta bilheteria/premiação — dependem de jogos ainda não agendados.
 * Sem `currentDate` (carreira sem LiveLife) não há como ancorar os meses futuros:
 * retorna `[]`.
 */
export function getCashFlowProjection(
  input: { finance: ClubFinance; players: Player[]; currentDate: string | null },
  monthsAhead = 3,
): CashFlowProjectionPoint[] {
  const { finance, players, currentDate } = input;
  if (!currentDate) return [];

  const anchorMonth = monthKeyFromDate(currentDate);
  const monthKeys = Array.from({ length: monthsAhead }, (_, i) => addMonths(anchorMonth, i + 1));

  const monthlyWageBill = wageBill(players);
  const monthlySponsorIncome = (finance.sponsors ?? [])
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + s.monthlyFee, 0);
  const monthlyDebtInstallments = (finance.debts ?? [])
    .filter(d => d.status === 'active')
    .reduce((sum, d) => sum + d.monthlyInstallment, 0);

  const pendingLoanPaymentsByMonth = new Map<MonthKey, number>();
  for (const payment of finance.loanPayments ?? []) {
    if (payment.status !== 'pending') continue;
    const key = monthKeyFromDate(payment.dueDate);
    pendingLoanPaymentsByMonth.set(key, (pendingLoanPaymentsByMonth.get(key) ?? 0) + payment.amount);
  }

  return monthKeys.map(month => ({
    month,
    projectedIncome: monthlySponsorIncome,
    projectedExpense:
      monthlyWageBill + monthlyDebtInstallments + (pendingLoanPaymentsByMonth.get(month) ?? 0),
  }));
}

/** `null` quando não há período anterior para comparar (evita `Infinity`/`NaN` na UI). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
