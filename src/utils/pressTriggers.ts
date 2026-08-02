import type { Match } from '../types/Match';
import type { Player } from '../types/Player';
import type { LiveLifeMeta } from '../types/LiveLife';
import type { ClubFinance } from '../types/Finance';
import { wageBill, runwayMonths } from './finance';

const IMPORTANT_SIG = new Set([
  'derby',
  'decisive',
  'title',
  'relegation',
  'cup_final',
  'rivalry',
  'revenge',
]);

export function pressSpecialDone(meta: LiveLifeMeta | undefined, key: string): boolean {
  return (meta?.pressSpecialDoneKeys ?? []).includes(key);
}

/** Convocação: partida importante nos próximos 3 dias. */
export function findCallupPressOpportunity(input: {
  matches: Match[];
  currentDate: string | null | undefined;
  livelife: LiveLifeMeta;
}): { match: Match; key: string } | null {
  const today = input.currentDate?.slice(0, 10);
  if (!today) return null;
  const start = new Date(`${today}T12:00:00`);
  const candidates = input.matches
    .filter(m => {
      if (m.status !== 'scheduled') return false;
      const sig = m.significance ?? 'normal';
      if (!IMPORTANT_SIG.has(sig)) return false;
      const d = m.date.slice(0, 10);
      const dt = new Date(`${d}T12:00:00`);
      const days = Math.round((dt.getTime() - start.getTime()) / 86_400_000);
      return days >= 0 && days <= 3;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const match of candidates) {
    const key = `callup:${match.id}`;
    if (!pressSpecialDone(input.livelife, key)) return { match, key };
  }
  return null;
}

/** Lesão grave: ≥14 dias restantes. */
export function findInjuryPressOpportunity(input: {
  players: Player[];
  currentDate: string | null | undefined;
  livelife: LiveLifeMeta;
}): { player: Player; key: string } | null {
  const today = input.currentDate?.slice(0, 10) ?? '';
  const injured = input.players
    .filter(
      p =>
        p.availability === 'lesionado' &&
        (p.injuryDaysRemaining ?? 0) >= 14 &&
        p.status !== 'Aposentado',
    )
    .sort((a, b) => (b.injuryDaysRemaining ?? 0) - (a.injuryDaysRemaining ?? 0));

  for (const player of injured) {
    const key = `injury:${player.id}:${today.slice(0, 7)}`;
    if (!pressSpecialDone(input.livelife, key)) return { player, key };
  }
  return null;
}

/** Crise financeira: caixa baixo / runway curto. */
export function findFinancePressOpportunity(input: {
  finance: ClubFinance;
  players: Player[];
  currentDate: string | null | undefined;
  livelife: LiveLifeMeta;
}): { key: string; reason: string } | null {
  const today = input.currentDate?.slice(0, 10);
  if (!today) return null;
  const monthKey = `finance:${today.slice(0, 7)}`;
  if (pressSpecialDone(input.livelife, monthKey)) return null;

  const bill = wageBill(input.players);
  const runway = runwayMonths(input.finance, input.players);
  const bal = input.finance.balance;

  if (bal < 0) {
    return { key: monthKey, reason: 'Caixa negativo' };
  }
  if (bill > 0 && bal < bill * 0.5) {
    return { key: monthKey, reason: 'Caixa abaixo de meia folha' };
  }
  if (runway != null && runway < 1 && bill > 0) {
    return { key: monthKey, reason: 'Runway crítico' };
  }
  return null;
}

export function contextLabel(ctx: string): string {
  switch (ctx) {
    case 'pre_match':
      return 'pré-jogo';
    case 'post_match':
      return 'pós-jogo';
    case 'callup':
      return 'convocação';
    case 'injury':
      return 'lesão';
    case 'finance_crisis':
      return 'crise financeira';
    case 'story_arc':
      return 'arco narrativo';
    default:
      return ctx;
  }
}
