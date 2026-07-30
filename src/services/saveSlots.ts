import type { CareerMode } from '../types/CareerMode';
import type { GameSave } from './storage';
import { migrateSave } from './storage';

export const MAX_SAVE_SLOTS = 3;

export type SaveSlotId = '1' | '2' | '3';

export const SAVE_SLOT_IDS: SaveSlotId[] = ['1', '2', '3'];

export interface SaveSlotSummary {
  id: SaveSlotId;
  empty: boolean;
  careerMode?: CareerMode;
  /** Time (coach) ou clube atual (player) */
  teamName?: string;
  /** Nome do jogador na carreira jogador */
  playerName?: string;
  season?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  matchesPlayed?: number;
  savedAt?: string;
}

const LOCAL_ACTIVE_KEY = 'clubos_active_slot';
const LOCAL_SLOT_PREFIX = 'clubos_save_slot_';
/** Legacy single-save key — migrado para slot 1. */
const LEGACY_SAVE_KEY = 'clubos_save';

export function isSaveSlotId(value: unknown): value is SaveSlotId {
  return value === '1' || value === '2' || value === '3';
}

export function getActiveSlotId(): SaveSlotId {
  const raw = localStorage.getItem(LOCAL_ACTIVE_KEY);
  return isSaveSlotId(raw) ? raw : '1';
}

export function setActiveSlotId(id: SaveSlotId): void {
  localStorage.setItem(LOCAL_ACTIVE_KEY, id);
}

function slotKey(id: SaveSlotId): string {
  return `${LOCAL_SLOT_PREFIX}${id}`;
}

export function summarizeSave(save: GameSave, id: SaveSlotId): SaveSlotSummary {
  const completed = (save.matches ?? []).filter(m => m.status === 'completed');
  const wins = completed.filter(m => m.result === 'win').length;
  const draws = completed.filter(m => m.result === 'draw').length;
  const losses = completed.filter(m => m.result === 'loss').length;

  if (save.careerMode === 'player') {
    if (!save.careerPlayer) return emptySlotSummary(id);
    return {
      id,
      empty: false,
      careerMode: 'player',
      teamName: save.careerPlayer.currentClub?.name,
      playerName: save.careerPlayer.name,
      season: save.season,
      wins,
      draws,
      losses,
      matchesPlayed: completed.length,
      savedAt: save.savedAt,
    };
  }

  if (!save.team || !save.teamId) return emptySlotSummary(id);

  return {
    id,
    empty: false,
    careerMode: 'coach',
    teamName: save.team.name,
    season: save.season,
    wins: save.team.statistics?.wins ?? wins,
    draws: save.team.statistics?.draws ?? draws,
    losses: save.team.statistics?.losses ?? losses,
    matchesPlayed: completed.length,
    savedAt: save.savedAt,
  };
}

export function emptySlotSummary(id: SaveSlotId): SaveSlotSummary {
  return { id, empty: true };
}

export function loadLocalSlot(id: SaveSlotId): GameSave | null {
  const raw = localStorage.getItem(slotKey(id));
  if (!raw) return null;
  try {
    return migrateSave(JSON.parse(raw) as GameSave);
  } catch {
    return null;
  }
}

export function saveLocalSlot(id: SaveSlotId, save: GameSave): void {
  localStorage.setItem(slotKey(id), JSON.stringify(save));
  setActiveSlotId(id);
}

export function clearLocalSlot(id: SaveSlotId): void {
  localStorage.removeItem(slotKey(id));
}

export function listLocalSlotSummaries(): SaveSlotSummary[] {
  migrateLegacyLocalSave();
  return SAVE_SLOT_IDS.map(id => {
    const save = loadLocalSlot(id);
    return save ? summarizeSave(save, id) : emptySlotSummary(id);
  });
}

/** Move o save antigo `clubos_save` para o slot 1 se ainda não houver slots. */
export function migrateLegacyLocalSave(): void {
  const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
  if (!legacy) return;
  const hasAnySlot = SAVE_SLOT_IDS.some(id => localStorage.getItem(slotKey(id)));
  if (!hasAnySlot) {
    localStorage.setItem(slotKey('1'), legacy);
    setActiveSlotId('1');
  }
  // Mantém o legado como espelho do slot ativo para código antigo
}

export function mirrorActiveToLegacy(save: GameSave): void {
  localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify(save));
}

export function formatSlotRecord(slot: SaveSlotSummary): string {
  if (slot.empty) return '';
  return `${slot.wins ?? 0}V · ${slot.draws ?? 0}E · ${slot.losses ?? 0}D`;
}

export function formatSlotSavedAt(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/** Save carregável (coach com time ou player com careerPlayer). */
export function isCompleteSave(save: GameSave | null | undefined): boolean {
  if (!save) return false;
  if (save.careerMode === 'player') return !!save.careerPlayer;
  return !!(save.team && save.teamId);
}

export function savedAtMs(save: { savedAt?: string } | null | undefined): number {
  if (!save?.savedAt) return 0;
  const t = Date.parse(save.savedAt);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Progresso jogável — evita que um aparelho “toque” o save (novo savedAt)
 * e sobrescreva outro com mais jogos/temporadas.
 */
export function saveProgressScore(save: GameSave | null | undefined): number {
  if (!save) return -1;
  const season = typeof save.season === 'number' ? save.season : 0;
  const completed = (save.matches ?? []).filter(m => m.status === 'completed').length;
  const wins = save.team?.statistics?.wins ?? 0;
  return season * 100_000 + completed * 100 + wins;
}

/** True se `a` deve substituir `b` na nuvem / ao mesclar. */
export function isSavePreferable(a: GameSave | null, b: GameSave | null): boolean {
  if (!a) return false;
  if (!b) return isCompleteSave(a);
  const aOk = isCompleteSave(a);
  const bOk = isCompleteSave(b);
  if (aOk !== bOk) return aOk;
  const aProg = saveProgressScore(a);
  const bProg = saveProgressScore(b);
  if (aProg !== bProg) return aProg > bProg;
  return savedAtMs(a) > savedAtMs(b);
}

/**
 * Escolhe o melhor entre nuvem e local: completo > incompleto;
 * depois mais progresso (jogos/temporada); por último savedAt.
 */
export function pickBestSave(
  cloud: GameSave | null,
  local: GameSave | null,
): GameSave | null {
  if (isSavePreferable(local, cloud)) return local;
  if (isSavePreferable(cloud, local)) return cloud;
  return cloud ?? local;
}
