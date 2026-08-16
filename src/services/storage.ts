import type { SeasonCompetition } from '../types/Competition';
import { migrateSeasonCompetitions } from '../utils/competitions';
import type { Team } from '../types/Team';
import type { Player } from '../types/Player';
import type { Match } from '../types/Match';
import type { Manager } from '../types/Manager';
import type { SavedTactics, TacticsPreset } from '../types/Tactics';
import type { CareerMode } from '../types/CareerMode';
import type { CareerPlayer } from '../types/CareerPlayer';
import { createDefaultPulseState, type PulseState } from '../pulse';
import type { ClubFinance } from '../types/Finance';
import { createDefaultFinance, createDefaultStadiumConfig } from '../types/Finance';
import { seedLiveLifeFinance } from '../utils/livelifeTemplates';
import { migrateAbsurdGateRevenue, normalizeStadiumConfig } from '../utils/finance';
import { computeFinancialHealth } from '../utils/financialHealth';
import { migrateClubDebt } from '../utils/clubDebts';
import { migrateClubSponsor } from '../utils/sponsors';
import type { LiveLifeMeta } from '../types/LiveLife';
import { createDefaultLiveLifeMeta } from '../types/LiveLife';
import type { SocialState } from '../types/Social';
import { createDefaultSocialState } from '../types/Social';
import { isPersonality } from '../pulse/utils';
import type { BoardState } from '../types/Board';
import { createDefaultBoardState } from '../types/Board';
import { migrateBoardGoal } from '../utils/boardGoals';
import type { TransferState } from '../types/Transfer';
import { createDefaultTransferState } from '../types/Transfer';
import type { SeasonArchive } from '../types/SeasonHistory';
import { normalizeAchievements } from '../types/Achievement';
import { nextDayAfterLastMatch } from '../utils/transferPayments';
import { migrateTacticsPresets, normalizeMatchLineup } from '../utils/formations';
import { recalculateFromMatches } from '../utils/matchStats';
import {
  getActiveSlotId,
  loadLocalSlot,
  migrateLegacyLocalSave,
  mirrorActiveToLegacy,
  saveLocalSlot,
  SAVE_SLOT_IDS,
  type SaveSlotId,
} from './saveSlots';

const SAVE_KEY = 'clubos_save';

export interface GameSave {
  version: string;
  careerMode: CareerMode;
  teamId?: string;
  team?: Team;
  players?: Player[];
  /** Jogadores vendidos — snapshot congelado no momento da saída, preservado para histórico. */
  formerPlayers?: Player[];
  matches: Match[];
  season: number;
  manager?: Manager | null;
  seasonCompetitions: SeasonCompetition[];
  /** @deprecated prefer tacticsPresets — espelho do preset ativo */
  tactics?: SavedTactics | null;
  tacticsPresets?: TacticsPreset[];
  activeTacticsId?: string | null;
  careerPlayer?: CareerPlayer;
  tutorialCompleted?: boolean;
  pulse?: PulseState;
  finance?: ClubFinance;
  board?: BoardState;
  transfers?: TransferState;
  seasonHistory?: SeasonArchive[];
  /** Clock contínuo LiveLife (ISO `YYYY-MM-DD`). `null` = carreira antiga sem data. */
  currentDate?: string | null;
  /** Folha do dia 5 pendente de confirmação. */
  payrollDue?: boolean;
  /** Metadados LiveLife (onboarding, etc.). */
  livelife?: LiveLifeMeta;
  /** Feed ClubOSocial. */
  social?: SocialState;
  savedAt: string;
  /** Slot de carreira (1–3) quando multi-save. */
  slotId?: SaveSlotId;
}

export function saveGame(
  data: Omit<GameSave, 'savedAt' | 'version'>,
  slotId: SaveSlotId = getActiveSlotId(),
): void {
  const save: GameSave = {
    ...data,
    slotId,
    version: '0.6.0',
    savedAt: new Date().toISOString(),
  };
  saveLocalSlot(slotId, save);
  mirrorActiveToLegacy(save);
}

