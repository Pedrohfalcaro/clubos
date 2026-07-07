export type PlayerMatchRole = 'starter' | 'substitute' | 'notCalled';

export interface PlayerMatchPerformance {
  role: PlayerMatchRole;
  minutesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  rating: number | null;
  notes?: string;
}

export interface CompletePlayerMatchInput {
  matchId: string;
  goalsFor: number;
  goalsAgainst: number;
  performance: PlayerMatchPerformance;
}
