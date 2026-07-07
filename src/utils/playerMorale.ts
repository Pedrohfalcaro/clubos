import type { PlayerPosition } from '../types/Player';
import type { MatchResult } from '../types/Match';
import type { PlayerMatchPerformance } from '../types/PlayerMatchPerformance';

const ATTACK_POSITIONS: PlayerPosition[] = ['ST', 'CF', 'RW', 'LW'];
const MIDFIELD_POSITIONS: PlayerPosition[] = ['CDM', 'CM', 'CAM'];

export function clampMorale(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function calcMoraleChanges(
  position: PlayerPosition,
  result: MatchResult,
  performance: PlayerMatchPerformance,
): { coachConfidence: number; fanReputation: number } {
  if (performance.role === 'notCalled') {
    return { coachConfidence: 0, fanReputation: 0 };
  }

  let coachDelta = 0;
  let fanDelta = 0;

  if (result === 'win') fanDelta += 4;
  else if (result === 'loss') fanDelta -= 4;

  if (performance.goals > 0) {
    fanDelta += performance.goals * 3;
    coachDelta += performance.goals * 2;
  } else if (ATTACK_POSITIONS.includes(position)) {
    fanDelta -= 3;
  }

  if (performance.assists > 0) {
    fanDelta += performance.assists * 3;
    coachDelta += performance.assists * 2;
  } else if (MIDFIELD_POSITIONS.includes(position)) {
    fanDelta -= 2;
  }

  if (performance.rating != null) {
    coachDelta += Math.round((performance.rating - 6.5) * 4);
  }

  return { coachConfidence: coachDelta, fanReputation: fanDelta };
}

export function applyMoraleDelta(
  coachConfidence: number,
  fanReputation: number,
  delta: { coachConfidence: number; fanReputation: number },
): { coachConfidence: number; fanReputation: number } {
  return {
    coachConfidence: clampMorale(coachConfidence + delta.coachConfidence),
    fanReputation: clampMorale(fanReputation + delta.fanReputation),
  };
}
