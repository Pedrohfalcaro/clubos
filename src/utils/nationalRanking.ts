import type { OpponentStrength } from '../types/NationalTeam';

/**
 * Ranking FIFA simplificado — métrica autocontida da seleção do usuário, não
 * uma tabela real de 200+ países. Posição 1 é a melhor; o clamp mantém a
 * faixa dentro de um intervalo plausível pra um jogo de gestão.
 */
export const FIFA_RANKING_MIN = 1;
export const FIFA_RANKING_MAX = 210;

export type NationalMatchOutcome = 'win' | 'draw' | 'loss';

/** Variação de posições por resultado × força do adversário (negativo = sobe no ranking). */
const DELTA_TABLE: Record<OpponentStrength, Record<NationalMatchOutcome, number>> = {
  top10: { win: -4, draw: -1, loss: 1 },
  top30: { win: -2, draw: 0, loss: 2 },
  outros: { win: -1, draw: 1, loss: 4 },
};

export function outcomeFromScore(goalsFor: number, goalsAgainst: number): NationalMatchOutcome {
  if (goalsFor > goalsAgainst) return 'win';
  if (goalsFor < goalsAgainst) return 'loss';
  return 'draw';
}

/** Aplica a variação de ranking de um resultado, sempre dentro de [FIFA_RANKING_MIN, FIFA_RANKING_MAX]. */
export function applyRankingDelta(
  current: number,
  outcome: NationalMatchOutcome,
  opponentStrength: OpponentStrength,
): number {
  const delta = DELTA_TABLE[opponentStrength][outcome];
  return Math.max(FIFA_RANKING_MIN, Math.min(FIFA_RANKING_MAX, current + delta));
}
