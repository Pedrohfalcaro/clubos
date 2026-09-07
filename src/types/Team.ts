import type { TeamAchievement } from './Achievement';

export type { TeamAchievement };

/** Contagem manual de títulos por competição — Sala de Troféus (editável, não automática). */
export interface TrophyCabinetEntry {
  competitionName: string;
  titles: number;
}

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
  /** Contagem de troféus por competição — editada manualmente na Sala de Troféus. */
  trophyCabinet?: TrophyCabinetEntry[];
  /**
   * Nacionalidade "oficial" do clube para as tabelas de Recordes de estrangeiros —
   * perguntada uma única vez (na criação da 1ª tabela desse tipo) e salva aqui.
   */
  homeNationality?: string;
  currentMoment?: string;
}
