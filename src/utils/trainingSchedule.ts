import type { Match } from '../types/Match';
import type { TrainingSession } from '../types/Training';

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/** Segunda-feira (YYYY-MM-DD) da semana de calendário da data — semana vai de seg a dom. */
export function weekStartIso(iso: string): string {
  const d = new Date(`${dayOf(iso)}T12:00:00`);
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday);
  return d.toISOString().slice(0, 10);
}

export type TrainingBlockReason = 'match-day' | 'already-trained';

export interface TrainingAvailability {
  available: boolean;
  reason: TrainingBlockReason | null;
  /** Texto curto para tooltip / aviso. */
  message: string;
}

export function trainingAvailability(
  currentDate: string | null | undefined,
  matches: Match[],
  history: TrainingSession[],
): TrainingAvailability {
  if (!currentDate) {
    return { available: false, reason: null, message: 'Defina a data da carreira para treinar.' };
  }
  const today = dayOf(currentDate);

  if (matches.some(m => dayOf(m.date) === today)) {
    return { available: false, reason: 'match-day', message: 'Dia de jogo — sem treino hoje.' };
  }

  const week = weekStartIso(today);
  if (history.some(s => weekStartIso(s.date) === week)) {
    return {
      available: false,
      reason: 'already-trained',
      message: 'Treino da semana já realizado — renova na segunda-feira.',
    };
  }

  return { available: true, reason: null, message: 'Treino disponível nesta semana.' };
}
