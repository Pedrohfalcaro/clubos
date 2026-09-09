export type MonthlyGoalMetric = 'goals' | 'assists' | 'cleanSheets';

/**
 * Meta pessoal de um mês — 1 por (season, year, month), definida pelo usuário (popup ou
 * tela de Metas). Progresso é sempre derivado de `state.matches` (`computeMonthlyProgress`),
 * nunca persistido — mesmo racional de `computePlayerMilestones` (v1.5).
 */
export interface MonthlyGoal {
  id: string;
  season: number;
  year: number;
  /** 1–12 */
  month: number;
  metric: MonthlyGoalMetric;
  target: number;
  /** Nota média opcional, alvo secundário. */
  ratingTarget?: number;
}
