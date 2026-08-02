import type { ClubDebt, ClubDebtSource } from '../types/Finance';
import { uid } from './matchEvents';

/** Queda de moral do elenco ao adiar a folha (dia 5). */
export const PAYROLL_DELAY_MORALE_HIT = 15;

/** Juros ao ignorar a parcela do mês (% sobre o saldo restante). */
export const DEBT_SKIP_INTEREST_RATE = 0.025;

export function yearMonth(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Dia de cobrança seguro para todos os meses. */
export function clampPaymentDay(day: number | undefined | null): number {
  const n = Math.round(Number(day));
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(28, n));
}

export function dayOfMonth(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

export function isPaymentDay(isoDate: string, paymentDay: number): boolean {
  return dayOfMonth(isoDate) === clampPaymentDay(paymentDay);
}

/** Data ISO no mês (year/month 1-indexed) para o dia de pagamento. */
export function paymentDateInMonth(
  year: number,
  month1to12: number,
  paymentDay: number,
): string {
  const d = clampPaymentDay(paymentDay);
  const mm = String(month1to12).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function createClubDebt(input: {
  amount: number;
  label?: string;
  monthlyInstallment: number;
  paymentDay?: number;
  source: ClubDebtSource;
  createdAt: string;
}): ClubDebt {
  const principal = Math.max(1, Math.round(input.amount));
  const monthly = Math.max(
    1,
    Math.min(principal, Math.round(input.monthlyInstallment) || Math.round(principal / 6)),
  );
  return {
    id: uid(),
    label: input.label?.trim() || 'Dívida do clube',
    principal,
    remaining: principal,
    monthlyInstallment: monthly,
    paymentDay: clampPaymentDay(input.paymentDay ?? 5),
    accruedInterest: 0,
    createdAt: input.createdAt.slice(0, 10),
    source: input.source,
    status: 'active',
  };
}

/** Dívida gerada ao pagar folha com caixa insuficiente (saldo zerado + dívida). */
export function createOverdraftDebt(overdraft: number, gameDate: string): ClubDebt {
  const amount = Math.max(1, Math.round(overdraft));
  return createClubDebt({
    amount,
    label: 'Folha — saldo negativo convertido em dívida',
    monthlyInstallment: Math.max(1, Math.round(amount / 6)),
    paymentDay: 5,
    source: 'wage_overdraft',
    createdAt: gameDate,
  });
}

export function migrateClubDebt(raw: Partial<ClubDebt> & { id?: string }): ClubDebt {
  const principal = Math.max(1, Math.round(raw.principal ?? raw.remaining ?? 1));
  const remaining = Math.max(0, Math.round(raw.remaining ?? principal));
  const monthly = Math.max(
    1,
    Math.round(raw.monthlyInstallment ?? Math.round(principal / 6)),
  );
  return {
    id: raw.id ?? uid(),
    label: raw.label?.trim() || 'Dívida do clube',
    principal,
    remaining,
    monthlyInstallment: Math.min(Math.max(remaining, 1), monthly),
    paymentDay: clampPaymentDay(raw.paymentDay ?? 5),
    lastInstallmentMonth: raw.lastInstallmentMonth,
    accruedInterest: Math.max(0, Math.round(raw.accruedInterest ?? 0)),
    createdAt: (raw.createdAt ?? new Date().toISOString()).slice(0, 10),
    source: raw.source === 'wage_overdraft' ? 'wage_overdraft' : 'manual',
    status: remaining <= 0 || raw.status === 'paid' ? 'paid' : 'active',
  };
}

export function applyDebtPayment(
  debt: ClubDebt,
  amount: number,
  gameDate: string,
  options?: { asMonthlyInstallment?: boolean },
): ClubDebt {
  const pay = Math.max(0, Math.min(debt.remaining, Math.round(amount)));
  const remaining = Math.max(0, debt.remaining - pay);
  return {
    ...debt,
    remaining,
    status: remaining <= 0 ? 'paid' : 'active',
    lastInstallmentMonth: options?.asMonthlyInstallment
      ? yearMonth(gameDate)
      : debt.lastInstallmentMonth,
  };
}

/** Ignora a parcela do mês: aplica juros e marca o mês como tratado. */
export function skipDebtInstallment(debt: ClubDebt, gameDate: string): ClubDebt {
  if (debt.status !== 'active' || debt.remaining <= 0) return debt;
  const interest = Math.max(1, Math.round(debt.remaining * DEBT_SKIP_INTEREST_RATE));
  return {
    ...debt,
    remaining: debt.remaining + interest,
    accruedInterest: (debt.accruedInterest ?? 0) + interest,
    lastInstallmentMonth: yearMonth(gameDate),
  };
}

/** Dívidas com parcela vencida neste dia (ainda não paga/ignorada no mês). */
export function debtsWithInstallmentDue(
  debts: ClubDebt[],
  gameDate: string,
): Array<{ debt: ClubDebt; amount: number }> {
  const ym = yearMonth(gameDate);
  const out: Array<{ debt: ClubDebt; amount: number }> = [];
  for (const d of debts) {
    if (d.status !== 'active' || d.remaining <= 0) continue;
    const monthly = d.monthlyInstallment;
    if (!monthly || monthly <= 0) continue;
    if (!isPaymentDay(gameDate, d.paymentDay ?? 5)) continue;
    if (d.lastInstallmentMonth === ym) continue;
    out.push({ debt: d, amount: Math.min(d.remaining, monthly) });
  }
  return out;
}

export function totalDebtRemaining(debts: ClubDebt[] | undefined): number {
  return (debts ?? [])
    .filter(d => d.status === 'active')
    .reduce((s, d) => s + d.remaining, 0);
}

export function applyPayrollDelayMorale<T extends { salary?: number; morale?: number }>(
  players: T[],
  hit = PAYROLL_DELAY_MORALE_HIT,
): T[] {
  return players.map(p => {
    if ((p.salary ?? 0) <= 0) return p;
    const morale = Math.max(0, Math.min(100, Math.round((p.morale ?? 70) - hit)));
    return { ...p, morale };
  });
}
