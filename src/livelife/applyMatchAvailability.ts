import type { Player } from '../types/Player';
import { daysBetweenIso, rollInjuryDays } from '../types/Player';
import type { TeamCardEntry, TeamInjuryEntry, CardEvent } from '../types/Match';

function sameCompetition(a?: string | null, b?: string | null): boolean {
  const left = (a ?? '').trim().toLowerCase();
  const right = (b ?? '').trim().toLowerCase();
  if (!left || !right) return false;
  return left === right;
}

/**
 * Aplica lesões (com returnDate), vermelhos (suspensão 1 partida na mesma competição)
 * e, se `tickSuspensions`, consome suspensões só quando a partida é da competição suspensa.
 */
export function applyMatchAvailability(
  players: Player[],
  input: {
    injuries?: TeamInjuryEntry[];
    cards?: CardEvent[] | TeamCardEntry[];
    gameDate: string | null;
    /** Competição da partida (suspensão é por campeonato). */
    competition?: string | null;
    /** Default true. Em edição de partida já concluída, use false. */
    tickSuspensions?: boolean;
  },
): Player[] {
  const gameDate = (input.gameDate ?? new Date().toISOString()).slice(0, 10);
  const tickSuspensions = input.tickSuspensions !== false;
  const competition = input.competition?.trim() || null;

  const injuryDays = new Map<string, number>();
  for (const inj of input.injuries ?? []) {
    if (!inj.playerId) continue;
    const days = inj.returnDate
      ? daysBetweenIso(gameDate, inj.returnDate)
      : rollInjuryDays();
    injuryDays.set(inj.playerId, days);
  }

  const redIds = new Set(
    (input.cards ?? [])
      .filter(c => c.type === 'red' && c.playerId)
      .map(c => c.playerId),
  );

  return players.map(p => {
    let next: Player = { ...p };

    const suspComp = next.suspensionCompetition?.trim();
    const ticksThisMatch =
      tickSuspensions &&
      next.availability === 'suspenso' &&
      (next.suspensionMatchesRemaining ?? 0) > 0 &&
      !injuryDays.has(p.id) &&
      !redIds.has(p.id) &&
      (
        // legado sem competição: qualquer partida consome
        !suspComp ||
        // só consome na mesma competição
        sameCompetition(suspComp, competition)
      );

    if (ticksThisMatch) {
      const rem = (next.suspensionMatchesRemaining ?? 1) - 1;
      if (rem <= 0) {
        next = {
          ...next,
          availability: 'disponivel',
          suspensionMatchesRemaining: undefined,
          suspensionCompetition: undefined,
          injuryDaysRemaining: undefined,
        };
      } else {
        next = { ...next, suspensionMatchesRemaining: rem };
      }
    }

    if (injuryDays.has(p.id)) {
      return {
        ...next,
        availability: 'lesionado' as const,
        injuryDaysRemaining: injuryDays.get(p.id),
        suspensionMatchesRemaining: undefined,
        suspensionCompetition: undefined,
      };
    }

    if (redIds.has(p.id)) {
      return {
        ...next,
        availability: 'suspenso' as const,
        suspensionMatchesRemaining: 1,
        suspensionCompetition: competition ?? undefined,
        injuryDaysRemaining: undefined,
      };
    }

    return next;
  });
}