export function loadGame(slotId?: SaveSlotId): GameSave | null {
  migrateLegacyLocalSave();
  const id = slotId ?? getActiveSlotId();
  const fromSlot = loadLocalSlot(id);
  if (fromSlot) return fromSlot;

  // Fallback legado
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

  function normalizePlayerDefaults(p: Player): Player {
    const availability = p.availability ?? 'disponivel';
    const needsCountdown =
      (availability === 'lesionado' || availability === 'suspenso') &&
      (p.injuryDaysRemaining == null || p.injuryDaysRemaining <= 0);
    return {
      ...p,
      morale: p.morale ?? 70,
      personality: isPersonality(p.personality) ? p.personality : 'Disciplinado',
      fatigue: p.fatigue ?? 0,
      availability,
      injuryDaysRemaining: needsCountdown ? 14 : p.injuryDaysRemaining,
      stats: {
        matches: p.stats?.matches ?? 0,
        minutes: p.stats?.minutes ?? 0,
        goals: p.stats?.goals ?? 0,
        assists: p.stats?.assists ?? 0,
        cleanSheets: p.stats?.cleanSheets ?? 0,
        yellowCards: p.stats?.yellowCards ?? 0,
        redCards: p.stats?.redCards ?? 0,
      },
      careerStats: {
        matches: p.careerStats?.matches ?? 0,
        minutes: p.careerStats?.minutes ?? 0,
        goals: p.careerStats?.goals ?? 0,
        assists: p.careerStats?.assists ?? 0,
        cleanSheets: p.careerStats?.cleanSheets ?? 0,
        yellowCards: p.careerStats?.yellowCards ?? 0,
        redCards: p.careerStats?.redCards ?? 0,
      },
    };
  }

  const playersRaw = (save.players ?? []).map(normalizePlayerDefaults);
  // Ex-jogadores (vendidos) — snapshot congelado, não passa por recalculateFromMatches.
  const formerPlayers = (save.formerPlayers ?? []).map(normalizePlayerDefaults);

  const team = save.team
    ? {
        ...save.team,
        primaryColor: save.team.primaryColor ?? '#7c3aed',
        secondaryColor: save.team.secondaryColor ?? '#e2e8f0',
        mediaConfidence: save.team.mediaConfidence ?? 50,
        supporterConfidence: save.team.supporterConfidence ?? 65,
        boardConfidence: save.team.boardConfidence ?? 70,
        achievements: normalizeAchievements(save.team.achievements, save.season ?? 1),
      }
    : save.team;

  const players =
    team && playersRaw.length
      ? recalculateFromMatches(team, playersRaw, matches).players
      : playersRaw;

  const seasonCompetitions = migrateSeasonCompetitions(save.seasonCompetitions);

  // Migrate finance: templates de estádio/premiação se vazios
  const financeRaw: ClubFinance = save.finance
    ? {
        ...createDefaultFinance(save.finance.balance, save.finance.currency ?? 'BRL'),
        ...save.finance,
        ledger: save.finance.ledger ?? [],
        prizeTable: save.finance.prizeTable ?? {},
        loans: save.finance.loans ?? [],
        loanPayments: save.finance.loanPayments ?? [],
        debts: (save.finance.debts ?? []).map(d => migrateClubDebt(d)),
        sponsors: (save.finance.sponsors ?? []).map(s => migrateClubSponsor(s)),
        stadiumConfig: save.finance.stadiumConfig
          ? normalizeStadiumConfig(
              {
                ...createDefaultStadiumConfig(save.finance.currency ?? 'BRL'),
                ...save.finance.stadiumConfig,
              },
              save.finance.currency ?? 'BRL',
            )
          : undefined,
        // monthlyBudget (v1.3): opt-in, sem default forçado — o spread de
        // `save.finance` acima já preserva o valor existente ou mantém undefined.
      }
    : createDefaultFinance(save.team?.budget ?? 5_000_000);
  const financeSeeded = seedLiveLifeFinance(financeRaw, seasonCompetitions);
  const financeMigrated = migrateAbsurdGateRevenue(financeSeeded, matches, team ?? null);

  const teamSynced =
    team && financeMigrated.balance !== team.budget
      ? { ...team, budget: financeMigrated.balance }
      : team;

  // Migrate board
  const board: BoardState = save.board
    ? {
        ...createDefaultBoardState(),
        ...save.board,
        goals: (save.board.goals ?? []).map(migrateBoardGoal),
        confidenceHistory: save.board.confidenceHistory ?? [],
        supporterHistory: save.board.supporterHistory ?? [],
        mediaHistory: save.board.mediaHistory ?? [],
      }
    : createDefaultBoardState();

  // Migrate transfers
  const transfers: TransferState = save.transfers
    ? {
        watchlist: save.transfers.watchlist ?? [],
        history: save.transfers.history ?? [],
        pendingPayments: save.transfers.pendingPayments ?? [],
      }
    : createDefaultTransferState();

  // Carreiras antigas: clock = dia seguinte ao último jogo realizado
  let currentDate = save.currentDate ?? null;
  if (!currentDate) {
    currentDate = nextDayAfterLastMatch(matches);
  }

  // health (v1.3): calculado só se ausente no save — recomputado nos checkpoints
  // do reducer (ADVANCE_DAY, folha, quitação de dívida), não a cada load.
  const finance: ClubFinance = financeMigrated.health
    ? financeMigrated
    : {
        ...financeMigrated,
        health: computeFinancialHealth({ finance: financeMigrated, players, currentDate }),
      };

  const seasonHistory: SeasonArchive[] = save.seasonHistory ?? [];
  const tacticsMigrated = migrateTacticsPresets(
    save.tactics,
    save.tacticsPresets,
    save.activeTacticsId,
  );

  const base: GameSave = {
    ...save,
    version: '0.6.0',
    careerMode,
    manager: save.manager
      ? { ...save.manager, awards: save.manager.awards ?? [] }
      : null,
    seasonCompetitions,
    tactics: tacticsMigrated.tactics,
    tacticsPresets: tacticsMigrated.tacticsPresets,
    activeTacticsId: tacticsMigrated.activeTacticsId,
    tutorialCompleted: save.tutorialCompleted ?? false,
    matches,
    pulse,
    players,
    formerPlayers,
    team: teamSynced,
    finance,
    board,
    transfers,
    seasonHistory,
    currentDate,
    payrollDue: save.payrollDue ?? false,
    livelife: {
      ...createDefaultLiveLifeMeta(),
      ...(save.livelife ?? {}),
    },
    social: {
      ...createDefaultSocialState(teamSynced?.name ?? 'Clube'),
      ...(save.social ?? {}),
      activeArc: save.social?.activeArc ?? null,
      arcHistory: save.social?.arcHistory ?? [],
    },
  };

  if (careerMode === 'coach' && save.teamId && teamSynced) {
    return {
      ...base,
      teamId: save.teamId,
      team: teamSynced,
      players,
    };
  }

  if (careerMode === 'player' && save.careerPlayer) {
    return {
      ...base,
      careerPlayer: {
        ...save.careerPlayer,
        seasonStats: save.careerPlayer.seasonStats ?? {
          matches: 0,
          minutes: 0,
          goals: 0,
          assists: 0,
          cleanSheets: 0,
          yellowCards: 0,
          redCards: 0,
        },
        overallHistory: save.careerPlayer.overallHistory ?? [{ season: save.season ?? 2026, overall: save.careerPlayer.overall }],
        injuries: save.careerPlayer.injuries ?? [],
        careerHistory: save.careerPlayer.careerHistory ?? [],
      },
    };
  }

  if (save.teamId && teamSynced) {
    return {
      ...base,
      careerMode: 'coach',
      teamId: save.teamId,
      team: teamSynced,
      players,
    };
  }

  return base;
}

export function hasSave(): boolean {
  migrateLegacyLocalSave();
  if (SAVE_SLOT_IDS.some(id => localStorage.getItem(`clubos_save_slot_${id}`))) return true;
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function getSaveCareerMode(): CareerMode | null {
  return loadGame()?.careerMode ?? null;
}

export function clearGame(): void {
  localStorage.removeItem(SAVE_KEY);
  for (const id of SAVE_SLOT_IDS) {
    localStorage.removeItem(`clubos_save_slot_${id}`);
  }
}
