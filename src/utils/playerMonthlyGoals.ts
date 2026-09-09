import type { PlayerPosition } from '../types/Player';
import type { Match } from '../types/Match';
import type { MonthlyGoal, MonthlyGoalMetric } from '../types/PlayerGoal';

const GOAL_POSITIONS = new Set<PlayerPosition>(['ST', 'CF', 'RW', 'LW']);
const ASSIST_POSITIONS = new Set<PlayerPosition>(['CDM', 'CM', 'CAM']);

/** Ataque → gols; meio → assistências; defesa/goleiro → jogos sem sofrer gol. */
export function metricForPosition(position: PlayerPosition): MonthlyGoalMetric {
  if (GOAL_POSITIONS.has(position)) return 'goals';
  if (ASSIST_POSITIONS.has(position)) return 'assists';
  return 'cleanSheets';
}

export const MONTHLY_GOAL_METRIC_LABELS: Record<MonthlyGoalMetric, string> = {
  goals: 'Gols',
  assists: 'Assistências',
  cleanSheets: 'Jogos sem sofrer gol',
};

export function suggestedTarget(metric: MonthlyGoalMetric): number {
  return metric === 'cleanSheets' ? 2 : 3;
}

export function isFirstOfMonth(dateIso: string): boolean {
  return dateIso.slice(8, 10) === '01';
}

export interface MonthlyGoalProgress {
  matchesPlayed: number;
  metricValue: number;
  avgRating: number | null;
  metMetric: boolean;
  /** null se a meta não tem alvo de nota. */
  metRating: boolean | null;
}

/**
 * Progresso da meta no mês, derivado de `matches` — nunca persistido. `cleanSheets` conta
 * partidas em que o jogador esteve em campo (`role !== 'notCalled'`) e o time não sofreu
 * gol (`match.goalsAgainst === 0`) — `PlayerStats.cleanSheets` em si nunca é incrementado
 * pelo motor de partida do jogador hoje, então calculamos direto das partidas do mês.
 */
export function computeMonthlyProgress(matches: Match[], goal: MonthlyGoal): MonthlyGoalProgress {
  let matchesPlayed = 0;
  let metricValue = 0;
  const ratings: number[] = [];

  for (const m of matches) {
    if (m.status !== 'completed') continue;
    const year = Number(m.date.slice(0, 4));
    const month = Number(m.date.slice(5, 7));
    if (year !== goal.year || month !== goal.month) continue;

    const perf = m.playerPerformance;
    if (!perf || perf.role === 'notCalled') continue;

    matchesPlayed++;
    if (goal.metric === 'goals') metricValue += perf.goals;
    else if (goal.metric === 'assists') metricValue += perf.assists;
    else if (goal.metric === 'cleanSheets' && m.goalsAgainst === 0) metricValue += 1;

    if (perf.rating != null) ratings.push(perf.rating);
  }

  const avgRating = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : null;

  return {
    matchesPlayed,
    metricValue,
    avgRating,
    metMetric: metricValue >= goal.target,
    metRating: goal.ratingTarget != null ? (avgRating != null && avgRating >= goal.ratingTarget) : null,
  };
}
