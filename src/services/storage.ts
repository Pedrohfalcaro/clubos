import type { Team } from '../types/Team';
import type { Player } from '../types/Player';
import type { Match } from '../types/Match';
import type { Manager } from '../types/Manager';
import type { SavedTactics } from '../types/Tactics';

const SAVE_KEY = 'clubos_save';

export interface GameSave {
  version: string;
  teamId: string;
  team: Team;
  players: Player[];
  matches: Match[];
  season: number;
  manager: Manager | null;
  seasonCompetitions: string[];
  tactics: SavedTactics | null;
  tutorialCompleted?: boolean;
  savedAt: string;
}

export function saveGame(data: Omit<GameSave, 'savedAt' | 'version'>): void {
  const save: GameSave = {
    ...data,
    version: '0.2.0',
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function loadGame(): GameSave | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GameSave;
    return migrateSave(parsed);
  } catch {
    return null;
  }
}

function migrateSave(save: GameSave): GameSave {
  const matches = (save.matches ?? []).map(m => ({
    ...m,
    status: m.status ?? (m.goalsFor !== undefined && m.result ? 'completed' : 'scheduled'),
    result: m.result ?? null,
    goals: m.goals ?? [],
    assists: m.assists ?? [],
    cards: m.cards ?? [],
    playerMatches: m.playerMatches ?? [],
  }));

  return {
    ...save,
    version: save.version ?? '0.2.0',
    manager: save.manager ?? null,
    seasonCompetitions: save.seasonCompetitions ?? [],
    tactics: save.tactics ?? null,
    tutorialCompleted: save.tutorialCompleted ?? false,
    matches,
  };
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function clearGame(): void {
  localStorage.removeItem(SAVE_KEY);
}
