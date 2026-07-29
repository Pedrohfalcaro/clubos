import type { Team } from '../types/Team';
import type { Player } from '../types/Player';
import type { Match } from '../types/Match';
import type { Manager } from '../types/Manager';
import type { SavedTactics } from '../types/Tactics';
import type { CareerMode } from '../types/CareerMode';
import type { CareerPlayer } from '../types/CareerPlayer';
import { createDefaultPulseState, type PulseState } from '../pulse';
import type { ClubFinance } from '../types/Finance';
import { createDefaultFinance } from '../types/Finance';
import type { BoardState } from '../types/Board';
import { createDefaultBoardState } from '../types/Board';
import type { TransferState } from '../types/Transfer';
import { createDefaultTransferState } from '../types/Transfer';
import type { SeasonArchive } from '../types/SeasonHistory';
import { normalizeMatchLineup, normalizeSavedTactics } from '../utils/formations';

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
  pulse?: PulseState;
  finance?: ClubFinance;
  board?: BoardState;
  transfers?: TransferState;
  seasonHistory?: SeasonArchive[];
  savedAt: string;
}

export function saveGame(data: Omit<GameSave, 'savedAt' | 'version'>): void {
  const save: GameSave = {
    ...data,
    version: '0.5.0',
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

export function migrateSave(save: GameSave & { teamId?: string; team?: Team }): GameSave {
  const matches = (save.matches ?? []).map(m => ({
    ...m,
    status: m.status ?? (m.goalsFor !== undefined && m.result ? 'completed' : 'scheduled'),
    result: m.result ?? null,
    goals: m.goals ?? [],
    assists: m.assists ?? [],
    cards: m.cards ?? [],
    playerMatches: m.playerMatches ?? [],
    lineup: m.lineup ? normalizeMatchLineup(m.lineup) : m.lineup,
  }));

  const careerMode: CareerMode = save.careerMode ?? 'coach';
  const pulse = save.pulse
    ? {
        ...createDefaultPulseState(),
        ...save.pulse,
        settings: { ...createDefaultPulseState().settings, ...save.pulse.settings },
        history: save.pulse.history ?? [],
        cooldowns: save.pulse.cooldowns ?? {},
        chains: save.pulse.chains ?? { active: [] },
        rolledMatchIds: save.pulse.rolledMatchIds ?? [],
      }
    : createDefaultPulseState();

  const players = (save.players ?? []).map(p => ({
    ...p,
    personality: p.personality ?? 'Disciplinado',
    fatigue: p.fatigue ?? 0,
    availability: p.availability ?? 'disponivel',
    stats: {
      matches: p.stats?.matches ?? 0,
      minutes: p.stats?.minutes ?? 0,
      goals: p.stats?.goals ?? 0,
      assists: p.stats?.assists ?? 0,
      yellowCards: p.stats?.yellowCards ?? 0,
      redCards: p.stats?.redCards ?? 0,
    },
    careerStats: p.careerStats ?? {
      matches: 0,
      minutes: 0,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
    },
  }));

  const team = save.team
    ? {
        ...save.team,
        primaryColor: save.team.primaryColor ?? '#7c3aed',
        secondaryColor: save.team.secondaryColor ?? '#e2e8f0',
      }
    : save.team;

  // Migrate finance: if no finance saved, create from team.budget
  const finance: ClubFinance = save.finance
    ? {
        ...createDefaultFinance(save.finance.balance),
        ...save.finance,
        ledger: save.finance.ledger ?? [],
        prizeTable: save.finance.prizeTable ?? {},
      }
    : createDefaultFinance(save.team?.budget ?? 5_000_000);

  // Migrate board
  const board: BoardState = save.board
    ? {
        ...createDefaultBoardState(),
        ...save.board,
        goals: save.board.goals ?? [],
        confidenceHistory: save.board.confidenceHistory ?? [],
      }
    : createDefaultBoardState();

  // Migrate transfers
  const transfers: TransferState = save.transfers
    ? {
        watchlist: save.transfers.watchlist ?? [],
        history: save.transfers.history ?? [],
      }
    : createDefaultTransferState();

  const seasonHistory: SeasonArchive[] = save.seasonHistory ?? [];

  const base: GameSave = {
    ...save,
    version: '0.5.0',
    careerMode,
    manager: save.manager ?? null,
    seasonCompetitions: save.seasonCompetitions ?? [],
    tactics: normalizeSavedTactics(save.tactics),
    tutorialCompleted: save.tutorialCompleted ?? false,
    matches,
    pulse,
    players,
    team,
    finance,
    board,
    transfers,
    seasonHistory,
  };

  if (careerMode === 'coach' && save.teamId && team) {
    return {
      ...base,
      teamId: save.teamId,
      team,
      players,
    };
  }

  if (careerMode === 'player' && save.careerPlayer) {
    return {
      ...base,
      careerPlayer: {
        ...save.careerPlayer,
        seasonStats: save.careerPlayer.seasonStats ?? { matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
        overallHistory: save.careerPlayer.overallHistory ?? [{ season: save.season ?? 2026, overall: save.careerPlayer.overall }],
        injuries: save.careerPlayer.injuries ?? [],
        careerHistory: save.careerPlayer.careerHistory ?? [],
      },
    };
  }

  if (save.teamId && team) {
    return {
      ...base,
      careerMode: 'coach',
      teamId: save.teamId,
      team,
      players,
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
