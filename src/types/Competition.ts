export interface StandingsEntry {
  teamName: string;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export type CompetitionType =
  | 'league'
  | 'cup'
  | 'continental'
  | 'state'
  | 'friendly'
  | 'other';

/** Competição da temporada — nome, cor no calendário e metadados. */
export interface SeasonCompetition {
  id: string;
  name: string;
  color: string;
  shortName?: string;
  type: CompetitionType;
}

/** @deprecated Prefer SeasonCompetition — mantido por compatibilidade de imports. */
export interface Competition {
  id: string;
  name: string;
  season: string;
}

export const COMPETITION_TYPE_LABELS: Record<CompetitionType, string> = {
  league: 'Liga / Campeonato',
  cup: 'Copa nacional',
  continental: 'Continental',
  state: 'Estadual',
  friendly: 'Amistoso',
  other: 'Outra',
};

export const DEFAULT_COMPETITION_COLORS: Record<CompetitionType, string> = {
  league: '#3b82f6',
  cup: '#22c55e',
  continental: '#f97316',
  state: '#a855f7',
  friendly: '#9ca3af',
  other: '#64748b',
};
