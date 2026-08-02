import type { TeamAchievement } from './Achievement';

export type { TeamAchievement };

export interface TeamStatistics {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface Team {
  id: string;
  name: string;
  nickname: string;
  country: string;
  budget: number;
  fans: number;
  boardConfidence: number;
  supporterConfidence: number;
  /** Relação com a imprensa (0–100). Baixa → mais notícias ruins no Pulse. */
  mediaConfidence?: number;
  statistics: TeamStatistics;
  /** Kit / brand colors */
  primaryColor?: string;
  secondaryColor?: string;
  description?: string;
  history?: string;
  /** Sala de Troféus / classificações finais */
  achievements?: TeamAchievement[];
  currentMoment?: string;
}
