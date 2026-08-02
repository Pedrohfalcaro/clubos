import type { ClubLoan, ClubLoanPayment } from '../types/Finance';
import {
  addMonthsIso,
  buildInstallmentDates,
  splitInstallmentAmounts,
} from './transferPayments';
import { uid } from './matchEvents';

/** Juros padrão do empréstimo-ponte da folha (dia 5). */
export const PAYROLL_BRIDGE_INTEREST_PERCENT = 12;
/** Parcelas mensais do empréstimo-ponte. */
export const PAYROLL_BRIDGE_INSTALLMENTS = 6;

/**
 * Sugestão de crédito quando o caixa não cobre a folha:
 * 120% da folha (diferença coberta + margem), 1ª parcela no mês seguinte.
 */
export function suggestPayrollBridgeLoan(input: {
  balance: number;
  wageBill: number;
  gameDate: string;
}): {
  needed: boolean;
  shortfall: number;
  principal: number;
  interestRatePercent: number;
  installmentCount: number;
  firstPaymentDate: string;
  totalToRepay: number;
} | null {
  const bill = Math.max(0, Math.round(input.wageBill));
  if (bill <= 0) return null;
  const shortfall = Math.max(0, bill - Math.round(input.balance));
  if (shortfall <= 0) return null;
  const principal = Math.round(bill * 1.2);
  const interestRatePercent = PAYROLL_BRIDGE_INTEREST_PERCENT;
  return {
    needed: true,
    shortfall,
    principal,
    interestRatePercent,
    installmentCount: PAYROLL_BRIDGE_INSTALLMENTS,
    firstPaymentDate: addMonthsIso(input.gameDate.slice(0, 10), 1),
    totalToRepay: calcLoanTotal(principal, interestRatePercent),
  };
}

/** Total a devolver = principal × (1 + juros%). */
export function calcLoanTotal(principal: number, interestRatePercent: number): number {
  const rate = Math.max(0.01, interestRatePercent) / 100;
  return Math.round(principal * (1 + rate));
}

export function createClubLoanPackage(input: {
  principal: number;
  interestRatePercent: number;
  installmentCount: number;
  firstPaymentDate: string;
  notes?: string;
}): { loan: ClubLoan; payments: ClubLoanPayment[]; creditAmount: number } {
  const principal = Math.max(1, Math.round(input.principal));
  const interestRate = Math.max(0.5, input.interestRatePercent);
  const count = Math.max(1, Math.round(input.installmentCount));
  const totalToRepay = calcLoanTotal(principal, interestRate);
  const loanId = uid();
  const createdAt = new Date().toISOString().slice(0, 10);
  const dates = buildInstallmentDates(input.firstPaymentDate.slice(0, 10), count);
  const amounts = splitInstallmentAmounts(totalToRepay, count);

  const loan: ClubLoan = {
    id: loanId,
    principal,
    interestRate,
    totalToRepay,
    installmentCount: count,
    createdAt,
    firstPaymentDate: dates[0],
    status: 'active',
    notes: input.notes?.trim() || undefined,
  };

  const payments: ClubLoanPayment[] = dates.map((dueDate, i) => ({
    id: uid(),
    loanId,
    dueDate,
    amount: amounts[i] ?? 0,
    label:
      count === 1
        ? `Empréstimo (juros ${interestRate}%)`
        : `Empréstimo ${i + 1}/${count} (juros ${interestRate}%)`,
    status: 'pending' as const,
    installmentIndex: i + 1,
    installmentTotal: count,
  }));

  return { loan, payments, creditAmount: principal };
}

export function loanPaymentsDueOnDate(
  payments: ClubLoanPayment[],
  date: string,
): ClubLoanPayment[] {
  const d = date.slice(0, 10);
  return payments.filter(p => p.status === 'pending' && p.dueDate.slice(0, 10) <= d);
}
