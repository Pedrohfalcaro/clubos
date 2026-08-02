import type { Player } from '../types/Player';

export interface TickInjuriesResult {
  players: Player[];
  clearedIds: string[];
}

/**
 * Decrementa `injuryDaysRemaining` de lesionados/indisponíveis.
 * Suspensão por vermelho é por partida (não por dia) — não altera aqui.
 */
export function tickInjuries(players: Player[]): TickInjuriesResult {
  const clearedIds: string[] = [];
  const next = players.map(p => {
    const avail = p.availability ?? 'disponivel';
    if (avail === 'suspenso') return p;
    if (avail !== 'lesionado' && avail !== 'indisponivel') return p;

    const days = p.injuryDaysRemaining;
    if (days == null || days <= 1) {
      clearedIds.push(p.id);
      return {
        ...p,
        availability: 'disponivel' as const,
        injuryDaysRemaining: undefined,
        suspensionMatchesRemaining: undefined,
        suspensionCompetition: undefined,
      };
    }
    return { ...p, injuryDaysRemaining: days - 1 };
  });

  return { players: next, clearedIds };
}
