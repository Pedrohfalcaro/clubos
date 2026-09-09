import type { InjuryEntry } from '../types/CareerPlayer';

/** Lesão sem `returnDate` é tratada como em aberto (ainda ativa). */
export function isInjuryActive(injury: InjuryEntry, currentDate: string): boolean {
  if (!injury.returnDate) return true;
  return injury.returnDate.slice(0, 10) > currentDate.slice(0, 10);
}

/** Dias entre duas datas ISO (`to - from`), pode ser negativo se `to` já passou. */
export function daysUntil(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso.slice(0, 10)}T12:00:00`);
  const b = new Date(`${toIso.slice(0, 10)}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
