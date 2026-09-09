import type { GoalEvent, AssistEvent, CardEvent, OpponentGoalEntry, MatchMinute } from './Match';

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

export interface PlayerMatchInjuryInput {
  minute: MatchMinute;
  /** Descritivo livre — mesmo campo `type` do CRUD manual em `/player/evolution`. */
  type: string;
  returnDate: string;
}

/**
 * Entrada da tela de jogo redesenhada (Fase 4, v1.6) — `goals`/`cards` referenciam autores
 * pelo id (o próprio `CareerPlayer.id` ou um `Teammate.id`), resolvidos via pseudo-elenco
 * (`utils/playerMatchBridge.ts`). `performance` não é mais digitado — o reducer deriva de
 * `role`/`minutesPlayed`/`rating` + contagem em `goals`/`cards` (`utils/playerMatch.ts`,
 * `derivePlayerPerformance`).
 */
export interface CompletePlayerMatchInput {
  matchId: string;
  goalsFor: number;
  goalsAgainst: number;
  role: PlayerMatchRole;
  minutesPlayed: number;
  /** Nota final (1–10) — só para quem jogou (`role !== 'notCalled'` e minutos > 0). */
  rating: number | null;
  goals: GoalEvent[];
  assists: AssistEvent[];
  cards: CardEvent[];
  opponentGoals?: OpponentGoalEntry[];
  injury?: PlayerMatchInjuryInput;
}
