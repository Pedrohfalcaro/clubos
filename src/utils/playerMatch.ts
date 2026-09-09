import type { Match, GoalEvent, CardEvent } from '../types/Match';
import type { PlayerMatchPerformance, PlayerMatchRole } from '../types/PlayerMatchPerformance';

export function getPlayerMatchClubName(match: Match, fallback: string): string {
  return match.clubName ?? fallback;
}

/** Deriva `PlayerMatchPerformance` a partir de `goals`/`cards` estruturados — não é mais digitado campo a campo. */
export function derivePlayerPerformance(
  selfId: string,
  role: PlayerMatchRole,
  minutesPlayed: number,
  rating: number | null,
  goals: GoalEvent[],
  cards: CardEvent[],
): PlayerMatchPerformance {
  if (role === 'notCalled' || minutesPlayed <= 0) {
    return { role, minutesPlayed: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, rating: null };
  }
  return {
    role,
    minutesPlayed,
    goals: goals.filter(g => g.playerId === selfId).length,
    assists: goals.filter(g => g.assistPlayerId === selfId).length,
    yellowCards: cards.filter(c => c.playerId === selfId && c.type === 'yellow').length,
    redCards: cards.filter(c => c.playerId === selfId && c.type === 'red').length,
    rating,
  };
}

/** Colegas que receberam assistência sua nesta partida — alimenta `computeTeammateMoraleDeltas`. */
export function deriveAssistedTeammateIds(goals: GoalEvent[], selfId: string): string[] {
  return goals
    .filter(g => g.assistPlayerId === selfId && g.playerId && g.playerId !== selfId)
    .map(g => g.playerId);
}
