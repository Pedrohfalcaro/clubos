import type { MatchLocation } from './Match';

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

/** Formato estrutural da competição (define a UI). */
export type CompetitionFormat = 'league' | 'knockout' | 'league_knockout';

/** Linha da tabela de pontos (editável + sync com jogos). */
export interface CompetitionTableRow {
  id: string;
  teamName: string;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  /** Time do usuário */
  isUserTeam?: boolean;
  /**
   * Se true, o usuário editou e o sync automático não sobrescreve.
   * Times só manuais começam locked.
   */
  locked?: boolean;
}

/** Fase do mata-mata (uma por vez, progressiva). */
export interface KnockoutPhase {
  id: string;
  /** Nome editável: "Fase 1", "Oitavas", "Final"… */
  name: string;
  opponent: string;
  goalsFor: number | null;
  goalsAgainst: number | null;
  /** Usuário já avançou desta fase */
  advanced: boolean;
  /** Esta fase é a final (campeão se vencer) */
  isFinal: boolean;
  /** Premiação creditada ao avançar / ser campeão */
  prizeReceived?: number;
  /** Resultado resolvido */
  outcome?: 'won' | 'lost' | 'draw';
  /** Mando de campo do jogo de ida (define automaticamente o mando da volta). */
  location?: MatchLocation;
  /** Fase disputada em ida e volta — goalsFor/goalsAgainst acima = jogo de ida. */
  twoLegged?: boolean;
  /** Placar do jogo de volta (só quando twoLegged). */
  secondLeg?: {
    goalsFor: number | null;
    goalsAgainst: number | null;
  };
  /** Agregado empatado — resultado decidido nos pênaltis/prorrogação. */
  decidedOnPenalties?: boolean;
  /** Vencedor da disputa de pênaltis/prorrogação (só quando decidedOnPenalties). */
  penaltyWinner?: 'us' | 'them';
}

export function oppositeLocation(loc?: MatchLocation): MatchLocation {
  if (loc === 'home') return 'away';
  if (loc === 'away') return 'home';
  return 'neutral';
}

/** Competição da temporada — nome, cor no calendário e metadados. */
export interface SeasonCompetition {
  id: string;
  name: string;
  color: string;
  shortName?: string;
  type: CompetitionType;
  /** Liga, mata-mata ou liga + mata-mata */
  format: CompetitionFormat;
  /** Tabela de pontos (liga / fase de grupos) */
  leagueTable?: CompetitionTableRow[];
  /** Fases do mata-mata */
  knockoutPhases?: KnockoutPhase[];
  /** Em league_knockout: usuário abriu o mata-mata */
  knockoutStarted?: boolean;
  /**
   * Posição atual na competição, informada manualmente pelo usuário
   * (a tabela sincronizada nem sempre reflete a competição real).
   * Alimenta metas da diretoria do tipo `league_position`/`win_competition`.
   */
  currentPosition?: number | null;
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

export const COMPETITION_FORMAT_LABELS: Record<CompetitionFormat, string> = {
  league: 'Pontos corridos',
  knockout: 'Mata-mata',
  league_knockout: 'Liga / grupos + mata-mata',
};

export const COMPETITION_FORMAT_HINTS: Record<CompetitionFormat, string> = {
  league: 'Tabela que cresce com os adversários e pode ser editada.',
  knockout: 'Fase a fase: adversário, placar e avanço com premiação.',
  league_knockout: 'Primeiro a tabela; depois o chaveamento eliminatório.',
};

export const DEFAULT_COMPETITION_COLORS: Record<CompetitionType, string> = {
  league: '#3b82f6',
  cup: '#22c55e',
  continental: '#f97316',
  state: '#a855f7',
  friendly: '#9ca3af',
  other: '#64748b',
};
