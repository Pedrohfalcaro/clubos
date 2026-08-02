export type BoardGoalKind =
  | 'league_position'
  | 'dont_spend_over'
  | 'sell_players'
  | 'wage_bill_cap'
  | 'win_competition';

export type BoardGoalStatus = 'active' | 'done' | 'failed';

export interface BoardGoal {
  id: string;
  season: number;
  kind: BoardGoalKind;
  label: string;
  /** Numeric target (e.g. position number, amount in currency, player count) */
  target: number;
  /** Numeric current progress */
  current: number;
  status: BoardGoalStatus;
}

export interface BoardConfidenceEntry {
  date: string;
  value: number;
  reason: string;
}

export interface BoardState {
  goals: BoardGoal[];
  confidenceHistory: BoardConfidenceEntry[];
  /** Histórico da moral/confiança da torcida */
  supporterHistory: BoardConfidenceEntry[];
  /** Histórico da relação com a mídia */
  mediaHistory?: BoardConfidenceEntry[];
  notes?: string;
}

export function createDefaultBoardState(): BoardState {
  return {
    goals: [],
    confidenceHistory: [],
    supporterHistory: [],
    mediaHistory: [],
    notes: undefined,
  };
}

export function boardStatus(confidence: number): 'stable' | 'watchful' | 'crisis' {
  if (confidence >= 65) return 'stable';
  if (confidence >= 35) return 'watchful';
  return 'crisis';
}
