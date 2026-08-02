import type { TransferPayment, TransferPaymentMethod, TransferRecord } from '../types/Transfer';
import { addDaysIso } from '../livelife';
import { uid } from './matchEvents';

/** Gera datas de parcelas mensais a partir da 1ª data. */
export function buildInstallmentDates(
  firstDate: string,
  count: number,
): string[] {
  const n = Math.max(1, Math.round(count));
  const dates: string[] = [firstDate.slice(0, 10)];
  for (let i = 1; i < n; i++) {
    dates.push(addMonthsIso(firstDate.slice(0, 10), i));
  }
  return dates;
}

/** Soma meses preservando dia (ajusta fim de mês). */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(d, lastDay));
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function splitInstallmentAmounts(total: number, count: number): number[] {
  const n = Math.max(1, Math.round(count));
  if (n === 1) return [Math.round(total)];
  const base = Math.floor(total / n);
  const amounts = Array.from({ length: n }, () => base);
  amounts[n - 1] = Math.round(total - base * (n - 1));
  return amounts;
}

export function createScheduledPayments(input: {
  transfer: TransferRecord;
  method: TransferPaymentMethod;
  installmentCount: number;
  firstPaymentDate: string;
  isIncoming: boolean;
}): TransferPayment[] {
  const count = input.method === 'cash' ? 1 : Math.max(2, Math.round(input.installmentCount));
  if (input.transfer.fee <= 0) return [];

  const dates = buildInstallmentDates(input.firstPaymentDate, count);
  const amounts = splitInstallmentAmounts(input.transfer.fee, count);
  const direction = input.isIncoming ? 'in' : 'out';

  return dates.map((dueDate, i) => ({
    id: uid(),
    transferId: input.transfer.id,
    dueDate,
    amount: amounts[i] ?? 0,
    label:
      count === 1
        ? `Transferência: ${input.transfer.playerSnapshot.name}`
        : `Parcela ${i + 1}/${count}: ${input.transfer.playerSnapshot.name}`,
    status: 'pending' as const,
    installmentIndex: i + 1,
    installmentTotal: count,
    playerName: input.transfer.playerSnapshot.name,
    direction,
  }));
}

export function paymentsDueOnDate(
  payments: TransferPayment[],
  date: string,
): TransferPayment[] {
  const d = date.slice(0, 10);
  return payments.filter(p => p.status === 'pending' && p.dueDate.slice(0, 10) <= d);
}

/** Dia seguinte ao último jogo concluído (ou null). */
export function nextDayAfterLastMatch(
  matches: Array<{ status: string; date: string }>,
): string | null {
  const completed = matches
    .filter(m => m.status === 'completed' && m.date)
    .map(m => m.date.slice(0, 10))
    .sort((a, b) => b.localeCompare(a));
  if (!completed[0]) return null;
  return addDaysIso(completed[0], 1);
}
