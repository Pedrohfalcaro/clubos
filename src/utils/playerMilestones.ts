import type { PlayerStats } from '../types/Player';

export interface PlayerMilestone {
  id: string;
  label: string;
  achieved: boolean;
  current: number;
  target: number;
}

const GAME_TARGETS = [50, 100, 200, 300, 400, 500];
const GOAL_TARGETS = [10, 25, 50, 100, 150, 200];
const ASSIST_TARGETS = [10, 25, 50, 100];

function buildMilestones(prefix: string, unit: string, current: number, targets: number[]): PlayerMilestone[] {
  return targets.map(target => ({
    id: `${prefix}-${target}`,
    label: `${target} ${unit}`,
    achieved: current >= target,
    current,
    target,
  }));
}

export function computePlayerMilestones(stats: PlayerStats): PlayerMilestone[] {
  return [
    ...buildMilestones('games', 'jogos', stats.matches, GAME_TARGETS),
    ...buildMilestones('goals', 'gols', stats.goals, GOAL_TARGETS),
    ...buildMilestones('assists', 'assistências', stats.assists, ASSIST_TARGETS),
  ];
}

/** Próximo marco não alcançado de cada categoria — para exibir progresso. */
export function nextPlayerMilestones(milestones: PlayerMilestone[]): PlayerMilestone[] {
  const byPrefix = new Map<string, PlayerMilestone>();
  for (const m of milestones) {
    if (m.achieved) continue;
    const prefix = m.id.split('-')[0];
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, m);
  }
  return [...byPrefix.values()];
}
