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

export interface PlayerMatchRating {
  playerId: string;
  rating: number | null;
}

export type MatchLocation = 'home' | 'away' | 'neutral';
export type MatchResult = 'win' | 'draw' | 'loss';
export type MatchStatus = 'scheduled' | 'completed';

export interface GoalEvent {
  playerId: string;
  playerName: string;
  minute: number;
  stoppage?: number;
  isOwnGoal?: boolean;
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

export interface MatchLineup {
  formation: { playerId: string; x: number; y: number }[];
  bench: string[];
}

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
  opponentGoalScorers?: string;
  description?: string;
  playerRatings?: PlayerMatchRating[];
  motmPlayerId?: string;
  worstPlayerId?: string;
}

export interface ScheduleMatchInput {
  opponent: string;
  date: string;
  location: MatchLocation;
  competition: string;
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
  opponentGoalScorers?: string;
  description?: string;
  playerRatings?: PlayerMatchRating[];
  motmPlayerId?: string;
  worstPlayerId?: string;
}
