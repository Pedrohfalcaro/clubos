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
  /** Jogos como titular (presente na escalação inicial), subconjunto de `matches`. */
  starts?: number;
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
  /**
   * Data ISO (fim da Data FIFA) até quando o atleta está em serviço na Seleção
   * Nacional (v1.4). Ortogonal a `availability` — não é um novo valor da enum,
   * para não quebrar switches exaustivos existentes. `undefined`/passado = livre.
   */
  nationalDutyUntil?: string;
  /**
   * Data ISO de retorno do empréstimo. Enquanto `status === 'Emprestado'`, o atleta fica
   * bloqueado da escalação do clube; sem data definida, bloqueia indefinidamente (até o
   * status ser trocado manualmente).
   */
  loanReturnDate?: string;
  /**
   * Data ISO de aposentadoria agendada. Até essa data o atleta segue normalmente
   * disponível; ao alcançá-la, `status` vira `'Aposentado'` automaticamente (ADVANCE_DAY).
   */
  retirementDate?: string;
  /**
   * Preenchido só em `state.formerPlayers` — quando/por que o atleta saiu do elenco.
   * `stats` fica congelado como estava no momento da saída (temporada até ali).
   * `'imported'` = criado a partir de uma importação de temporada passada via JSON, não uma venda.
   */
  departedAt?: { season: number; date: string; reason: 'sold' | 'imported' };
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

/** True se o atleta está em serviço na Seleção Nacional (v1.4) — `nationalDutyUntil` ainda não passou. */
export function isOnNationalDuty(
  player: Player,
  gameDate?: string | null,
): boolean {
  if (!player.nationalDutyUntil) return false;
  const until = player.nationalDutyUntil.slice(0, 10);
  if (!gameDate) return true;
  return gameDate.slice(0, 10) <= until;
}

/** True se o atleta está emprestado e ainda não retornou (`loanReturnDate` no futuro ou indefinida). */
export function isOnLoan(player: Player, gameDate?: string | null): boolean {
  if (player.status !== 'Emprestado') return false;
  if (!player.loanReturnDate) return true;
  if (!gameDate) return true;
  return gameDate.slice(0, 10) <= player.loanReturnDate.slice(0, 10);
}

/** True se o atleta não pode ser escalado (empréstimo, lesão, suspensão na competição, indisponível, aposentado, serviço nacional). */
export function isPlayerBlockedFromLineup(
  player: Player,
  competition?: string | null,
  gameDate?: string | null,
): boolean {
  if (player.status === 'Aposentado') return true;
  if (isOnLoan(player, gameDate)) return true;
  if (isAwaitingPresentation(player, gameDate)) return true;
  if (isOnNationalDuty(player, gameDate)) return true;
  const a = player.availability ?? 'disponivel';
  if (a === 'lesionado' || a === 'indisponivel') return true;
  if (a === 'suspenso') return isSuspendedForCompetition(player, competition);
  return false;
}

export function availabilityStatusLabel(
  player: Player,
  gameDate?: string | null,
): string | null {
  if (isOnLoan(player, gameDate)) {
    return player.loanReturnDate
      ? `Emprestado até ${player.loanReturnDate.slice(0, 10)}`
      : 'Emprestado';
  }
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
  if (isOnNationalDuty(player, gameDate)) {
    return `Em Serviço Nacional até ${player.nationalDutyUntil!.slice(0, 10)}`;
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
    starts: 0,
  };
}
