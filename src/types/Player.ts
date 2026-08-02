export type PlayerStatus =
  | 'Titular'
  | 'Reserva'
  | 'Promessa'
  | 'Transferível'
  | 'Emprestado'
  | 'Aposentado';

export type PlayerAvailability = 'disponivel' | 'lesionado' | 'indisponivel' | 'suspenso';

export type PlayerPosition =
  | 'GK'
  | 'CB'
  | 'RB'
  | 'LB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'RW'
  | 'LW'
  | 'ST'
  | 'CF';

export interface PlayerStats {
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  /** Jogos em que o atleta esteve em campo e o time não sofreu gols */
  cleanSheets: number;
  /** Gols sofridos pelo time enquanto o atleta (tipicamente GK) esteve em campo */
  goalsConceded?: number;
  yellowCards: number;
  redCards: number;
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  position: PlayerPosition;
  number: number | null;
  age: number;
  overall: number;
  potential: number;
  morale: number;
  salary: number;
  marketValue: number;
  /** Anos restantes de contrato (renovação fora da janela). */
  contractYearsLeft?: number;
  status: PlayerStatus;
  /** Current season stats */
  stats: PlayerStats;
  /** Career totals (accumulated across closed seasons) */
  careerStats?: PlayerStats;
  /** Pulse fields */
  personality?: string;
  fatigue?: number;
  availability?: PlayerAvailability;
  /** Dias restantes de lesão/indisponibilidade (clock LiveLife). */
  injuryDaysRemaining?: number;
  /** Partidas restantes de suspensão (ex.: vermelho = 1 = fora da próxima). */
  suspensionMatchesRemaining?: number;
  /** Competição da suspensão — só bloqueia jogos dessa competição. */
  suspensionCompetition?: string;
  /**
   * Data ISO em que o atleta se apresenta / fica disponível no elenco.
   * Enquanto `currentDate < availableFrom`, fica indisponível.
   */
  availableFrom?: string;
}

function sameCompetition(a?: string | null, b?: string | null): boolean {
  const left = (a ?? '').trim().toLowerCase();
  const right = (b ?? '').trim().toLowerCase();
  if (!left || !right) return false;
  return left === right;
}

/**
 * Suspenso para a competição informada.
 * Sem `competition` no contexto: só bloqueia suspensões legadas (sem competição definida).
 */
export function isSuspendedForCompetition(
  player: Player,
  competition?: string | null,
): boolean {
  if ((player.availability ?? 'disponivel') !== 'suspenso') return false;
  if ((player.suspensionMatchesRemaining ?? 0) <= 0) return false;
  const suspComp = player.suspensionCompetition?.trim();
  if (!suspComp) return true; // legado: suspensão global
  if (!competition?.trim()) return false;
  return sameCompetition(suspComp, competition);
}

/** True se ainda não se apresentou (availableFrom no futuro). */
export function isAwaitingPresentation(
  player: Player,
  gameDate?: string | null,
): boolean {
  if (!player.availableFrom) return false;
  const from = player.availableFrom.slice(0, 10);
  if (!gameDate) return true;
  return from > gameDate.slice(0, 10);
}

/** True se o atleta não pode ser escalado (lesão, suspensão na competição, indisponível, aposentado). */
export function isPlayerBlockedFromLineup(
  player: Player,
  competition?: string | null,
  gameDate?: string | null,
): boolean {
  if (player.status === 'Aposentado') return true;
  if (isAwaitingPresentation(player, gameDate)) return true;
  const a = player.availability ?? 'disponivel';
  if (a === 'lesionado' || a === 'indisponivel') return true;
  if (a === 'suspenso') return isSuspendedForCompetition(player, competition);
  return false;
}

export function availabilityStatusLabel(
  player: Player,
  gameDate?: string | null,
): string | null {
  if (isAwaitingPresentation(player, gameDate)) {
    return `Apresentação ${player.availableFrom!.slice(0, 10)}`;
  }
  const a = player.availability ?? 'disponivel';
  const days = player.injuryDaysRemaining;
  if (a === 'lesionado') {
    return days != null && days > 0 ? `Lesionado · ${days} dia${days === 1 ? '' : 's'}` : 'Lesionado';
  }
  if (a === 'suspenso') {
    const matches = player.suspensionMatchesRemaining;
    const comp = player.suspensionCompetition?.trim();
    const compBit = comp ? ` · ${comp}` : '';
    if (matches != null && matches > 0) {
      return matches === 1
        ? `Suspenso${compBit} · próxima`
        : `Suspenso${compBit} · ${matches} partidas`;
    }
    return days != null && days > 0
      ? `Suspenso${compBit} · ${days} dia${days === 1 ? '' : 's'}`
      : `Suspenso${compBit}`;
  }
  if (a === 'indisponivel') {
    return days != null && days > 0 ? `Indisponível · ${days} dia${days === 1 ? '' : 's'}` : 'Indisponível';
  }
  return null;
}

/** Sorteia duração de lesão em dias de jogo (padrão 7–21). */
export function rollInjuryDays(min = 7, max = 21): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Dias entre duas datas ISO (`to - from`). Mínimo 1. */
export function daysBetweenIso(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso.slice(0, 10)}T12:00:00`);
  const b = new Date(`${toIso.slice(0, 10)}T12:00:00`);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

export const PLAYER_POSITIONS: PlayerPosition[] = [
  'GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'ST', 'CF',
];

export function emptyPlayerStats(): PlayerStats {
  return {
    matches: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    goalsConceded: 0,
    yellowCards: 0,
    redCards: 0,
  };
}
