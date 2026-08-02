import type { MatchLocation, MatchResult, MatchSignificance } from './Match';

export type PressContext =
  | 'pre_match'
  | 'post_match'
  | 'callup'
  | 'injury'
  | 'finance_crisis'
  | 'story_arc';

export interface PressOptionEffects {
  supporterConfidence?: number;
  squadMorale?: number;
  boardConfidence?: number;
  /** Mídia: sobe pouco, cai bastante (escalado no motor). */
  mediaConfidence?: number;
  /** Moral só do reforço recente (se houver na situação). */
  targetPlayerMorale?: number;
}

export interface PressOption {
  id: string;
  label: string;
  effects: PressOptionEffects;
  headlineHint?: string;
  /** Resposta hostil à imprensa — sobe atrito (pressFriction). */
  aggressive?: boolean;
}

/** Snapshot do momento — filtra e personaliza perguntas. */
export interface PressSituation {
  context: PressContext;
  result?: MatchResult | null;
  location?: MatchLocation;
  significance?: MatchSignificance | null;
  goalsFor?: number;
  goalsAgainst?: number;
  margin?: number;
  cleanSheet?: boolean;
  hatTrickName?: string | null;
  redCards?: number;
  avgSquadMorale?: number;
  formDryAttacker?: string | null;
  recentLosses?: number;
  recentWins?: number;
  opponent?: string;
  boardConfidence?: number;
  supporterConfidence?: number;
  mediaConfidence?: number;
  /** Reforço adquirido recentemente (compra / empréstimo / livre). */
  recentSigningName?: string | null;
  recentSigningId?: string | null;
  recentSigningDaysAgo?: number | null;
  /** Coletiva de lesão. */
  injuredPlayerName?: string | null;
  injuredPlayerId?: string | null;
  injuryDaysRemaining?: number | null;
  /** Coletiva financeira. */
  balance?: number | null;
  wageBill?: number | null;
  /** 0–100 atrito acumulado com a imprensa. */
  pressFriction?: number;
}

export interface PressQuestionTags {
  results?: MatchResult[];
  locations?: MatchLocation[];
  significance?: MatchSignificance[];
  minMargin?: number;
  maxMargin?: number;
  cleanSheet?: boolean;
  requiresHatTrick?: boolean;
  requiresRedCard?: boolean;
  avgMoraleMax?: number;
  avgMoraleMin?: number;
  requiresFormDry?: boolean;
  /** Exige reforço nos últimos dias. */
  requiresRecentSigning?: boolean;
  recentLossesMin?: number;
  recentWinsMin?: number;
  mediaMax?: number;
  mediaMin?: number;
  boardMax?: number;
  boardMin?: number;
  supporterMax?: number;
  supporterMin?: number;
}

export interface PressQuestion {
  id: string;
  context: PressContext | 'both';
  prompt: string;
  options: PressOption[];
  tags?: PressQuestionTags;
  /** Peso relativo no sorteio (default 1). */
  weight?: number;
}

export interface PressConferenceDeltas {
  supporterConfidence: number;
  squadMorale: number;
  boardConfidence: number;
  mediaConfidence: number;
}

export interface PressPlayerMoraleDelta {
  playerId: string;
  delta: number;
}

export interface PressConferenceResult {
  deltas: PressConferenceDeltas;
  headline: string;
  summary: string[];
  /** Moral dirigida a atletas específicos (ex.: reforço recente). */
  playerMorale?: PressPlayerMoraleDelta[];
  /** Quantas respostas agressivas nesta sessão. */
  aggressiveCount: number;
}
