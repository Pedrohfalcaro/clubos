import type { PlayerPosition } from '../types/Player';
import type { Teammate } from '../types/Teammate';
import { clamp } from '../pulse/utils';

export interface TeammateMoraleMatchInput {
  rating: number | null;
  goals: number;
  /** IDs de colegas que receberam assistência sua nesta partida (pode repetir se dobrada). */
  assistedTeammateIds?: string[];
}

/**
 * Efeito de uma partida sua na moral de cada colega — pura, sem mutar `teammates`.
 * Colegas da mesma posição reagem como rivais (nota alta/gols te dão minutos que
 * eles queriam), mas uma assistência dada a eles é sempre positiva, mesmo rival.
 */
export function computeTeammateMoraleDeltas(
  teammates: Teammate[],
  input: TeammateMoraleMatchInput,
  playerPosition: PlayerPosition,
): Record<string, number> {
  const deltas: Record<string, number> = {};
  for (const t of teammates) {
    const isRival = t.position === playerPosition;
    let delta = 0;

    const assistCount = (input.assistedTeammateIds ?? []).filter(id => id === t.id).length;
    if (assistCount > 0) delta += 4 * assistCount;

    if (input.rating != null) {
      if (input.rating >= 8) delta += isRival ? -1 : 1;
      else if (input.rating <= 5) delta += isRival ? 1 : -1;
    }

    if (input.goals > 0 && !isRival) {
      delta += input.goals >= 3 ? 2 : 1;
    }

    if (delta !== 0) deltas[t.id] = delta;
  }
  return deltas;
}

/** Aplica (ou reverte, se os deltas vierem negados) o resultado de `computeTeammateMoraleDeltas`. */
export function applyTeammateMoraleDeltas(
  teammates: Teammate[],
  deltas: Record<string, number>,
): Teammate[] {
  if (Object.keys(deltas).length === 0) return teammates;
  return teammates.map(t => {
    const d = deltas[t.id];
    if (!d) return t;
    return { ...t, moraleTowardsPlayer: clamp(t.moraleTowardsPlayer + d, 0, 100) };
  });
}

function invertDeltas(deltas: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(deltas).map(([id, d]) => [id, -d]));
}

/** Reverte o efeito de `oldInput` e aplica o de `newInput` — usado ao editar uma partida já registrada. */
export function reapplyTeammateMorale(
  teammates: Teammate[],
  oldInput: TeammateMoraleMatchInput | null,
  newInput: TeammateMoraleMatchInput,
  playerPosition: PlayerPosition,
): Teammate[] {
  let next = teammates;
  if (oldInput) {
    next = applyTeammateMoraleDeltas(next, invertDeltas(computeTeammateMoraleDeltas(next, oldInput, playerPosition)));
  }
  next = applyTeammateMoraleDeltas(next, computeTeammateMoraleDeltas(next, newInput, playerPosition));
  return next;
}
