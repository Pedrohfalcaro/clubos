export interface MatchMinute {
  base: number;
  stoppage?: number;
}

export interface SubstitutionEvent {
  id: string;
  playerInId: string;
  playerInName: string;
  playerOutId: string;
  playerOutName: string;
  minute: MatchMinute;
  side: 'team' | 'opponent';
  opponentPlayerIn?: string;
  opponentPlayerOut?: string;
}

export interface TeamGoalEntry {
  id: string;
  type: 'team' | 'own';
  playerId?: string;
  opponentScorerName?: string;
  assistPlayerId?: string;
  minute: MatchMinute;
  isPenalty?: boolean;
}

export interface TeamCardEntry {
  id: string;
  playerId: string;
  playerName: string;
  type: 'yellow' | 'red';
  minute: MatchMinute;
}

export interface OpponentGoalEntry {
  id: string;
  scorerName: string;
  assistName?: string;
  minute: MatchMinute;
  isOwnGoal?: boolean;
}

export interface OpponentCardEntry {
  id: string;
  playerName: string;
  type: 'yellow' | 'red';
  minute: MatchMinute;
}

export interface OpponentSubEntry {
  id: string;
  playerIn: string;
  playerOut: string;
  minute: MatchMinute;
}

export interface TeamInjuryEntry {
  id: string;
  playerId: string;
  playerName: string;
  minute: MatchMinute;
  note?: string;
  /** Data de retorno (ISO `YYYY-MM-DD`) — define duração da lesão no LiveLife. */
  returnDate?: string;
}

export interface PlayerMatchRating {
  playerId: string;
  rating: number | null;
}

export type MatchLocation = 'home' | 'away' | 'neutral';
export type MatchResult = 'win' | 'draw' | 'loss';
export type MatchStatus = 'scheduled' | 'completed';

/** Importância narrativa da partida — alimenta manchetes do ClubOSocial. */
export type MatchSignificance =
  | 'normal'
  | 'derby'
  | 'decisive'
  | 'title'
  | 'relegation'
  | 'cup_final'
  | 'debut'
  | 'revenge'
  | 'rivalry';

export const MATCH_SIGNIFICANCE_OPTIONS: { id: MatchSignificance; label: string }[] = [
  { id: 'normal', label: 'Partida comum' },
  { id: 'derby', label: 'Clássico / Derby' },
  { id: 'rivalry', label: 'Rivalidade' },
  { id: 'decisive', label: 'Jogo decisivo' },
  { id: 'title', label: 'Disputa de título' },
  { id: 'relegation', label: 'Luta contra o rebaixamento' },
  { id: 'cup_final', label: 'Final de copa' },
  { id: 'debut', label: 'Estreia' },
  { id: 'revenge', label: 'Revanche' },
];

export function matchSignificanceLabel(value?: MatchSignificance | null): string {
  return MATCH_SIGNIFICANCE_OPTIONS.find(o => o.id === (value ?? 'normal'))?.label ?? 'Partida comum';
}

export interface GoalEvent {
  playerId: string;
  playerName: string;
  minute: number;
  stoppage?: number;
  isOwnGoal?: boolean;
  isPenalty?: boolean;
  opponentScorerName?: string;
  assistPlayerId?: string;
  assistPlayerName?: string;
}

export interface AssistEvent {
  playerId: string;
  playerName: string;
  minute: number;
  stoppage?: number;
  goalIndex?: number;
}

export interface CardEvent {
  playerId: string;
  playerName: string;
  minute: number;
  stoppage?: number;
  type: 'yellow' | 'red';
}

import type { FormationKey, FormationSlot, TacticalStyleKey } from './Tactics';

export interface MatchLineup {
  formation: FormationSlot[];
  bench: string[];
  formationKey?: FormationKey;
  style?: TacticalStyleKey;
}

import type { PlayerMatchPerformance } from './PlayerMatchPerformance';

export interface Match {
  id: string;
  teamId: string;
  date: string;
  opponent: string;
  location: MatchLocation;
  goalsFor: number;
  goalsAgainst: number;
  result: MatchResult | null;
  competition: string;
  status: MatchStatus;
  goals: GoalEvent[];
  assists: AssistEvent[];
  cards: CardEvent[];
  playerMatches: string[];
  lineup?: MatchLineup;
  substitutions?: SubstitutionEvent[];
  injuries?: TeamInjuryEntry[];
  opponentGoalScorers?: string;
  description?: string;
  playerRatings?: PlayerMatchRating[];
  motmPlayerId?: string;
  worstPlayerId?: string;
  clubName?: string;
  playerPerformance?: PlayerMatchPerformance;
  /** Season in which the match was scheduled / played */
  season?: number;
  /** Tipo/importância da partida (manchetes ClubOSocial). */
  significance?: MatchSignificance;
}

export interface ScheduleMatchInput {
  opponent: string;
  date: string;
  location: MatchLocation;
  competition: string;
  significance?: MatchSignificance;
}

export interface CompleteMatchInput {
  matchId: string;
  goalsFor: number;
  goalsAgainst: number;
  goals: GoalEvent[];
  assists: AssistEvent[];
  cards: CardEvent[];
  playerMatches: string[];
  lineup: MatchLineup;
  substitutions?: SubstitutionEvent[];
  injuries?: TeamInjuryEntry[];
  opponentGoalScorers?: string;
  description?: string;
  playerRatings?: PlayerMatchRating[];
  motmPlayerId?: string;
  worstPlayerId?: string;
}
