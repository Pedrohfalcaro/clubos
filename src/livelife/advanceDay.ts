import type { Match } from '../types/Match';
import type { Player } from '../types/Player';
import { tickInjuries } from './tickInjuries';

export type LiveEvent =
  | { type: 'day_advanced'; from: string; to: string }
  | { type: 'match_day'; matchId: string }
  | { type: 'injury_cleared'; playerId: string };

export interface AdvanceDayResult {
  nextDate: string;
  events: LiveEvent[];
  /** Partida agendada na nova data, se houver. */
  matchOnArrival: Match | null;
  players: Player[];
}

/** Soma dias a uma data ISO `YYYY-MM-DD` sem depender do fuso local de meia-noite. */
export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatGameDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opts,
  });
}

/** Primeira partida agendada na data (compara só `YYYY-MM-DD`). */
export function findMatchOnDate(matches: Match[], date: string): Match | null {
  const day = date.slice(0, 10);
  return (
    matches
      .filter(m => m.status === 'scheduled' && m.date.slice(0, 10) === day)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  );
}

/**
 * Avança o clock do jogo em +1 dia e decrementa lesões/suspensões.
 */
export function advanceDay(input: {
  currentDate: string;
  matches: Match[];
  players: Player[];
}): AdvanceDayResult {
  const from = input.currentDate.slice(0, 10);
  const nextDate = addDaysIso(from, 1);
  const injuryTick = tickInjuries(input.players);
  const matchOnArrival = findMatchOnDate(input.matches, nextDate);
  const events: LiveEvent[] = [{ type: 'day_advanced', from, to: nextDate }];
  for (const playerId of injuryTick.clearedIds) {
    events.push({ type: 'injury_cleared', playerId });
  }
  if (matchOnArrival) {
    events.push({ type: 'match_day', matchId: matchOnArrival.id });
  }
  return {
    nextDate,
    events,
    matchOnArrival,
    players: injuryTick.players,
  };
}
