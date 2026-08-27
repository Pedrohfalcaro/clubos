import { uid } from './matchEvents';
import type {
  CallUpListSize,
  FifaWindow,
  FifaWindowGame,
  FifaWindowType,
  NationalTeamState,
  OpponentStrength,
} from '../types/NationalTeam';
import { FIFA_WINDOW_TYPE_LABELS } from '../types/NationalTeam';
import type { MatchLocation } from '../types/Match';
import type { Player } from '../types/Player';
import type { SavedTactics, TacticsDraft } from '../types/Tactics';
import { resolveTactics } from './formations';

const MONTH_ABBR = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/**
 * Sugestão automática de nome para a Data FIFA: "{Competição} - {MÊS}/{ANO}"
 * (ex.: "Eliminatórias - AGO/2026"). Mês/ano vêm da data de início da janela.
 * Quando o tipo é "outros", usa o texto livre digitado no lugar do rótulo do tipo.
 */
export function suggestWindowLabel(startDate: string, type: FifaWindowType, typeOther?: string): string {
  const competitionLabel =
    type === 'outros' ? typeOther?.trim() || FIFA_WINDOW_TYPE_LABELS.outros : FIFA_WINDOW_TYPE_LABELS[type];

  const raw = startDate.slice(0, 10);
  const d = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return competitionLabel;

  const month = MONTH_ABBR[d.getMonth()];
  const year = d.getFullYear();
  return `${competitionLabel} - ${month}/${year}`;
}

export function createFifaWindow(input: {
  label?: string;
  type: FifaWindowType;
  typeOther?: string;
  startDate: string;
  endDate: string;
  listSize: CallUpListSize;
}): FifaWindow {
  return {
    id: uid(),
    label: input.label?.trim() || suggestWindowLabel(input.startDate, input.type, input.typeOther),
    type: input.type,
    typeOther: input.type === 'outros' ? input.typeOther?.trim() : undefined,
    startDate: input.startDate,
    endDate: input.endDate,
    listSize: input.listSize,
    callUpIds: [],
    callUpNumbers: {},
    games: [],
    deconvocationResolvedIds: [],
    tactics: null,
    tacticsPresets: [],
    activeTacticsId: null,
  };
}

export function createFifaWindowGame(input: {
  opponent: string;
  location: MatchLocation;
  date: string;
  opponentStrength: OpponentStrength;
}): FifaWindowGame {
  return {
    id: uid(),
    opponent: input.opponent.trim(),
    location: input.location,
    date: input.date,
    opponentStrength: input.opponentStrength,
    played: false,
  };
}

/** True se a data do jogo cai fora da janela [startDate, endDate] da Data FIFA. */
export function isGameOutsideWindow(
  window: Pick<FifaWindow, 'startDate' | 'endDate'>,
  gameDate: string,
): boolean {
  const d = gameDate.slice(0, 10);
  return d < window.startDate.slice(0, 10) || d > window.endDate.slice(0, 10);
}

/** Datas FIFA ordenadas por início (mais recente/futura primeiro). */
export function sortWindowsByStart(windows: FifaWindow[]): FifaWindow[] {
  return [...windows].sort((a, b) => b.startDate.localeCompare(a.startDate));
}

/**
 * Recalcula `Player.nationalDutyUntil` para todo o elenco a partir das convocações
 * ativas em `nationalTeam.windows` — usa o maior `endDate` entre as janelas em que o
 * convocado vinculado (`clubPlayerId`) ainda está em `callUpIds`. Sem convocação ativa
 * (removido da lista, atleta excluído, vínculo desfeito), o campo é limpo. Datas de
 * janelas já encerradas ficam inofensivas — `isOnNationalDuty` já as trata como expiradas.
 */
export function recomputeNationalDuty(
  nationalTeam: NationalTeamState,
  players: Player[],
): Player[] {
  const dutyUntilByClubPlayerId = new Map<string, string>();
  for (const w of nationalTeam.windows) {
    for (const npId of w.callUpIds) {
      const np = nationalTeam.talentPool.find(p => p.id === npId);
      if (!np?.clubPlayerId) continue;
      const current = dutyUntilByClubPlayerId.get(np.clubPlayerId);
      if (!current || w.endDate > current) {
        dutyUntilByClubPlayerId.set(np.clubPlayerId, w.endDate);
      }
    }
  }

  return players.map(p => {
    const until = dutyUntilByClubPlayerId.get(p.id);
    if (until === p.nationalDutyUntil) return p;
    return { ...p, nationalDutyUntil: until };
  });
}

/**
 * Número de camisa sugerido ao convocar `nationalPlayerId` numa nova Data FIFA:
 * o número da convocação anterior mais recente (por `startDate`) em que ele apareceu
 * em `callUpNumbers`, se houver. Sem histórico, retorna `undefined` ("—" na UI).
 */
export function carryOverCallUpNumber(
  windows: FifaWindow[],
  nationalPlayerId: string,
  beforeWindowId: string,
): number | undefined {
  const before = windows.find(w => w.id === beforeWindowId);
  if (!before) return undefined;
  const past = sortWindowsByStart(
    windows.filter(w => w.id !== beforeWindowId && w.startDate < before.startDate),
  );
  for (const w of past) {
    const n = w.callUpNumbers[nationalPlayerId];
    if (n != null) return n;
  }
  return undefined;
}

/**
 * Tática inicial de uma Data FIFA sem tática própria ainda: parte da tática da
 * Data FIFA anterior, mantendo quem repete convocação na mesma posição; quem é
 * novidade na lista entra no banco (até o limite) em vez de ficar "solto".
 */
export function carryOverTacticsDraft(
  windows: FifaWindow[],
  currentWindowId: string,
  players: Player[],
  benchMax = 9,
): TacticsDraft {
  const current = windows.find(w => w.id === currentWindowId);
  const past = current
    ? sortWindowsByStart(windows.filter(w => w.id !== currentWindowId && w.startDate < current.startDate))
    : [];
  const previousTactics: SavedTactics | null = past[0]?.tactics ?? null;

  const draft = resolveTactics(previousTactics, players);
  const placed = new Set([...draft.formation.map(f => f.playerId), ...draft.bench]);
  const newcomers = players.map(p => p.id).filter(id => !placed.has(id));
  return { ...draft, bench: [...draft.bench, ...newcomers].slice(0, benchMax) };
}

/** Índice do dia dentro da Data FIFA (1 = `startDate`), sempre dentro de [1, total de dias]. */
export function dayInWindow(window: Pick<FifaWindow, 'startDate' | 'endDate'>, date: string): number {
  const start = new Date(`${window.startDate.slice(0, 10)}T12:00:00`);
  const d = new Date(`${date.slice(0, 10)}T12:00:00`);
  const total = windowTotalDays(window);
  const idx = Math.round((d.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(1, Math.min(total, idx));
}

/** Duração total (em dias) da Data FIFA, do `startDate` ao `endDate` inclusive. */
export function windowTotalDays(window: Pick<FifaWindow, 'startDate' | 'endDate'>): number {
  const start = new Date(`${window.startDate.slice(0, 10)}T12:00:00`);
  const end = new Date(`${window.endDate.slice(0, 10)}T12:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

/** True se `date` está dentro de [startDate, endDate] da Data FIFA (inclusive). */
export function isDateWithinWindow(window: Pick<FifaWindow, 'startDate' | 'endDate'>, date: string): boolean {
  const d = date.slice(0, 10);
  return d >= window.startDate.slice(0, 10) && d <= window.endDate.slice(0, 10);
}
