import type { MatchResult } from './Match';

export type PlayerPressContext = 'pre_match' | 'post_match';

export interface PlayerPressOptionEffects {
  coachConfidence?: number;
  fanReputation?: number;
  morale?: number;
}

export interface PlayerPressOption {
  id: string;
  label: string;
  effects: PlayerPressOptionEffects;
  headlineHint?: string;
}

export interface PlayerPressQuestionTags {
  results?: MatchResult[];
  scoredGoal?: boolean;
  poorRating?: boolean;
  greatRating?: boolean;
  benched?: boolean;
  moraleMax?: number;
  moraleMin?: number;
  coachMax?: number;
  coachMin?: number;
  fanMax?: number;
  fanMin?: number;
}

export interface PlayerPressQuestion {
  id: string;
  context: PlayerPressContext | 'both';
  prompt: string;
  options: PlayerPressOption[];
  tags?: PlayerPressQuestionTags;
  weight?: number;
}

/** Snapshot do momento — filtra e personaliza perguntas. */
export interface PlayerPressSituation {
  context: PlayerPressContext;
  result?: MatchResult | null;
  goals?: number;
  assists?: number;
  rating?: number | null;
  wasStarter?: boolean;
  wasBenched?: boolean;
  opponent?: string;
  morale?: number;
  coachConfidence?: number;
  fanReputation?: number;
}

export interface PlayerPressConferenceDeltas {
  coachConfidence: number;
  fanReputation: number;
  morale: number;
}

export interface PlayerPressConferenceResult {
  deltas: PlayerPressConferenceDeltas;
  headline: string;
  summary: string[];
}
