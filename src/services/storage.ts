import type { Team } from '../types/Team';
import type { Player } from '../types/Player';
import type { Match } from '../types/Match';
import type { Manager } from '../types/Manager';
import type { SavedTactics } from '../types/Tactics';
import type { CareerMode } from '../types/CareerMode';
import type { CareerPlayer } from '../types/CareerPlayer';

const SAVE_KEY = 'clubos_save';

export interface GameSave {
  version: string;
  careerMode: CareerMode;
  teamId?: string;
  team?: Team;
  players?: Player[];
  matches: Match[];
  season: number;
  manager?: Manager | null;
  seasonCompetitions: string[];
  tactics?: SavedTactics | null;
  careerPlayer?: CareerPlayer;
  tutorialCompleted?: boolean;
  savedAt: string;
}

export function saveGame(data: Omit<GameSave, 'savedAt' | 'version'>): void {
  const save: GameSave = {
    ...data,
    version: '0.3.0',
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

function migrateSave(save: GameSave & { teamId?: string; team?: Team }): GameSave {
  const matches = (save.matches ?? []).map(m => ({
    ...m,
    status: m.status ?? (m.goalsFor !== undefined && m.result ? 'completed' : 'scheduled'),
    result: m.result ?? null,
    goals: m.goals ?? [],
    assists: m.assists ?? [],
    cards: m.cards ?? [],
    playerMatches: m.playerMatches ?? [],
  }));

  const careerMode: CareerMode = save.careerMode ?? 'coach';

  const base: GameSave = {
    ...save,
    version: save.version ?? '0.3.0',
    careerMode,
    manager: save.manager ?? null,
    seasonCompetitions: save.seasonCompetitions ?? [],
    tactics: save.tactics ?? null,
    tutorialCompleted: save.tutorialCompleted ?? false,
    matches,
  };

  if (careerMode === 'coach' && save.teamId && save.team) {
    return {
      ...base,
      teamId: save.teamId,
      team: save.team,
      players: save.players ?? [],
    };
  }

  if (careerMode === 'player' && save.careerPlayer) {
    return {
      ...base,
      careerPlayer: {
        ...save.careerPlayer,
        seasonStats: save.careerPlayer.seasonStats ?? { matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
        overallHistory: save.careerPlayer.overallHistory ?? [{ season: save.season ?? 2025, overall: save.careerPlayer.overall }],
        injuries: save.careerPlayer.injuries ?? [],
        careerHistory: save.careerPlayer.careerHistory ?? [],
      },
    };
  }

  if (save.teamId && save.team) {
    return {
      ...base,
      careerMode: 'coach',
      teamId: save.teamId,
      team: save.team,
      players: save.players ?? [],
    };
  }

  return base;
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function getSaveCareerMode(): CareerMode | null {
  return loadGame()?.careerMode ?? null;
}

export function clearGame(): void {
  localStorage.removeItem(SAVE_KEY);
}
