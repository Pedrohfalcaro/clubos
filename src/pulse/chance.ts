import type { MatchResult } from '../types/Match';
import type { PulseAthlete, PulseClub, PulseHistoryEntry } from './types';
import { clamp } from './utils';

/**
 * Chance dinâmica de sair evento Pulse — sobe em crise / silêncio longo,
 * desce quando o clube está estável e feliz.
 */
export function computeDynamicEventChance(input: {
  base: number;
  mode: 'match' | 'daily';
  athletes: PulseAthlete[];
  club: PulseClub;
  history: PulseHistoryEntry[];
  recentResults?: MatchResult[];
}): number {
  const { base, mode, athletes, club, history, recentResults = [] } = input;
  let chance = base;

  const avgMoral = athletes.length
    ? athletes.reduce((s, a) => s + (a.moral ?? 70), 0) / athletes.length
    : 70;

  if (avgMoral < 35) chance *= 1.45;
  else if (avgMoral < 50) chance *= 1.22;
  else if (avgMoral > 82) chance *= 0.82;

  const board = club.boardConfidence ?? 50;
  const fans = club.supporterConfidence ?? 50;
  const media = club.mediaConfidence ?? 50;
  if (Math.abs(board - 50) >= 28) chance *= 1.18;
  if (Math.abs(fans - 50) >= 28) chance *= 1.18;
  if (board < 35 || fans < 35) chance *= 1.2;
  // Imprensa irritada → mais barulho no Pulse
  if (media <= 25) chance *= 1.4;
  else if (media <= 40) chance *= 1.22;
  else if (media >= 75) chance *= 0.9;

  const lastEventIdx = history.findIndex(h => h.eventoId);
  // history[0] is newest; count "nada"/gap roughly by index of last real event
  if (mode === 'daily') {
    if (lastEventIdx < 0) chance *= 1.15;
    else if (lastEventIdx >= 4) chance *= 1.28;
    else if (lastEventIdx >= 2) chance *= 1.12;
  }

  const last3 = recentResults.slice(0, 3);
  const losses = last3.filter(r => r === 'loss').length;
  const wins = last3.filter(r => r === 'win').length;
  if (losses >= 2) chance *= 1.35;
  else if (losses === 1 && last3[0] === 'loss') chance *= 1.12;
  if (wins >= 3) chance *= 1.08;

  const dryAttackers = athletes.filter(a => {
    const pos = String(a.posicao);
    return (
      (pos === 'ATA' || pos === 'PE' || pos === 'PD') &&
      (a.matches ?? 0) >= 8 &&
      (a.goals ?? 0) === 0
    );
  }).length;
  if (dryAttackers > 0) chance *= 1 + Math.min(0.35, dryAttackers * 0.12);

  if (mode === 'daily') return clamp(chance, 0.04, 0.5);
  return clamp(chance, 0.12, 0.62);
}
