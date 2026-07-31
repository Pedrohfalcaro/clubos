import type { MatchResult } from '../types/Match';

/** Deltas de confiança do clube após um resultado. */
export const BOARD_RESULT_DELTA: Record<MatchResult, number> = {
  win: 3,
  draw: 0,
  loss: -4,
};

/** Torcida reage um pouco mais — e se irrita com empate. */
export const SUPPORTER_RESULT_DELTA: Record<MatchResult, number> = {
  win: 4,
  draw: -1,
  loss: -5,
};

export function clampConfidence(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function resultConfidenceReason(result: MatchResult): string {
  if (result === 'win') return 'Vitória';
  if (result === 'draw') return 'Empate';
  return 'Derrota';
}
