import type { PressContext } from './PressConference';

export type StoryArcId =
  | 'dressing_room_rift'
  | 'media_siege'
  | 'injury_saga'
  | 'board_ultimatum';

export interface StoryArcStepDeltas {
  board?: number;
  media?: number;
  supporter?: number;
  squadMorale?: number;
}

export interface StoryArcStepDef {
  /** Título da manchete no ClubOSocial. */
  headline: string;
  body: string;
  deltas?: StoryArcStepDeltas;
  /** Sugere coletiva neste passo. */
  pressHint?: Extract<PressContext, 'story_arc' | 'injury' | 'finance_crisis'>;
}

export interface StoryArcDef {
  id: StoryArcId;
  title: string;
  /** Dias mínimos entre fim e novo início do mesmo arco. */
  cooldownDays: number;
  steps: StoryArcStepDef[];
}

export interface ActiveStoryArc {
  id: StoryArcId;
  title: string;
  /** Índice do próximo passo a publicar (0 = primeiro). */
  step: number;
  startedAt: string;
  lastStepAt: string | null;
  status: 'active' | 'completed';
  /** Atleta âncora (arco de lesão). */
  playerId?: string;
  playerName?: string;
  /** Coletiva sugerida pelo último passo publicado. */
  pendingPress?: boolean;
  pendingPressContext?: PressContext;
}

export interface StoryArcHistoryEntry {
  id: StoryArcId;
  title: string;
  completedAt: string;
}
