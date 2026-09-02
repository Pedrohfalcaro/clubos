import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from 'react';
import type { SeasonCompetition } from '../types/Competition';
import {
  competitionNames,
  createSeasonCompetition,
  migrateSeasonCompetitions,
  resetSeasonCompetitionsForNewSeason,
} from '../utils/competitions';
import type { Team } from '../types/Team';
import type { Player } from '../types/Player';
import type {
  CallUpListSize,
  FifaWindow,
  FifaWindowGame,
  FifaWindowType,
  NationalBoardGoal,
  NationalPlayer,
  NationalTeamState,
  OpponentStrength,
} from '../types/NationalTeam';
import {
  createDefaultNationalTeamState,
  emptyNationalPlayerStats,
  normalizeNationalTeam,
} from '../types/NationalTeam';
import {
  createFifaWindow,
  createFifaWindowGame,
  recomputeNationalDuty,
  carryOverCallUpNumber,
} from '../utils/nationalWindows';
import { applyRankingDelta, outcomeFromScore } from '../utils/nationalRanking';
import { recomputeNationalPlayerStats } from '../utils/nationalStats';
import type { Match, MatchLocation, ScheduleMatchInput, CompleteMatchInput } from '../types/Match';
import type { Manager } from '../types/Manager';
import type { TeamAchievement } from '../types/Achievement';
import { computeSeasonClosingAchievements } from '../utils/achievements';
import { uid } from '../utils/matchEvents';
import type { SavedTactics, TacticsPreset } from '../types/Tactics';
import { MAX_TACTICS_PRESETS } from '../types/Tactics';
import type { CareerMode, SetupStep } from '../types/CareerMode';
import type { CareerPlayer, ClubInfo, InjuryEntry } from '../types/CareerPlayer';
import { createDefaultCareerPlayer, emptyPlayerStats } from '../types/CareerPlayer';
import type { CompletePlayerMatchInput } from '../types/PlayerMatchPerformance';
import { clearGame, type GameSave } from '../services/storage';
import { calcResult, recalculateFromMatches, statsForPlayerFromMatches } from '../utils/matchStats';
import type { SeasonImportPayload } from '../utils/seasonImport';
import { applyDailySquadMoraleDrift, applyMatchMoraleToPlayers } from '../utils/squadMorale';
import {
  calcMatchClimateDeltas,
  clampConfidence,
  dailyClimateDrift,
  softScaleDelta,
} from '../utils/clubConfidence';
import {
  createTacticsPresetId,
  migrateTacticsPresets,
  normalizeSavedTactics,
  normalizeTacticsPreset,
  tacticsBodyFromPreset,
} from '../utils/formations';
import { applyPerformanceToStats, subtractPerformanceFromStats } from '../utils/playerStats';
import { calcMoraleChanges, applyMoraleDelta } from '../utils/playerMorale';
import type { MatchResult } from '../types/Match';
import {
  createDefaultPulseState,
  generatePulse,
  playerToPulseAthlete,
  rollDailyPulse,
  type PulseHistoryEntry,
  type PulseSettings,
  type PulseState,
} from '../pulse';
import type {
  ClubDebt,
  ClubFinance,
  ClubLoan,
  ClubLoanPayment,
  ClubSponsor,
  Currency,
  FinanceLedgerEntry,
  PrizeTableEntry,
  SponsorBonusClause,
  SponsorTier,
  StadiumConfig,
} from '../types/Finance';
import { createDefaultFinance } from '../types/Finance';
import {
  createClubLoanPackage,
  loanPaymentsDueOnDate,
  suggestPayrollBridgeLoan,
} from '../utils/clubLoans';
import {
  applyDebtPayment,
  applyPayrollDelayMorale,
  createClubDebt,
  createOverdraftDebt,
  debtsWithInstallmentDue,
  skipDebtInstallment,
} from '../utils/clubDebts';
import {
  applyMonthlySponsorPayments,
  createClubSponsor,
  hasActiveTier,
  renewSponsor,
  settleSponsorsForSeason,
} from '../utils/sponsors';
import { seedLiveLifeFinance } from '../utils/livelifeTemplates';
import type { LiveLifeMeta } from '../types/LiveLife';
import { createDefaultLiveLifeMeta } from '../types/LiveLife';
import type { SocialPost, SocialState } from '../types/Social';
import { createDefaultSocialState } from '../types/Social';
import { buildMatchHeadline } from '../utils/socialHeadlines';
import { buildTransferHeadline } from '../utils/transferHeadlines';
import { currencySymbol } from '../types/Finance';
import { newSocialPost } from '../types/Social';
import type { PressConferenceDeltas, PressContext } from '../types/PressConference';
import { nextPressFriction } from '../pressconference';
import { contextLabel, pressSpecialDone } from '../utils/pressTriggers';
import { getCategoryBreakdown, monthKeyFromDate } from '../utils/financeAnalytics';
import { clearArcPendingPress, tickStoryArc } from '../utils/storyArcs';
import type { BoardState, BoardGoal, BoardConfidenceEntry } from '../types/Board';
import { createDefaultBoardState } from '../types/Board';
import {
  tickBoardGoals,
  resolveGoalsAtSeasonEnd,
  tickLeaguePacing,
  resolveGoalManually,
  migrateBoardGoal,
  type GoalEvalContext,
  type GoalResolution,
} from '../utils/boardGoals';
import type {
  TransferState,
  WatchlistPlayer,
  TransferRecord,
  TransferPayment,
} from '../types/Transfer';
import { createDefaultTransferState } from '../types/Transfer';
import { paymentsDueOnDate, addMonthsIso } from '../utils/transferPayments';
import { isDateInTransferWindow } from '../utils/transferWindow';
import type { SeasonArchive, SeasonPlayerSnapshot } from '../types/SeasonHistory';
import { emptyTeamStats, sumPlayerStats } from '../types/SeasonHistory';
import { newLedgerEntry, wageBill, calcGateRevenue, applyMatchPrize } from '../utils/finance';
import { computeFinancialHealth } from '../utils/financialHealth';
import { advanceDay as computeAdvanceDay, findMatchOnDate, applyMatchAvailability, addDaysIso } from '../livelife';
import { useAuth } from './AuthContext';
import { emptyPlayerStats as emptySquadStats, daysBetweenIso } from '../types/Player';
import type { PlayerPosition, PlayerStats } from '../types/Player';
import type { SaveSlotId } from '../services/saveSlots';

const PLAYER_TEAM_ID = 'player-career';

/** Delta de confiança da diretoria ao estourar o teto de gastos mensal (v1.3). Mesma
 * ordem de grandeza de uma derrota (`BOARD_RESULT_DELTA.loss` em `clubConfidence.ts`). */
const BUDGET_OVERRUN_BOARD_PENALTY = -6;

export interface GameState {
  started: boolean;
  careerMode: CareerMode | null;
  setupStep: SetupStep;
  pendingTeam: Team | null;
  pendingPlayers: Player[];
  pendingCoachCountry: string | null;
  pendingCareerPlayer: Partial<CareerPlayer> | null;
  teamId: string | null;
  team: Team | null;
  manager: Manager | null;
  seasonCompetitions: SeasonCompetition[];
  players: Player[];
  /** Jogadores vendidos — snapshot congelado no momento da venda, preservado para histórico. */
  formerPlayers: Player[];
  careerPlayer: CareerPlayer | null;
  matches: Match[];
  season: number;
  tactics: SavedTactics | null;
  tacticsPresets: TacticsPreset[];
  activeTacticsId: string | null;
  tutorialCompleted: boolean;
  pulse: PulseState;
  finance: ClubFinance;
  board: BoardState;
  transfers: TransferState;
  seasonHistory: SeasonArchive[];
  /** Slot de save ativo desta carreira (1–3). */
  saveSlotId: SaveSlotId;
  /** Clock contínuo LiveLife (ISO `YYYY-MM-DD`). `null` = não ativado. */
  currentDate: string | null;
  /** Folha do dia 5 pendente de confirmação. */
  payrollDue: boolean;
  /** Modal de dados LiveLife após carregar/iniciar carreira (não persiste). */
  liveLifePromptPending: boolean;
  /** Evento Pulse diário pendente de exibição (não persiste no save). */
  pendingDailyPulse: PulseHistoryEntry | null;
  /** Metadados LiveLife persistidos (onboarding, etc.). */
  livelife: LiveLifeMeta;
  /** Feed ClubOSocial. */
  social: SocialState;
  /** Popup de parcelas de transferência vencidas (não persiste). */
  transferPaymentsDue: boolean;
  /** Popup de parcelas de empréstimo bancário (não persiste). */
  loanPaymentsDue: boolean;
  /** Popup de parcela mensal de dívida (não persiste). */
  debtPaymentsDue: boolean;
  /** Contexto de comando ativo (v1.4) — Seleção só existe quando careerMode === 'coach'. */
  activeContext: 'club' | 'national';
  /** Seleção Nacional / Dual Career (v1.4) — null até o onboarding. */
  nationalTeam: NationalTeamState | null;
}

type GameAction =
  | { type: 'SELECT_CAREER_MODE'; mode: CareerMode }
  | { type: 'SET_COACH_COUNTRY'; country: string }
  | { type: 'SET_CUSTOM_CLUB'; team: Team; players: Player[] }
  | { type: 'SET_MANAGER'; manager: Manager }
  | { type: 'UPDATE_MANAGER'; updates: Partial<Manager> }
  | { type: 'ADD_ACHIEVEMENT'; achievement: TeamAchievement }
  | { type: 'REMOVE_ACHIEVEMENT'; achievementId: string }
  | {
      type: 'START_CAREER';
      manager: Manager;
      seasonCompetitions: SeasonCompetition[];
      startDate: string;
      currency?: Currency;
      prizeTable?: Record<string, PrizeTableEntry>;
      stadiumConfig?: StadiumConfig;
      openingDebt?: {
        amount: number;
        monthlyInstallment: number;
        paymentDay?: number;
        label?: string;
      };
    }
  | { type: 'DISMISS_LIVELIFE_PROMPT' }
  | { type: 'DISMISS_DAILY_PULSE' }
  | { type: 'COMPLETE_LIVELIFE_ONBOARDING' }
  | { type: 'ADVANCE_DAY' }
  | { type: 'REWIND_DAY' }
  | { type: 'SET_CURRENT_DATE'; date: string }
  | { type: 'SET_CAREER_PLAYER'; player: Partial<CareerPlayer> }
  | { type: 'SET_PLAYER_CLUB'; club: ClubInfo; status: CareerPlayer['status']; salary: number; contractYearsLeft: number }
  | { type: 'FINISH_PLAYER_SETUP'; club: ClubInfo; status: CareerPlayer['status']; salary: number; contractYearsLeft: number; mainCompetition: string }
  | { type: 'ADD_COMPETITION'; competition: SeasonCompetition }
  | {
      type: 'UPDATE_COMPETITION';
      id: string;
      updates: Partial<Omit<SeasonCompetition, 'id'>>;
    }
  | { type: 'REMOVE_COMPETITION'; id: string }
  | { type: 'SET_SAVE_SLOT'; slotId: SaveSlotId }
  | { type: 'UPDATE_CAREER_PLAYER'; updates: Partial<CareerPlayer> }
  | { type: 'TRANSFER_PLAYER'; club: ClubInfo; salary: number; contractYears: number }
  | { type: 'ADD_INJURY'; injury: Omit<InjuryEntry, 'id'> }
  | { type: 'REMOVE_INJURY'; injuryId: string }
  | { type: 'ADVANCE_SEASON' }
  | { type: 'UPDATE_PLAYER'; playerId: string; updates: Partial<Pick<Player, 'number' | 'age' | 'overall' | 'status' | 'personality' | 'fatigue' | 'availability' | 'injuryDaysRemaining' | 'suspensionMatchesRemaining' | 'suspensionCompetition' | 'morale' | 'name' | 'position' | 'potential' | 'salary' | 'marketValue' | 'contractYearsLeft' | 'loanReturnDate' | 'retirementDate'>> }
  | {
      type: 'RENEW_PLAYER_CONTRACT';
      playerId: string;
      years: number;
      newSalary: number;
      signingBonus?: number;
      ledgerEntry?: FinanceLedgerEntry;
    }
  | { type: 'ADD_PLAYER'; player: Player }
  | { type: 'REMOVE_PLAYER'; playerId: string }
  | { type: 'SCHEDULE_MATCH'; match: Match }
  | { type: 'UPDATE_SCHEDULED_MATCH'; matchId: string; updates: ScheduleMatchInput }
  | { type: 'COMPLETE_MATCH'; input: CompleteMatchInput }
  | { type: 'UPDATE_COMPLETED_MATCH'; input: CompleteMatchInput }
  | { type: 'RECALC_SEASON_STATS' }
  | { type: 'COMPLETE_PLAYER_MATCH'; input: CompletePlayerMatchInput }
  | { type: 'UPDATE_PLAYER_MATCH'; input: CompletePlayerMatchInput }
  | { type: 'SAVE_TACTICS'; tactics: SavedTactics }
  | { type: 'SAVE_TACTICS_PRESET'; preset: TacticsPreset }
  | { type: 'DELETE_TACTICS_PRESET'; id: string }
  | { type: 'SET_ACTIVE_TACTICS'; id: string }
  | { type: 'APPLY_PULSE'; matchId: string }
  | { type: 'UPDATE_PULSE_SETTINGS'; settings: Partial<PulseSettings> }
  | { type: 'ADD_SOCIAL_POST'; post: SocialPost }
  | { type: 'MARK_SOCIAL_SEEN' }
  | {
      type: 'APPLY_PRESS_CONFERENCE';
      context: PressContext;
      matchId?: string;
      deltas: PressConferenceDeltas;
      headline: string;
      playerMorale?: { playerId: string; delta: number }[];
      aggressiveCount?: number;
      specialDoneKey?: string;
    }
  | { type: 'LOAD_SAVE'; state: Omit<GameState, 'started' | 'setupStep' | 'pendingTeam' | 'pendingPlayers' | 'pendingCoachCountry' | 'pendingCareerPlayer'> }
  | { type: 'COMPLETE_TUTORIAL' }
  | { type: 'RESET' }
  // Finance
  | { type: 'APPLY_LEDGER'; entry: FinanceLedgerEntry }
  | { type: 'PAY_WAGES' }
  | {
      type: 'PAY_WAGES_WITH_BRIDGE_LOAN';
      loan: ClubLoan;
      payments: ClubLoanPayment[];
      creditEntry: FinanceLedgerEntry;
      wageEntry: FinanceLedgerEntry;
    }
  | { type: 'DISMISS_PAYROLL' }
  | { type: 'SET_PRIZE_TABLE'; competition: string; prize: { win?: number; draw?: number; knockout?: number; champion?: number } }
  | { type: 'UPDATE_FINANCE'; updates: Partial<ClubFinance> }
  | { type: 'SET_MONTHLY_BUDGET'; targetExpenseLimit: number }
  // Board
  | { type: 'UPDATE_BOARD'; updates: Partial<BoardState> }
  | { type: 'SET_BOARD_GOAL'; goal: BoardGoal }
  | { type: 'REMOVE_BOARD_GOAL'; goalId: string }
  | { type: 'ADJUST_BOARD_CONFIDENCE'; delta: number; reason: string }
  | { type: 'ADJUST_SUPPORTER_CONFIDENCE'; delta: number; reason: string }
  | { type: 'UPDATE_GOAL_PROGRESS'; updates: { goalId: string; current: number }[] }
  | { type: 'RESOLVE_BOARD_GOALS'; resolutions: GoalResolution[] }
  | { type: 'MANUALLY_RESOLVE_GOAL'; resolution: GoalResolution }
  | {
      type: 'TICK_GOAL_PACING';
      goalId: string;
      pacingTickedGames: number;
      boardDelta: number;
      reason: string;
    }
  | { type: 'DISMISS_GOAL_PROMPT'; season: number }
  | {
      type: 'BACKFILL_FORMER_PLAYERS';
      players: Player[];
      archivePatches: { season: number; snapshot: SeasonPlayerSnapshot }[];
    }
  | { type: 'IMPORT_SEASON_ARCHIVE'; payload: SeasonImportPayload }
  | { type: 'UPDATE_TEAM'; updates: Partial<Pick<Team, 'name' | 'primaryColor' | 'secondaryColor' | 'description' | 'fans'>> }
  // Transfers
  | { type: 'ADD_WATCHLIST'; player: WatchlistPlayer }
  | { type: 'REMOVE_WATCHLIST'; playerId: string }
  | { type: 'UPDATE_WATCHLIST'; playerId: string; updates: Partial<WatchlistPlayer> }
  | {
      type: 'EXECUTE_TRANSFER';
      record: TransferRecord;
      newPlayer?: Player;
      removedPlayerId?: string;
      ledgerEntries: FinanceLedgerEntry[];
      pendingPayments?: TransferPayment[];
    }
  | { type: 'UPDATE_TRANSFER_RECORD'; transferId: string; updates: Partial<TransferRecord> }
  | { type: 'PAY_TRANSFER_PAYMENT'; paymentId: string; ledgerEntry: FinanceLedgerEntry }
  | { type: 'DISMISS_TRANSFER_PAYMENTS' }
  | {
      type: 'TAKE_CLUB_LOAN';
      loan: ClubLoan;
      payments: ClubLoanPayment[];
      creditEntry: FinanceLedgerEntry;
    }
  | { type: 'PAY_LOAN_PAYMENT'; paymentId: string; ledgerEntry: FinanceLedgerEntry }
  | { type: 'DISMISS_LOAN_PAYMENTS' }
  | { type: 'ADD_CLUB_DEBT'; debt: ClubDebt }
  | {
      type: 'PAY_CLUB_DEBT';
      debtId: string;
      amount: number;
      ledgerEntry: FinanceLedgerEntry;
      asMonthlyInstallment?: boolean;
    }
  | { type: 'DISMISS_DEBT_PAYMENTS' }
  | { type: 'ADD_CLUB_SPONSOR'; sponsor: ClubSponsor }
  | { type: 'RENEW_CLUB_SPONSOR'; sponsorId: string; extraSeasons?: number }
  | { type: 'TERMINATE_CLUB_SPONSOR'; sponsorId: string; ledgerEntry?: FinanceLedgerEntry }
  // National Team / Dual Career (v1.4)
  | { type: 'SET_ACTIVE_CONTEXT'; context: 'club' | 'national' }
  | {
      type: 'CREATE_NATIONAL_TEAM';
      name: string;
      primaryColor?: string;
      secondaryColor?: string;
      startingFifaRanking?: number;
    }
  | { type: 'ADD_FIFA_WINDOW'; window: FifaWindow }
  | { type: 'UPDATE_FIFA_WINDOW'; windowId: string; updates: Partial<Omit<FifaWindow, 'id'>> }
  | { type: 'ADD_FIFA_WINDOW_GAME'; windowId: string; game: FifaWindowGame }
  | {
      type: 'UPDATE_FIFA_WINDOW_GAME';
      windowId: string;
      gameId: string;
      updates: Partial<Omit<FifaWindowGame, 'id'>>;
    }
  | { type: 'ADD_NATIONAL_PLAYERS'; players: NationalPlayer[] }
  | { type: 'REMOVE_NATIONAL_PLAYER'; nationalPlayerId: string }
  | { type: 'LINK_NATIONAL_PLAYER_TO_CLUB'; nationalPlayerId: string; clubPlayerId: string | null }
  | { type: 'SET_CALL_UP_LIST'; windowId: string; callUpIds: string[] }
  | { type: 'SET_CALL_UP_NUMBER'; windowId: string; nationalPlayerId: string; number: number | null }
  | { type: 'SAVE_NATIONAL_TACTICS_PRESET'; windowId: string; preset: TacticsPreset }
  | { type: 'DELETE_NATIONAL_TACTICS_PRESET'; windowId: string; id: string }
  | { type: 'SET_ACTIVE_NATIONAL_TACTICS'; windowId: string; id: string }
  | { type: 'ADD_NATIONAL_GOAL'; goal: NationalBoardGoal }
  | { type: 'UPDATE_NATIONAL_GOAL'; goalId: string; updates: Partial<Omit<NationalBoardGoal, 'id'>> }
  | { type: 'REMOVE_NATIONAL_GOAL'; goalId: string }
  | { type: 'ADJUST_FEDERATION_MOOD'; delta: number; reason: string }
  | {
      type: 'RESOLVE_NATIONAL_DECONVOCATION';
      windowId: string;
      nationalPlayerId: string;
      choice: 'cede' | 'refuse';
    };

interface GameContextValue {
  state: GameState;
  selectCareerMode: (mode: CareerMode) => void;
  setCoachCountry: (country: string) => void;
  setCustomClub: (team: Team, players: Player[]) => void;
  setManager: (manager: Manager) => void;
  updateManager: (updates: Partial<Manager>) => void;
  addAchievement: (achievement: Omit<TeamAchievement, 'id'> & { id?: string }) => void;
  removeAchievement: (achievementId: string) => void;
  startCareer: (
    seasonCompetitions: string[] | SeasonCompetition[],
    slotId?: SaveSlotId,
    startDate?: string,
    options?: {
      currency?: Currency;
      prizeTable?: Record<string, PrizeTableEntry>;
      stadiumConfig?: StadiumConfig;
      openingDebt?: {
        amount: number;
        monthlyInstallment: number;
        paymentDay?: number;
        label?: string;
      };
    },
  ) => void;
  dismissLiveLifePrompt: () => void;
  dismissDailyPulse: () => void;
  completeLiveLifeOnboarding: () => void;
  advanceDay: () => { matchId: string | null };
  rewindDay: () => void;
  setCurrentDate: (date: string) => void;
  setCareerPlayer: (data: Partial<CareerPlayer>) => void;
  setPlayerClub: (data: {
    club: ClubInfo;
    status: CareerPlayer['status'];
    salary: number;
    contractYearsLeft: number;
  }) => void;
  finishPlayerSetup: (data: {
    club: ClubInfo;
    status: CareerPlayer['status'];
    salary: number;
    contractYearsLeft: number;
    mainCompetition: string;
  }) => void;
  addCompetition: (input: string | Partial<SeasonCompetition> & { name: string }) => void;
  updateCompetition: (id: string, updates: Partial<Omit<SeasonCompetition, 'id'>>) => void;
  removeCompetition: (id: string) => void;
  competitionNameList: () => string[];
  loadSavedGame: (slotId?: SaveSlotId) => Promise<CareerMode | null>;
  setSaveSlot: (slotId: SaveSlotId) => void;
  updateCareerPlayer: (updates: Partial<CareerPlayer>) => void;
  transferPlayer: (club: ClubInfo, salary: number, contractYears: number) => void;
  addInjury: (injury: Omit<InjuryEntry, 'id'>) => void;
  removeInjury: (injuryId: string) => void;
  advanceSeason: () => void;
  updatePlayer: (
    playerId: string,
    updates: Partial<Pick<Player, 'number' | 'age' | 'overall' | 'status' | 'personality' | 'fatigue' | 'availability' | 'injuryDaysRemaining' | 'suspensionMatchesRemaining' | 'suspensionCompetition' | 'morale' | 'name' | 'position' | 'potential' | 'salary' | 'marketValue' | 'contractYearsLeft' | 'loanReturnDate' | 'retirementDate'>>,
  ) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  scheduleMatch: (input: ScheduleMatchInput) => string;
  schedulePlayerMatch: (input: ScheduleMatchInput) => string;
  updateScheduledMatch: (matchId: string, updates: ScheduleMatchInput) => void;
  completeMatch: (input: CompleteMatchInput) => void;
  updateCompletedMatch: (input: CompleteMatchInput) => void;
  recalcSeasonStats: () => void;
  completePlayerMatch: (input: CompletePlayerMatchInput) => void;
  updatePlayerMatch: (input: CompletePlayerMatchInput) => void;
  saveTactics: (tactics: SavedTactics) => void;
  saveTacticsPreset: (preset: Omit<TacticsPreset, 'updatedAt'> & { updatedAt?: string }) => void;
  deleteTacticsPreset: (id: string) => void;
  setActiveTactics: (id: string) => void;
  rollPulseForMatch: (matchId: string) => void;
  updatePulseSettings: (settings: Partial<PulseSettings>) => void;
  addSocialPost: (post: SocialPost) => void;
  markSocialSeen: () => void;
  applyPressConference: (input: {
    context: PressContext;
    matchId?: string;
    deltas: PressConferenceDeltas;
    headline: string;
    playerMorale?: { playerId: string; delta: number }[];
    aggressiveCount?: number;
    specialDoneKey?: string;
  }) => void;
  completeTutorial: () => void;
  resetGame: () => void;
  getTeamPlayers: () => Player[];
  getMatch: (matchId: string) => Match | undefined;
  getSaveSnapshot: () => GameSave | null;
  // Finance
  applyLedger: (entry: FinanceLedgerEntry) => void;
  payWages: () => void;
  dismissPayroll: () => void;
  setPrizeTable: (competition: string, prize: { win?: number; draw?: number; knockout?: number; champion?: number }) => void;
  updateFinance: (updates: Partial<ClubFinance>) => void;
  setMonthlyBudget: (targetExpenseLimit: number) => void;
  // Board
  updateBoard: (updates: Partial<BoardState>) => void;
  setBoardGoal: (goal: BoardGoal) => void;
  removeBoardGoal: (goalId: string) => void;
  adjustBoardConfidence: (delta: number, reason: string) => void;
  adjustSupporterConfidence: (delta: number, reason: string) => void;
  resolveBoardGoals: (resolutions: GoalResolution[]) => void;
  manuallyResolveGoal: (goal: BoardGoal, status: 'done' | 'exceeded' | 'failed') => void;
  dismissGoalPrompt: (season: number) => void;
  importSeasonArchive: (
    payload: SeasonImportPayload,
    options?: { replace?: boolean },
  ) => { ok: true } | { ok: false; reason: 'exists' };
  updateTeam: (updates: Partial<Pick<Team, 'name' | 'primaryColor' | 'secondaryColor' | 'description' | 'fans'>>) => void;
  // Transfers
  addWatchlist: (player: WatchlistPlayer) => void;
  removeWatchlist: (playerId: string) => void;
  updateWatchlist: (playerId: string, updates: Partial<WatchlistPlayer>) => void;
  executeTransfer: (
    record: TransferRecord,
    newPlayer?: Player,
    removedPlayerId?: string,
    ledgerEntries?: FinanceLedgerEntry[],
    pendingPayments?: TransferPayment[],
  ) => void;
  updateTransferRecord: (transferId: string, updates: Partial<TransferRecord>) => void;
  payTransferPayment: (paymentId: string) => void;
  dismissTransferPayments: () => void;
  renewPlayerContract: (input: {
    playerId: string;
    years: number;
    newSalary: number;
    signingBonus?: number;
  }) => void;
  takeClubLoan: (input: {
    principal: number;
    interestRatePercent: number;
    installmentCount: number;
    firstPaymentDate: string;
    notes?: string;
  }) => void;
  /** Empréstimo-ponte (120% da folha) + pagamento da folha, quando o caixa não cobre. */
  payWagesWithBridgeLoan: () => boolean;
  payLoanPayment: (paymentId: string) => void;
  dismissLoanPayments: () => void;
  addClubDebt: (input: {
    amount: number;
    monthlyInstallment: number;
    paymentDay: number;
    label?: string;
  }) => void;
  payClubDebt: (debtId: string, amount: number, asMonthlyInstallment?: boolean) => void;
  /** Ignora parcelas do dia: aplica juros e fecha o mês. */
  dismissDebtPayments: () => void;
  addClubSponsor: (input: {
    brand: string;
    tier: SponsorTier;
    monthlyFee: number;
    seasons: number;
    paymentDay: number;
    minLeaguePosition?: number;
    terminationFee?: number;
    bonuses?: Omit<SponsorBonusClause, 'id'>[];
  }) => boolean;
  renewClubSponsor: (sponsorId: string, extraSeasons?: number) => void;
  terminateClubSponsor: (sponsorId: string) => void;
  // National Team / Dual Career (v1.4)
  /** Alterna o contexto ativo. Vira 'club' sempre; só vira 'national' se já houver `nationalTeam` (senão é no-op — abra o onboarding). */
  setActiveContext: (context: 'club' | 'national') => void;
  /** Cria a Seleção Nacional (onboarding) e já entra no Modo Seleção. */
  createNationalTeam: (input: {
    name: string;
    primaryColor?: string;
    secondaryColor?: string;
    startingFifaRanking?: number;
  }) => void;
  /** Cria e adiciona uma Data FIFA; retorna o id gerado. */
  addFifaWindow: (input: {
    label?: string;
    type: FifaWindowType;
    typeOther?: string;
    startDate: string;
    endDate: string;
    listSize: CallUpListSize;
  }) => string;
  updateFifaWindow: (windowId: string, updates: Partial<Omit<FifaWindow, 'id'>>) => void;
  /** Cria e adiciona um jogo mapeado à Data FIFA; retorna o id gerado. */
  addFifaWindowGame: (
    windowId: string,
    input: { opponent: string; location: MatchLocation; date: string; opponentStrength: OpponentStrength },
  ) => string;
  updateFifaWindowGame: (
    windowId: string,
    gameId: string,
    updates: Partial<Omit<FifaWindowGame, 'id'>>,
  ) => void;
  /** Cadastro manual de um convocado no banco de talentos; retorna o id gerado. */
  addNationalPlayer: (input: {
    name: string;
    position: PlayerPosition;
    age: number;
    club: string;
    overall?: number;
    clubPlayerId?: string;
  }) => string;
  /** Importação em lote (JSON) — mesmo shape do cadastro manual, sem dedupe. */
  importNationalPlayers: (players: NationalPlayer[]) => void;
  removeNationalPlayer: (nationalPlayerId: string) => void;
  /** Vincula/desvincula um convocado a um `Player` do elenco do clube (dispara desfalque na Fase 5). */
  linkNationalPlayerToClub: (nationalPlayerId: string, clubPlayerId: string | null) => void;
  /** Define a lista definitiva de convocados de uma Data FIFA (ajusta `caps` por diff). */
  setCallUpList: (windowId: string, callUpIds: string[]) => void;
  /** Numeração de camisa do convocado, específica desta Data FIFA. */
  setCallUpNumber: (windowId: string, nationalPlayerId: string, number: number | null) => void;
  /** Tática da Data FIFA — mesmo contrato de `saveTacticsPreset`/`deleteTacticsPreset`/`setActiveTactics`, por janela. */
  saveNationalTacticsPreset: (
    windowId: string,
    preset: Omit<TacticsPreset, 'updatedAt'> & { updatedAt?: string },
  ) => void;
  deleteNationalTacticsPreset: (windowId: string, id: string) => void;
  setActiveNationalTactics: (windowId: string, id: string) => void;
  /** Metas da diretoria/federação — CRUD independente das metas do clube (nunca lidas/escritas por `Board.tsx`). */
  addNationalGoal: (input: {
    kind: NationalBoardGoal['kind'];
    label: string;
    target: number;
  }) => void;
  updateNationalGoal: (goalId: string, updates: Partial<Omit<NationalBoardGoal, 'id'>>) => void;
  removeNationalGoal: (goalId: string) => void;
  /** Ajusta `federationMood` (clamp 0–100) e registra no histórico. */
  adjustFederationMood: (delta: number, reason: string) => void;
  /** Pulse Internacional — resolve o pedido de desconvocação do clube pra um amistoso. */
  resolveNationalDeconvocation: (
    windowId: string,
    nationalPlayerId: string,
    choice: 'cede' | 'refuse',
  ) => void;
}

const initialState: GameState = {
  started: false,
  careerMode: null,
  setupStep: 'mode',
  pendingTeam: null,
  pendingPlayers: [],
  pendingCoachCountry: null,
  pendingCareerPlayer: null,
  teamId: null,
  team: null,
  manager: null,
  seasonCompetitions: [],
  players: [],
  formerPlayers: [],
  careerPlayer: null,
  matches: [],
  season: 2026,
  tactics: null,
  tacticsPresets: [],
  activeTacticsId: null,
  tutorialCompleted: false,
  pulse: createDefaultPulseState(),
  finance: createDefaultFinance(),
  board: createDefaultBoardState(),
  transfers: createDefaultTransferState(),
  seasonHistory: [],
  saveSlotId: '1',
  currentDate: null,
  payrollDue: false,
  liveLifePromptPending: false,
  pendingDailyPulse: null,
  livelife: createDefaultLiveLifeMeta(),
  social: createDefaultSocialState(),
  transferPaymentsDue: false,
  loanPaymentsDue: false,
  debtPaymentsDue: false,
  activeContext: 'club',
  nationalTeam: null,
};

function updatePlayerFromMatch(
  player: CareerPlayer,
  perf: CompletePlayerMatchInput['performance'],
  result: MatchResult,
  isNew: boolean,
  oldPerf?: CompletePlayerMatchInput['performance'],
  oldResult?: MatchResult | null,
): CareerPlayer {
  let seasonStats = { ...player.seasonStats };
  let stats = { ...player.stats };
  let coachConfidence = player.coachConfidence;
  let fanReputation = player.fanReputation;

  if (!isNew && oldPerf && oldResult) {
    seasonStats = subtractPerformanceFromStats(seasonStats, oldPerf);
    stats = subtractPerformanceFromStats(stats, oldPerf);
    const oldMorale = calcMoraleChanges(player.position, oldResult, oldPerf);
    ({ coachConfidence, fanReputation } = applyMoraleDelta(
      coachConfidence,
      fanReputation,
      { coachConfidence: -oldMorale.coachConfidence, fanReputation: -oldMorale.fanReputation },
    ));
  }

  seasonStats = applyPerformanceToStats(seasonStats, perf);
  stats = applyPerformanceToStats(stats, perf);

  const newMorale = calcMoraleChanges(player.position, result, perf);
  ({ coachConfidence, fanReputation } = applyMoraleDelta(
    coachConfidence,
    fanReputation,
    newMorale,
  ));

  return { ...player, seasonStats, stats, coachConfidence, fanReputation };
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SELECT_CAREER_MODE':
      return {
        ...state,
        careerMode: action.mode,
        setupStep: action.mode === 'coach' ? 'team' : 'player',
      };

    case 'SET_COACH_COUNTRY':
      return { ...state, pendingCoachCountry: action.country };

    case 'SET_CUSTOM_CLUB':
      return {
        ...state,
        setupStep: 'manager',
        pendingTeam: action.team,
        pendingPlayers: action.players,
      };

    case 'SET_MANAGER':
      return { ...state, setupStep: 'competitions', manager: action.manager };

    case 'UPDATE_MANAGER': {
      if (!state.manager) return state;
      return { ...state, manager: { ...state.manager, ...action.updates } };
    }

    case 'ADD_ACHIEVEMENT': {
      if (!state.team) return state;
      const list = [...(state.team.achievements ?? []), action.achievement];
      return {
        ...state,
        team: { ...state.team, achievements: list },
      };
    }

    case 'REMOVE_ACHIEVEMENT': {
      if (!state.team) return state;
      return {
        ...state,
        team: {
          ...state.team,
          achievements: (state.team.achievements ?? []).filter(a => a.id !== action.achievementId),
        },
      };
    }

    case 'START_CAREER': {
      if (!state.pendingTeam || state.pendingPlayers.length === 0) return state;
      const team = state.pendingTeam;
      const players = state.pendingPlayers.map(p => ({ ...p, teamId: team.id }));
      const currency = action.currency ?? 'BRL';
      const baseFinance = createDefaultFinance(team.budget ?? 5_000_000, currency);
      const opening =
        action.openingDebt &&
        action.openingDebt.amount > 0 &&
        action.openingDebt.monthlyInstallment > 0
          ? [
              createClubDebt({
                amount: action.openingDebt.amount,
                monthlyInstallment: action.openingDebt.monthlyInstallment,
                paymentDay: action.openingDebt.paymentDay ?? 5,
                label: action.openingDebt.label ?? 'Dívida de abertura',
                source: 'manual',
                createdAt: action.startDate.slice(0, 10),
              }),
            ]
          : [];
      const finance = seedLiveLifeFinance(
        {
          ...baseFinance,
          prizeTable: action.prizeTable ?? {},
          stadiumConfig: action.stadiumConfig ?? baseFinance.stadiumConfig,
          debts: opening,
        },
        action.seasonCompetitions,
      );
      return {
        ...state,
        started: true,
        careerMode: 'coach',
        setupStep: 'done',
        pendingTeam: null,
        pendingPlayers: [],
        pendingCoachCountry: null,
        pendingCareerPlayer: null,
        teamId: team.id,
        team,
        manager: action.manager,
        seasonCompetitions: action.seasonCompetitions,
        players,
        careerPlayer: null,
        matches: [],
        season: 2026,
        tactics: null,
        tacticsPresets: [],
        activeTacticsId: null,
        tutorialCompleted: false,
        pulse: createDefaultPulseState(),
        finance,
        board: createDefaultBoardState(),
        transfers: createDefaultTransferState(),
        seasonHistory: [],
        currentDate: action.startDate.slice(0, 10),
        payrollDue: false,
        transferPaymentsDue: false,
        loanPaymentsDue: false,
        debtPaymentsDue: false,
        liveLifePromptPending: true,
        pendingDailyPulse: null,
        livelife: createDefaultLiveLifeMeta(),
        social: createDefaultSocialState(team.name),
      };
    }

    case 'DISMISS_LIVELIFE_PROMPT':
      return { ...state, liveLifePromptPending: false };

    case 'DISMISS_DAILY_PULSE':
      return { ...state, pendingDailyPulse: null };

    case 'COMPLETE_LIVELIFE_ONBOARDING':
      return {
        ...state,
        livelife: { ...state.livelife, onboardingComplete: true },
      };

    case 'SET_CAREER_PLAYER': {
      const base = state.pendingCareerPlayer ?? {};
      return {
        ...state,
        pendingCareerPlayer: { ...base, ...action.player },
        setupStep: 'player-club',
      };
    }

    case 'SET_PLAYER_CLUB': {
      if (!state.pendingCareerPlayer) return state;
      return {
        ...state,
        pendingCareerPlayer: {
          ...state.pendingCareerPlayer,
          currentClub: action.club,
          status: action.status,
          salary: action.salary,
          contractYearsLeft: action.contractYearsLeft,
        },
        setupStep: 'player-competitions',
      };
    }

    case 'FINISH_PLAYER_SETUP': {
      if (!state.pendingCareerPlayer?.name) return state;
      const careerPlayer = createDefaultCareerPlayer({
        name: state.pendingCareerPlayer.name,
        nationality: state.pendingCareerPlayer.nationality ?? 'Brasil',
        age: state.pendingCareerPlayer.age ?? 20,
        position: state.pendingCareerPlayer.position ?? 'ST',
        overall: Math.min(99, state.pendingCareerPlayer.overall ?? 65),
        potential: Math.min(99, state.pendingCareerPlayer.potential ?? 80),
        number: state.pendingCareerPlayer.number,
        height: state.pendingCareerPlayer.height,
        preferredFoot: state.pendingCareerPlayer.preferredFoot,
      });

      const player: CareerPlayer = {
        ...careerPlayer,
        currentClub: action.club,
        status: action.status,
        salary: action.salary,
        contractYearsLeft: action.contractYearsLeft,
        coachConfidence: 50,
        fanReputation: 50,
        careerHistory: [{
          clubName: action.club.name,
          league: action.club.league,
          country: action.club.country,
          seasonStart: state.season,
          seasonEnd: null,
          stats: emptyPlayerStats(),
        }],
        overallHistory: [{ season: state.season, overall: careerPlayer.overall }],
      };

      return {
        ...state,
        started: true,
        careerMode: 'player',
        setupStep: 'done',
        pendingCareerPlayer: null,
        careerPlayer: player,
        teamId: null,
        team: null,
        manager: null,
        players: [],
        tactics: null,
        tacticsPresets: [],
        activeTacticsId: null,
        seasonCompetitions: [createSeasonCompetition(action.mainCompetition)],
        matches: [],
        tutorialCompleted: false,
      };
    }

    case 'ADD_COMPETITION': {
      const name = action.competition.name.trim();
      if (!name) return state;
      if (state.seasonCompetitions.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        return state;
      }
      return {
        ...state,
        seasonCompetitions: [...state.seasonCompetitions, action.competition],
      };
    }

    case 'UPDATE_COMPETITION': {
      const current = state.seasonCompetitions.find(c => c.id === action.id);
      if (!current) return state;
      const nextName = action.updates.name?.trim();
      if (nextName) {
        const clash = state.seasonCompetitions.some(
          c => c.id !== action.id && c.name.toLowerCase() === nextName.toLowerCase(),
        );
        if (clash) return state;
      }
      const safeUpdates = { ...action.updates };
      delete (safeUpdates as { id?: string }).id;
      const updated: SeasonCompetition = {
        ...current,
        ...safeUpdates,
        id: current.id,
        name: nextName || current.name,
      };
      const renamed = updated.name !== current.name;
      const matches = renamed
        ? state.matches.map(m =>
            m.competition === current.name ? { ...m, competition: updated.name } : m,
          )
        : state.matches;
      let finance = state.finance;
      if (renamed && finance.prizeTable[current.name]) {
        const prizeTable = { ...finance.prizeTable };
        prizeTable[updated.name] = prizeTable[current.name];
        delete prizeTable[current.name];
        finance = { ...finance, prizeTable };
      }
      return {
        ...state,
        seasonCompetitions: state.seasonCompetitions.map(c => (c.id === action.id ? updated : c)),
        matches,
        finance,
      };
    }

    case 'REMOVE_COMPETITION': {
      if (state.seasonCompetitions.length <= 1) return state;
      return {
        ...state,
        seasonCompetitions: state.seasonCompetitions.filter(c => c.id !== action.id),
      };
    }

    case 'SET_SAVE_SLOT':
      return { ...state, saveSlotId: action.slotId };

    case 'UPDATE_CAREER_PLAYER':
      if (!state.careerPlayer) return state;
      return { ...state, careerPlayer: { ...state.careerPlayer, ...action.updates } };

    case 'TRANSFER_PLAYER': {
      if (!state.careerPlayer) return state;
      const history = [...state.careerPlayer.careerHistory];
      const currentIdx = history.findIndex(h => h.seasonEnd === null);
      if (currentIdx >= 0) {
        history[currentIdx] = {
          ...history[currentIdx],
          seasonEnd: state.season,
          stats: { ...state.careerPlayer.seasonStats },
        };
      }
      history.push({
        clubName: action.club.name,
        league: action.club.league,
        country: action.club.country,
        seasonStart: state.season,
        seasonEnd: null,
        stats: emptyPlayerStats(),
      });
      return {
        ...state,
        careerPlayer: {
          ...state.careerPlayer,
          currentClub: action.club,
          salary: action.salary,
          contractYearsLeft: action.contractYears,
          seasonStats: emptyPlayerStats(),
          careerHistory: history,
        },
      };
    }

    case 'ADD_INJURY': {
      if (!state.careerPlayer) return state;
      const injury: InjuryEntry = {
        ...action.injury,
        id: `injury-${Date.now()}`,
      };
      return {
        ...state,
        careerPlayer: {
          ...state.careerPlayer,
          injuries: [...state.careerPlayer.injuries, injury],
        },
      };
    }

    case 'REMOVE_INJURY': {
      if (!state.careerPlayer) return state;
      return {
        ...state,
        careerPlayer: {
          ...state.careerPlayer,
          injuries: state.careerPlayer.injuries.filter(i => i.id !== action.injuryId),
        },
      };
    }

    case 'ADVANCE_SEASON': {
      const newSeason = state.season + 1;

      // Player career mode
      if (state.careerMode === 'player' && state.careerPlayer) {
        return {
          ...state,
          season: newSeason,
          careerPlayer: {
            ...state.careerPlayer,
            age: state.careerPlayer.age + 1,
            contractYearsLeft: Math.max(0, state.careerPlayer.contractYearsLeft - 1),
            seasonStats: emptyPlayerStats(),
            overallHistory: [
              ...state.careerPlayer.overallHistory,
              { season: newSeason, overall: state.careerPlayer.overall },
            ],
          },
        };
      }

      // Coach mode
      if (state.careerMode === 'coach' && state.team) {
        const income = state.finance.ledger
          .filter(e => e.season === state.season && e.amount > 0)
          .reduce((s, e) => s + e.amount, 0);
        const expense = state.finance.ledger
          .filter(e => e.season === state.season && e.amount < 0)
          .reduce((s, e) => s + e.amount, 0);
        const archive: SeasonArchive = {
          season: state.season,
          closedAt: new Date().toISOString(),
          teamStats: { ...state.team.statistics },
          boardConfidence: state.team.boardConfidence,
          supporterConfidence: state.team.supporterConfidence,
          balance: state.finance.balance,
          income,
          expense,
          transferCount: state.transfers.history.filter(t => t.season === state.season).length,
          // Inclui quem foi vendido durante esta temporada — sem isso, os gols/jogos que ele
          // fez antes da venda somem do histórico assim que a temporada fecha.
          players: [
            ...state.players,
            ...state.formerPlayers.filter(p => p.departedAt?.season === state.season),
          ].map(p => ({
            playerId: p.id,
            name: p.name,
            position: p.position,
            age: p.age,
            overall: p.overall,
            stats: { ...p.stats },
          })),
        };

        const players = state.players.map(p => ({
          ...p,
          age: p.age + 1,
          contractYearsLeft:
            p.contractYearsLeft != null
              ? Math.max(0, p.contractYearsLeft - 1)
              : p.contractYearsLeft,
          careerStats: {
            matches: (p.careerStats?.matches ?? 0) + (p.stats.matches ?? 0),
            minutes: (p.careerStats?.minutes ?? 0) + (p.stats.minutes ?? 0),
            goals: (p.careerStats?.goals ?? 0) + (p.stats.goals ?? 0),
            assists: (p.careerStats?.assists ?? 0) + (p.stats.assists ?? 0),
            cleanSheets: (p.careerStats?.cleanSheets ?? 0) + (p.stats.cleanSheets ?? 0),
            yellowCards: (p.careerStats?.yellowCards ?? 0) + (p.stats.yellowCards ?? 0),
            redCards: (p.careerStats?.redCards ?? 0) + (p.stats.redCards ?? 0),
          },
          stats: emptySquadStats(),
          fatigue: 0,
        }));
        const seasonTransfersForGoals = state.transfers.history.filter(
          t => t.season === state.season,
        );
        const goalCtx: GoalEvalContext = {
          competitions: state.seasonCompetitions,
          transfersSeason: seasonTransfersForGoals,
          spentOnTransfers: seasonTransfersForGoals
            .filter(t => t.type === 'buy')
            .reduce((s, t) => s + t.fee, 0),
          wageBill: wageBill(state.players),
          debtRemaining: (state.finance.debts ?? []).reduce((s, d) => s + d.remaining, 0),
          balance: state.finance.balance,
        };
        const goalResolutions = resolveGoalsAtSeasonEnd(state.board.goals, state.season, goalCtx);
        const goals = state.board.goals.map(g => {
          const res = goalResolutions.find(r => r.goalId === g.id);
          return res ? { ...g, status: res.status, current: res.current } : g;
        });

        const closing = computeSeasonClosingAchievements({
          teamName: state.team.name,
          season: state.season,
          matches: state.matches,
          competitions: state.seasonCompetitions,
          existing: state.team.achievements ?? [],
        });

        let manager = state.manager;
        if (manager && closing.managerAwards.length) {
          manager = {
            ...manager,
            awards: [...(manager.awards ?? []), ...closing.managerAwards],
          };
        }

        const titlePosts = closing.newTitles.map(t =>
          newSocialPost({
            date: new Date().toISOString().slice(0, 10),
            type: 'headline',
            content: `${state.team!.name} campeão: ${t.competition} (${t.season})`,
            body: `Título registrado na Sala de Troféus ao fechar a temporada ${state.season}.`,
            headlineStyle: 'journalistic',
            author: 'Gazeta ClubOS',
            likes: 140 + Math.floor(Math.random() * 200),
          }),
        );

        const closeDate = new Date().toISOString().slice(0, 10);
        const sponsorSettle = settleSponsorsForSeason({
          sponsors: state.finance.sponsors ?? [],
          teamName: state.team.name,
          season: state.season,
          matches: state.matches,
          competitions: state.seasonCompetitions,
          players: state.players,
          titlesWon: closing.newTitles.map(t => t.competition),
          gameDate: closeDate,
        });
        const sponsorDelta = sponsorSettle.entries.reduce((s, e) => s + e.amount, 0);
        const financeBalance = state.finance.balance + sponsorDelta;

        let runningBoardConfidence = state.team.boardConfidence;
        let runningSupporterConfidence = state.team.supporterConfidence;
        const goalBoardHistory: BoardConfidenceEntry[] = [];
        const goalSupporterHistory: BoardConfidenceEntry[] = [];
        for (const res of goalResolutions) {
          runningBoardConfidence = clampConfidence(runningBoardConfidence + res.boardDelta);
          runningSupporterConfidence = clampConfidence(runningSupporterConfidence + res.supporterDelta);
          goalBoardHistory.push({ date: closeDate, value: runningBoardConfidence, reason: res.reason });
          goalSupporterHistory.push({
            date: closeDate,
            value: runningSupporterConfidence,
            reason: res.reason,
          });
        }

        return {
          ...state,
          season: newSeason,
          players,
          seasonCompetitions: resetSeasonCompetitionsForNewSeason(state.seasonCompetitions),
          seasonHistory: [...state.seasonHistory, archive],
          manager,
          finance: {
            ...state.finance,
            balance: financeBalance,
            sponsors: sponsorSettle.sponsors,
            ledger:
              sponsorSettle.entries.length > 0
                ? [...sponsorSettle.entries, ...state.finance.ledger]
                : state.finance.ledger,
          },
          team: {
            ...state.team,
            budget: financeBalance,
            statistics: emptyTeamStats(),
            achievements: closing.achievements,
            boardConfidence: runningBoardConfidence,
            supporterConfidence: runningSupporterConfidence,
          },
          board: {
            ...state.board,
            goals,
            confidenceHistory: [
              {
                date: closeDate,
                value: runningBoardConfidence,
                reason: `Início da temporada ${newSeason}`,
              },
              ...[...goalBoardHistory].reverse(),
              ...state.board.confidenceHistory,
            ].slice(0, 50),
            supporterHistory: [
              {
                date: closeDate,
                value: runningSupporterConfidence,
                reason: `Início da temporada ${newSeason}`,
              },
              ...[...goalSupporterHistory].reverse(),
              ...(state.board.supporterHistory ?? []),
            ].slice(0, 50),
          },
          social:
            titlePosts.length > 0
              ? {
                  ...state.social,
                  posts: [...titlePosts, ...state.social.posts].slice(0, 200),
                  unseenCount: state.social.unseenCount + titlePosts.length,
                }
              : state.social,
          pulse: {
            ...state.pulse,
            rolledMatchIds: [],
          },
        };
      }

      return state;
    }

    case 'UPDATE_PLAYER':
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.playerId ? { ...p, ...action.updates } : p,
        ),
      };

    case 'ADD_PLAYER':
      return { ...state, players: [...state.players, action.player] };

    case 'REMOVE_PLAYER':
      return { ...state, players: state.players.filter(p => p.id !== action.playerId) };

    case 'SCHEDULE_MATCH':
      return { ...state, matches: [...state.matches, action.match] };

    case 'UPDATE_SCHEDULED_MATCH':
      return {
        ...state,
        matches: state.matches.map(m =>
          m.id === action.matchId
            ? {
                ...m,
                opponent: action.updates.opponent,
                date: action.updates.date,
                location: action.updates.location,
                competition: action.updates.competition,
                significance: action.updates.significance ?? m.significance ?? 'normal',
              }
            : m,
        ),
      };

    case 'COMPLETE_MATCH': {
      if (!state.team) return state;
      const result = calcResult(action.input.goalsFor, action.input.goalsAgainst);
      const updatedMatches = state.matches.map(m =>
        m.id === action.input.matchId
          ? {
              ...m,
              status: 'completed' as const,
              goalsFor: action.input.goalsFor,
              goalsAgainst: action.input.goalsAgainst,
              result,
              goals: action.input.goals,
              assists: action.input.assists,
              cards: action.input.cards,
              playerMatches: action.input.playerMatches,
              lineup: action.input.lineup,
              substitutions: action.input.substitutions,
              injuries: action.input.injuries,
              opponentGoalScorers: action.input.opponentGoalScorers,
              opponentGoals: action.input.opponentGoals,
              opponentCards: action.input.opponentCards,
              opponentSubs: action.input.opponentSubs,
              description: action.input.description,
              playerRatings: action.input.playerRatings,
              motmPlayerId: action.input.motmPlayerId,
              worstPlayerId: action.input.worstPlayerId,
            }
          : m,
      );
      const matchComp =
        state.matches.find(m => m.id === action.input.matchId)?.competition ?? null;
      const playersWithInjury = applyMatchAvailability(state.players, {
        injuries: action.input.injuries,
        cards: action.input.cards,
        gameDate: state.currentDate,
        competition: matchComp,
      });
      const recalculated = recalculateFromMatches(
        state.team,
        playersWithInjury,
        updatedMatches,
        state.season,
      );
      const completedMatch = updatedMatches.find(m => m.id === action.input.matchId);
      const playersWithMorale = completedMatch
        ? applyMatchMoraleToPlayers(recalculated.players, completedMatch)
        : recalculated.players;

      // Board + torcida — motor dinâmico (margem, mando, importância, sequência)
      const dateStr = (state.currentDate ?? new Date().toISOString()).slice(0, 10);
      const recentResults = state.matches
        .filter(m => m.status === 'completed' && m.result && m.id !== action.input.matchId)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5)
        .map(m => m.result!);
      const scheduledMeta = state.matches.find(m => m.id === action.input.matchId);
      const climate = calcMatchClimateDeltas({
        result,
        goalsFor: action.input.goalsFor,
        goalsAgainst: action.input.goalsAgainst,
        location: scheduledMeta?.location ?? 'home',
        significance: scheduledMeta?.significance ?? 'normal',
        recentResults,
        boardConfidence: recalculated.team?.boardConfidence ?? state.team.boardConfidence,
        supporterConfidence:
          recalculated.team?.supporterConfidence ?? state.team.supporterConfidence,
      });
      const boardDelta = climate.board;
      const fanDelta = climate.supporter;
      const confReason = climate.reason;

      const newBoardConf = clampConfidence(
        (recalculated.team?.boardConfidence ?? state.team.boardConfidence) + boardDelta,
      );
      const newFanConf = clampConfidence(
        (recalculated.team?.supporterConfidence ?? state.team.supporterConfidence) + fanDelta,
      );

      let updatedBoard = state.board;
      if (boardDelta !== 0) {
        updatedBoard = {
          ...updatedBoard,
          confidenceHistory: [
            { date: dateStr, value: newBoardConf, reason: confReason },
            ...updatedBoard.confidenceHistory,
          ].slice(0, 50),
        };
      }
      if (fanDelta !== 0) {
        updatedBoard = {
          ...updatedBoard,
          supporterHistory: [
            { date: dateStr, value: newFanConf, reason: confReason },
            ...(updatedBoard.supporterHistory ?? []),
          ].slice(0, 50),
        };
      }

      const teamWithConf = recalculated.team
        ? {
            ...recalculated.team,
            boardConfidence: newBoardConf,
            supporterConfidence: newFanConf,
          }
        : recalculated.team;

      // Bilheteria + premiação automática (LiveLife)
      const matchForFinance = completedMatch ?? {
        id: action.input.matchId,
        location: state.matches.find(m => m.id === action.input.matchId)?.location ?? 'home',
        opponent: state.matches.find(m => m.id === action.input.matchId)?.opponent ?? 'Adversário',
        competition: state.matches.find(m => m.id === action.input.matchId)?.competition ?? '',
        result,
      };
      const gateEntries = teamWithConf
        ? calcGateRevenue(matchForFinance, teamWithConf, state.finance, state.season, dateStr)
        : [];
      const prizeEntry = applyMatchPrize(
        { ...matchForFinance, result },
        state.finance,
        state.season,
        dateStr,
      );
      const financeEntries = prizeEntry ? [...gateEntries, prizeEntry] : gateEntries;
      const financeDelta = financeEntries.reduce((s, e) => s + e.amount, 0);
      const nextFinance =
        financeEntries.length > 0
          ? {
              ...state.finance,
              balance: state.finance.balance + financeDelta,
              ledger: [...financeEntries, ...state.finance.ledger],
            }
          : state.finance;
      const teamWithBudget =
        teamWithConf && financeEntries.length > 0
          ? { ...teamWithConf, budget: nextFinance.balance }
          : teamWithConf;

      // Manchete ClubOSocial
      const scheduled = state.matches.find(m => m.id === action.input.matchId);
      const motmName = action.input.motmPlayerId
        ? state.players.find(p => p.id === action.input.motmPlayerId)?.name
        : undefined;
      const headlineMatch = {
        id: action.input.matchId,
        opponent: scheduled?.opponent ?? 'Adversário',
        competition: scheduled?.competition ?? '',
        goalsFor: action.input.goalsFor,
        goalsAgainst: action.input.goalsAgainst,
        location: scheduled?.location ?? 'home' as const,
        result,
        significance: scheduled?.significance ?? 'normal',
        goals: action.input.goals,
        assists: action.input.assists,
        cards: action.input.cards,
        motmPlayerId: action.input.motmPlayerId,
        motmName,
      };
      const headline = buildMatchHeadline({
        match: headlineMatch,
        teamName: state.team.name,
        gameDate: dateStr,
        result,
      });
      const social: SocialState = {
        ...state.social,
        posts: [headline, ...state.social.posts].slice(0, 200),
        unseenCount: state.social.unseenCount + 1,
      };

      return {
        ...state,
        matches: updatedMatches,
        ...recalculated,
        players: playersWithMorale,
        team: teamWithBudget ?? recalculated.team,
        board: updatedBoard,
        finance: nextFinance,
        social,
      };
    }

    case 'ADD_SOCIAL_POST': {
      return {
        ...state,
        social: {
          ...state.social,
          posts: [action.post, ...state.social.posts].slice(0, 200),
          unseenCount: state.social.unseenCount + 1,
        },
      };
    }

    case 'MARK_SOCIAL_SEEN':
      return {
        ...state,
        social: { ...state.social, unseenCount: 0 },
      };

    case 'APPLY_PRESS_CONFERENCE': {
      if (!state.team) return state;
      const dateStr = (state.currentDate ?? new Date().toISOString()).slice(0, 10);
      const {
        deltas,
        headline,
        context,
        matchId,
        playerMorale = [],
        aggressiveCount = 0,
        specialDoneKey,
      } = action;

      const newBoard = clampConfidence(
        (state.team.boardConfidence ?? 50) + deltas.boardConfidence,
      );
      const newFans = clampConfidence(
        (state.team.supporterConfidence ?? 50) + deltas.supporterConfidence,
      );
      const newMedia = clampConfidence(
        (state.team.mediaConfidence ?? 50) + (deltas.mediaConfidence ?? 0),
      );
      const pressFriction = nextPressFriction(
        state.livelife.pressFriction,
        aggressiveCount,
      );

      let board = state.board;
      const reason = `Coletiva: ${headline.slice(0, 60)}`;
      if (deltas.boardConfidence !== 0) {
        board = {
          ...board,
          confidenceHistory: [
            { date: dateStr, value: newBoard, reason },
            ...board.confidenceHistory,
          ].slice(0, 50),
        };
      }
      if (deltas.supporterConfidence !== 0) {
        board = {
          ...board,
          supporterHistory: [
            { date: dateStr, value: newFans, reason },
            ...(board.supporterHistory ?? []),
          ].slice(0, 50),
        };
      }
      if ((deltas.mediaConfidence ?? 0) !== 0) {
        board = {
          ...board,
          mediaHistory: [
            { date: dateStr, value: newMedia, reason },
            ...(board.mediaHistory ?? []),
          ].slice(0, 50),
        };
      }

      const moraleDelta = deltas.squadMorale;
      const targeted = new Map(playerMorale.map(p => [p.playerId, p.delta]));
      const players =
        moraleDelta === 0 && targeted.size === 0
          ? state.players
          : state.players.map(p => {
              if (p.availability === 'lesionado' || p.status === 'Aposentado') return p;
              const extra = targeted.get(p.id) ?? 0;
              const d = moraleDelta + extra;
              if (d === 0) return p;
              return {
                ...p,
                morale: Math.max(0, Math.min(100, Math.round((p.morale ?? 70) + d))),
              };
            });

      const fmt = (n: number) => `${n >= 0 ? '+' : ''}${n}`;
      const targetNote =
        playerMorale.length > 0
          ? ` · Reforço ${playerMorale.map(p => fmt(p.delta)).join('/')}`
          : '';
      const frictionNote =
        pressFriction >= 40 ? ` · Atrito imprensa ${pressFriction}` : '';
      const post = newSocialPost({
        date: dateStr,
        type: 'headline',
        content: headline,
        body: `Coletiva ${contextLabel(context)}. Torcida ${fmt(deltas.supporterConfidence)} · Elenco ${fmt(deltas.squadMorale)} · Diretoria ${fmt(deltas.boardConfidence)} · Mídia ${fmt(deltas.mediaConfidence ?? 0)}${targetNote}${frictionNote}.`,
        headlineStyle: 'journalistic',
        author: 'Gazeta ClubOS',
        matchId,
        likes: 90 + Math.floor(Math.random() * 160),
      });

      const preDates = [...(state.livelife.pressPreDoneDates ?? [])];
      const postIds = [...(state.livelife.pressPostDoneMatchIds ?? [])];
      const specialKeys = [...(state.livelife.pressSpecialDoneKeys ?? [])];
      if (context === 'pre_match' && matchId) {
        const m = state.matches.find(x => x.id === matchId);
        const d = (m?.date ?? dateStr).slice(0, 10);
        if (!preDates.includes(d)) preDates.push(d);
      }
      if (context === 'post_match' && matchId && !postIds.includes(matchId)) {
        postIds.push(matchId);
      }
      if (specialDoneKey && !specialKeys.includes(specialDoneKey)) {
        specialKeys.push(specialDoneKey);
      }

      const clearPending =
        context === 'story_arc' ||
        Boolean(state.social.activeArc?.pendingPress);
      const nextActiveArc = clearPending
        ? clearArcPendingPress(state.social.activeArc)
        : state.social.activeArc ?? null;

      return {
        ...state,
        team: {
          ...state.team,
          boardConfidence: newBoard,
          supporterConfidence: newFans,
          mediaConfidence: newMedia,
        },
        board,
        players,
        social: {
          ...state.social,
          activeArc: nextActiveArc,
          posts: [post, ...state.social.posts].slice(0, 200),
          unseenCount: state.social.unseenCount + 1,
        },
        livelife: {
          ...state.livelife,
          pressPreDoneDates: preDates.slice(-40),
          pressPostDoneMatchIds: postIds.slice(-80),
          pressFriction,
          pressSpecialDoneKeys: specialKeys.slice(-60),
        },
      };
    }

    case 'UPDATE_COMPLETED_MATCH': {
      if (!state.team) return state;
      const updatedMatches = state.matches.map(m =>
        m.id === action.input.matchId
          ? {
              ...m,
              goalsFor: action.input.goalsFor,
              goalsAgainst: action.input.goalsAgainst,
              result: calcResult(action.input.goalsFor, action.input.goalsAgainst),
              goals: action.input.goals,
              assists: action.input.assists,
              cards: action.input.cards,
              playerMatches: action.input.playerMatches,
              lineup: action.input.lineup,
              substitutions: action.input.substitutions,
              injuries: action.input.injuries,
              opponentGoalScorers: action.input.opponentGoalScorers,
              opponentGoals: action.input.opponentGoals,
              opponentCards: action.input.opponentCards,
              opponentSubs: action.input.opponentSubs,
              description: action.input.description,
              playerRatings: action.input.playerRatings,
              motmPlayerId: action.input.motmPlayerId,
              worstPlayerId: action.input.worstPlayerId,
            }
          : m,
      );
      const matchComp =
        state.matches.find(m => m.id === action.input.matchId)?.competition ?? null;
      const playersWithInjury = applyMatchAvailability(state.players, {
        injuries: action.input.injuries,
        cards: action.input.cards,
        gameDate: state.currentDate,
        competition: matchComp,
        tickSuspensions: false,
      });
      const recalculated = recalculateFromMatches(
        state.team,
        playersWithInjury,
        updatedMatches,
        state.season,
      );
      return { ...state, matches: updatedMatches, ...recalculated };
    }

    case 'RECALC_SEASON_STATS': {
      // Recuperação para saves com `player.stats`/`team.statistics` contaminados por
      // partidas de temporadas anteriores (bug antigo do `recalculateFromMatches` sem
      // filtro de temporada) — reconstrói os dois só a partir dos jogos da temporada atual.
      if (!state.team) return state;
      const recalculated = recalculateFromMatches(
        state.team,
        state.players,
        state.matches,
        state.season,
      );
      return { ...state, ...recalculated };
    }

    case 'COMPLETE_PLAYER_MATCH': {
      if (!state.careerPlayer) return state;
      const matchResult = calcResult(action.input.goalsFor, action.input.goalsAgainst);
      const updatedMatches = state.matches.map(m =>
        m.id === action.input.matchId
          ? {
              ...m,
              status: 'completed' as const,
              goalsFor: action.input.goalsFor,
              goalsAgainst: action.input.goalsAgainst,
              result: matchResult,
              clubName: m.clubName ?? state.careerPlayer!.currentClub.name,
              playerPerformance: action.input.performance,
            }
          : m,
      );
      const updatedPlayer = updatePlayerFromMatch(
        state.careerPlayer,
        action.input.performance,
        matchResult,
        true,
      );
      return { ...state, matches: updatedMatches, careerPlayer: updatedPlayer };
    }

    case 'UPDATE_PLAYER_MATCH': {
      if (!state.careerPlayer) return state;
      const existing = state.matches.find(m => m.id === action.input.matchId);
      const oldPerf = existing?.playerPerformance;
      const matchResult = calcResult(action.input.goalsFor, action.input.goalsAgainst);
      const updatedMatches = state.matches.map(m =>
        m.id === action.input.matchId
          ? {
              ...m,
              goalsFor: action.input.goalsFor,
              goalsAgainst: action.input.goalsAgainst,
              result: matchResult,
              playerPerformance: action.input.performance,
            }
          : m,
      );
      const updatedPlayer = updatePlayerFromMatch(
        state.careerPlayer,
        action.input.performance,
        matchResult,
        false,
        oldPerf,
        existing?.result,
      );
      return { ...state, matches: updatedMatches, careerPlayer: updatedPlayer };
    }

    case 'SAVE_TACTICS': {
      const body = normalizeSavedTactics({
        ...action.tactics,
        updatedAt: action.tactics.updatedAt ?? new Date().toISOString(),
      });
      if (!body) return { ...state, tactics: null };

      const activeId = state.activeTacticsId;
      if (activeId && state.tacticsPresets.some(p => p.id === activeId)) {
        const tacticsPresets = state.tacticsPresets.map(p =>
          p.id === activeId
            ? { ...body, id: p.id, name: p.name }
            : p,
        );
        return { ...state, tactics: body, tacticsPresets };
      }

      // Sem preset ativo: cria o primeiro
      if (state.tacticsPresets.length === 0) {
        const preset: TacticsPreset = {
          ...body,
          id: createTacticsPresetId(),
          name: 'Principal',
        };
        return {
          ...state,
          tactics: body,
          tacticsPresets: [preset],
          activeTacticsId: preset.id,
        };
      }

      return { ...state, tactics: body };
    }

    case 'SAVE_TACTICS_PRESET': {
      const normalized = normalizeTacticsPreset({
        ...action.preset,
        updatedAt: action.preset.updatedAt ?? new Date().toISOString(),
      });
      if (!normalized) return state;

      const exists = state.tacticsPresets.some(p => p.id === normalized.id);
      if (!exists && state.tacticsPresets.length >= MAX_TACTICS_PRESETS) return state;

      const tacticsPresets = exists
        ? state.tacticsPresets.map(p => (p.id === normalized.id ? normalized : p))
        : [...state.tacticsPresets, normalized];

      return {
        ...state,
        tacticsPresets,
        activeTacticsId: normalized.id,
        tactics: tacticsBodyFromPreset(normalized),
      };
    }

    case 'DELETE_TACTICS_PRESET': {
      const tacticsPresets = state.tacticsPresets.filter(p => p.id !== action.id);
      if (tacticsPresets.length === state.tacticsPresets.length) return state;
      const activeTacticsId =
        state.activeTacticsId === action.id
          ? tacticsPresets[0]?.id ?? null
          : state.activeTacticsId;
      const active = tacticsPresets.find(p => p.id === activeTacticsId);
      return {
        ...state,
        tacticsPresets,
        activeTacticsId,
        tactics: active ? tacticsBodyFromPreset(active) : null,
      };
    }

    case 'SET_ACTIVE_TACTICS': {
      const active = state.tacticsPresets.find(p => p.id === action.id);
      if (!active) return state;
      return {
        ...state,
        activeTacticsId: action.id,
        tactics: tacticsBodyFromPreset(active),
      };
    }

    case 'APPLY_PULSE': {
      if (!state.team) return state;
      if (state.pulse.rolledMatchIds.includes(action.matchId)) return state;

      const recentResults = state.matches
        .filter(m => m.status === 'completed' && m.result)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5)
        .map(m => m.result!);

      const output = generatePulse({
        club: {
          id: state.team.id,
          nome: state.team.name,
          temporadaAtual: state.season,
          boardConfidence: state.team.boardConfidence,
          supporterConfidence: state.team.supporterConfidence,
          mediaConfidence: state.team.mediaConfidence ?? 50,
        },
        athletes: state.players.map(playerToPulseAthlete),
        pulseState: state.pulse,
        matchId: action.matchId,
        recentResults,
      });

      const players = state.players.map(p => {
        const patch = output.athletePatches.find(x => x.id === p.id);
        if (!patch) return p;
        const nextAvail = patch.availability ?? p.availability;
        const outDays = patch.injuryDaysRemaining;
        const cleared = nextAvail === 'disponivel';
        return {
          ...p,
          morale: patch.moral ?? p.morale,
          fatigue: patch.fadiga ?? p.fatigue,
          availability: nextAvail,
          injuryDaysRemaining: cleared
            ? undefined
            : outDays != null
              ? outDays
              : p.injuryDaysRemaining,
          suspensionMatchesRemaining: cleared ? undefined : p.suspensionMatchesRemaining,
          suspensionCompetition: cleared ? undefined : p.suspensionCompetition,
        };
      });

      let finance = state.finance;
      let team = state.team;
      let board = state.board;
      const pulseDate = (state.currentDate ?? new Date().toISOString()).slice(0, 10);

      if (output.financePatch && output.financePatch.amount !== 0) {
        const entry = newLedgerEntry(
          output.financePatch.amount >= 0 ? 'other_in' : 'other_out',
          output.financePatch.amount,
          output.financePatch.label,
          state.season,
          undefined,
          state.currentDate ?? undefined,
        );
        finance = {
          ...finance,
          balance: finance.balance + entry.amount,
          ledger: [entry, ...finance.ledger],
        };
        team = { ...team, budget: finance.balance };
      }

      if (output.climatePatch && team) {
        const bDelta = output.climatePatch.board ?? 0;
        const fDelta = output.climatePatch.supporter ?? 0;
        const mDelta = output.climatePatch.media ?? 0;
        if (bDelta || fDelta || mDelta) {
          const newBoard = clampConfidence((team.boardConfidence ?? 50) + bDelta);
          const newFans = clampConfidence((team.supporterConfidence ?? 50) + fDelta);
          const newMedia = clampConfidence((team.mediaConfidence ?? 50) + mDelta);
          team = {
            ...team,
            boardConfidence: newBoard,
            supporterConfidence: newFans,
            mediaConfidence: newMedia,
          };
          if (bDelta) {
            board = {
              ...board,
              confidenceHistory: [
                { date: pulseDate, value: newBoard, reason: output.climatePatch.reason },
                ...board.confidenceHistory,
              ].slice(0, 50),
            };
          }
          if (fDelta) {
            board = {
              ...board,
              supporterHistory: [
                { date: pulseDate, value: newFans, reason: output.climatePatch.reason },
                ...(board.supporterHistory ?? []),
              ].slice(0, 50),
            };
          }
          if (mDelta) {
            board = {
              ...board,
              mediaHistory: [
                { date: pulseDate, value: newMedia, reason: output.climatePatch.reason },
                ...(board.mediaHistory ?? []),
              ].slice(0, 50),
            };
          }
        }
      }

      return {
        ...state,
        players,
        pulse: output.pulseState,
        finance,
        team,
        board,
      };
    }

    case 'UPDATE_PULSE_SETTINGS':
      return {
        ...state,
        pulse: {
          ...state.pulse,
          settings: { ...state.pulse.settings, ...action.settings },
        },
      };

    case 'COMPLETE_TUTORIAL':
      return { ...state, tutorialCompleted: true };

    case 'ADVANCE_DAY': {
      if (!state.currentDate) return state;
      const result = computeAdvanceDay({
        currentDate: state.currentDate,
        matches: state.matches,
        players: state.players,
      });
      const dayOfMonth = Number(result.nextDate.slice(8, 10));
      const payrollDue =
        state.payrollDue || (dayOfMonth === 5 && wageBill(state.players) > 0);
      const transferPaymentsDue =
        state.transferPaymentsDue ||
        paymentsDueOnDate(state.transfers.pendingPayments ?? [], result.nextDate).length > 0;
      const loanPaymentsDue =
        state.loanPaymentsDue ||
        loanPaymentsDueOnDate(state.finance.loanPayments ?? [], result.nextDate).length > 0;
      const debtPaymentsDue =
        state.debtPaymentsDue ||
        debtsWithInstallmentDue(state.finance.debts ?? [], result.nextDate).length > 0;

      let players = applyDailySquadMoraleDrift(result.players);
      // Apresentação de atletas contratados
      players = players.map(p => {
        if (!p.availableFrom) return p;
        if (p.availableFrom.slice(0, 10) > result.nextDate) return p;
        return {
          ...p,
          availableFrom: undefined,
          availability:
            p.availability === 'lesionado' || p.availability === 'suspenso'
              ? p.availability
              : 'disponivel',
        };
      });
      // Retorno de empréstimo e aposentadoria agendada (transições automáticas por data).
      players = players.map(p => {
        if (
          p.status === 'Emprestado' &&
          p.loanReturnDate &&
          p.loanReturnDate.slice(0, 10) <= result.nextDate
        ) {
          return { ...p, status: 'Reserva' as const, loanReturnDate: undefined };
        }
        if (p.retirementDate && p.retirementDate.slice(0, 10) <= result.nextDate) {
          return { ...p, status: 'Aposentado' as const, retirementDate: undefined };
        }
        return p;
      });
      let pulse = state.pulse;
      let pendingDailyPulse: PulseHistoryEntry | null = null;
      let finance = state.finance;
      let team = state.team;
      let board = state.board;
      let livelife = state.livelife;

      // Cotas mensais de patrocínio no dia configurado de cada contrato
      if ((finance.sponsors?.length ?? 0) > 0) {
        const paid = applyMonthlySponsorPayments(
          finance.sponsors ?? [],
          result.nextDate,
          state.season,
        );
        if (paid.entries.length > 0) {
          const credit = paid.entries.reduce((s, e) => s + e.amount, 0);
          const newBalance = finance.balance + credit;
          finance = {
            ...finance,
            balance: newBalance,
            sponsors: paid.sponsors,
            ledger: [...paid.entries, ...finance.ledger],
          };
          if (team) team = { ...team, budget: newBalance };
        }
      }

      // Pulse diário: só se o novo dia não for dia de jogo e houver time
      const nextHasMatch = findMatchOnDate(state.matches, result.nextDate);
      if (!nextHasMatch && state.team) {
        // Oscilação natural do clima em dias sem jogo
        if (team) {
          const drift = dailyClimateDrift({
            boardConfidence: team.boardConfidence ?? 50,
            supporterConfidence: team.supporterConfidence ?? 50,
            mediaConfidence: team.mediaConfidence ?? 50,
          });
          if (drift.board || drift.supporter || drift.media) {
            const newBoard = clampConfidence((team.boardConfidence ?? 50) + drift.board);
            const newFans = clampConfidence((team.supporterConfidence ?? 50) + drift.supporter);
            const newMedia = clampConfidence((team.mediaConfidence ?? 50) + drift.media);
            team = {
              ...team,
              boardConfidence: newBoard,
              supporterConfidence: newFans,
              mediaConfidence: newMedia,
            };
            if (drift.board && drift.reason) {
              board = {
                ...board,
                confidenceHistory: [
                  { date: result.nextDate, value: newBoard, reason: drift.reason },
                  ...board.confidenceHistory,
                ].slice(0, 50),
              };
            }
            if (drift.supporter && drift.reason) {
              board = {
                ...board,
                supporterHistory: [
                  { date: result.nextDate, value: newFans, reason: drift.reason },
                  ...(board.supporterHistory ?? []),
                ].slice(0, 50),
              };
            }
            if (drift.media && drift.reason) {
              board = {
                ...board,
                mediaHistory: [
                  { date: result.nextDate, value: newMedia, reason: drift.reason },
                  ...(board.mediaHistory ?? []),
                ].slice(0, 50),
              };
            }
          }
        }

        const rolled = rollDailyPulse({
          team: team ?? state.team,
          players,
          pulseState: state.pulse,
          season: state.season,
          matches: state.matches,
        });
        if (rolled) {
          pulse = rolled.output.pulseState;
          pendingDailyPulse = rolled.entry;
          players = players.map(p => {
            const patch = rolled.output.athletePatches.find(x => x.id === p.id);
            if (!patch) return p;
            const nextAvail = patch.availability ?? p.availability;
            const outDays = patch.injuryDaysRemaining;
            const cleared = nextAvail === 'disponivel';
            return {
              ...p,
              morale: patch.moral ?? p.morale,
              fatigue: patch.fadiga ?? p.fatigue,
              availability: nextAvail,
              injuryDaysRemaining: cleared
                ? undefined
                : outDays != null
                  ? outDays
                  : p.injuryDaysRemaining,
              suspensionMatchesRemaining: cleared ? undefined : p.suspensionMatchesRemaining,
              suspensionCompetition: cleared ? undefined : p.suspensionCompetition,
            };
          });
          if (rolled.output.financePatch && rolled.output.financePatch.amount !== 0) {
            const entry = newLedgerEntry(
              rolled.output.financePatch.amount >= 0 ? 'other_in' : 'other_out',
              rolled.output.financePatch.amount,
              rolled.output.financePatch.label,
              state.season,
              undefined,
              result.nextDate,
            );
            finance = {
              ...finance,
              balance: finance.balance + entry.amount,
              ledger: [entry, ...finance.ledger],
            };
            team = team ? { ...team, budget: finance.balance } : team;
          }
          if (rolled.output.climatePatch && team) {
            const bDelta = rolled.output.climatePatch.board ?? 0;
            const fDelta = rolled.output.climatePatch.supporter ?? 0;
            const mDelta = rolled.output.climatePatch.media ?? 0;
            if (bDelta || fDelta || mDelta) {
              const newBoard = clampConfidence((team.boardConfidence ?? 50) + bDelta);
              const newFans = clampConfidence((team.supporterConfidence ?? 50) + fDelta);
              const newMedia = clampConfidence((team.mediaConfidence ?? 50) + mDelta);
              team = {
                ...team,
                boardConfidence: newBoard,
                supporterConfidence: newFans,
                mediaConfidence: newMedia,
              };
              if (bDelta) {
                board = {
                  ...board,
                  confidenceHistory: [
                    {
                      date: result.nextDate,
                      value: newBoard,
                      reason: rolled.output.climatePatch.reason,
                    },
                    ...board.confidenceHistory,
                  ].slice(0, 50),
                };
              }
              if (fDelta) {
                board = {
                  ...board,
                  supporterHistory: [
                    {
                      date: result.nextDate,
                      value: newFans,
                      reason: rolled.output.climatePatch.reason,
                    },
                    ...(board.supporterHistory ?? []),
                  ].slice(0, 50),
                };
              }
              if (mDelta) {
                board = {
                  ...board,
                  mediaHistory: [
                    {
                      date: result.nextDate,
                      value: newMedia,
                      reason: rolled.output.climatePatch.reason,
                    },
                    ...(board.mediaHistory ?? []),
                  ].slice(0, 50),
                };
              }
            }
          }
        }
      }

      // Story Arcs — capítulos no ClubOSocial ao avançar o dia
      let social = state.social;
      {
        const recentResults = state.matches
          .filter(m => m.status === 'completed' && m.result)
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 5)
          .map(m => m.result!);
        const arcTick = tickStoryArc({
          today: result.nextDate,
          activeArc: state.social.activeArc,
          history: state.social.arcHistory,
          recentResults,
          players,
          boardConfidence: team?.boardConfidence ?? state.team?.boardConfidence ?? 50,
          mediaConfidence: team?.mediaConfidence ?? state.team?.mediaConfidence ?? 50,
          pressFriction: state.livelife.pressFriction ?? 0,
          hasMatchToday: Boolean(nextHasMatch),
        });

        if (arcTick.newPost || arcTick.started || arcTick.completed || arcTick.activeArc !== state.social.activeArc) {
          social = {
            ...social,
            activeArc: arcTick.activeArc,
            arcHistory: arcTick.history,
            posts: arcTick.newPost
              ? [arcTick.newPost, ...social.posts].slice(0, 200)
              : social.posts,
            unseenCount: arcTick.newPost
              ? social.unseenCount + 1
              : social.unseenCount,
          };
        }

        const d = arcTick.deltas;
        if (team && (d.board || d.media || d.supporter || d.squadMorale)) {
          const newBoard = clampConfidence((team.boardConfidence ?? 50) + d.board);
          const newFans = clampConfidence((team.supporterConfidence ?? 50) + d.supporter);
          const newMedia = clampConfidence((team.mediaConfidence ?? 50) + d.media);
          team = {
            ...team,
            boardConfidence: newBoard,
            supporterConfidence: newFans,
            mediaConfidence: newMedia,
          };
          if (d.board) {
            board = {
              ...board,
              confidenceHistory: [
                {
                  date: result.nextDate,
                  value: newBoard,
                  reason: arcTick.newPost?.content?.slice(0, 60) ?? 'Story Arc',
                },
                ...board.confidenceHistory,
              ].slice(0, 50),
            };
          }
          if (d.supporter) {
            board = {
              ...board,
              supporterHistory: [
                {
                  date: result.nextDate,
                  value: newFans,
                  reason: 'Story Arc',
                },
                ...(board.supporterHistory ?? []),
              ].slice(0, 50),
            };
          }
          if (d.media) {
            board = {
              ...board,
              mediaHistory: [
                {
                  date: result.nextDate,
                  value: newMedia,
                  reason: 'Story Arc',
                },
                ...(board.mediaHistory ?? []),
              ].slice(0, 50),
            };
          }
          if (d.squadMorale) {
            players = players.map(p => {
              if (p.availability === 'lesionado' || p.status === 'Aposentado') return p;
              return {
                ...p,
                morale: Math.max(
                  0,
                  Math.min(100, Math.round((p.morale ?? 70) + d.squadMorale)),
                ),
              };
            });
          }
        }
      }

      // Teto de gastos mensal (v1.3): ao fechar um mês (virada para o dia 1), se o
      // clube estourou o teto definido, penaliza a diretoria 1x por mês (cooldown
      // reaproveitado de pressTriggers — mesma chave `budget:YYYY-MM`).
      if (dayOfMonth === 1 && state.currentDate && finance.monthlyBudget) {
        const closedMonth = monthKeyFromDate(state.currentDate);
        const cooldownKey = `budget:${closedMonth}`;
        if (!pressSpecialDone(livelife, cooldownKey)) {
          const breakdown = getCategoryBreakdown(finance.ledger, closedMonth);
          if (breakdown.total > finance.monthlyBudget.targetExpenseLimit) {
            livelife = {
              ...livelife,
              pressSpecialDoneKeys: [...(livelife.pressSpecialDoneKeys ?? []), cooldownKey].slice(-60),
            };
            if (team) {
              const penalty = softScaleDelta(team.boardConfidence ?? 50, BUDGET_OVERRUN_BOARD_PENALTY);
              if (penalty) {
                const newBoardConf = clampConfidence((team.boardConfidence ?? 50) + penalty);
                team = { ...team, boardConfidence: newBoardConf };
                board = {
                  ...board,
                  confidenceHistory: [
                    {
                      date: result.nextDate,
                      value: newBoardConf,
                      reason: 'Estouro do teto de gastos mensal',
                    },
                    ...board.confidenceHistory,
                  ].slice(0, 50),
                };
              }
            }
          }
        }
      }

      finance = {
        ...finance,
        health: computeFinancialHealth({ finance, players, currentDate: result.nextDate }),
      };

      return {
        ...state,
        currentDate: result.nextDate,
        players,
        pulse,
        payrollDue,
        transferPaymentsDue,
        loanPaymentsDue,
        debtPaymentsDue,
        pendingDailyPulse,
        finance,
        team,
        board,
        social,
        livelife,
      };
    }

    case 'REWIND_DAY': {
      if (!state.currentDate) return state;
      return {
        ...state,
        currentDate: addDaysIso(state.currentDate, -1),
      };
    }

    case 'SET_CURRENT_DATE': {
      const date = action.date.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return state;
      return { ...state, currentDate: date };
    }

    case 'LOAD_SAVE': {
      const tacticsState = migrateTacticsPresets(
        action.state.tactics,
        action.state.tacticsPresets,
        action.state.activeTacticsId,
      );
      return {
        started: true,
        setupStep: 'done',
        pendingTeam: null,
        pendingPlayers: [],
        pendingCoachCountry: null,
        pendingCareerPlayer: null,
        ...action.state,
        tactics: tacticsState.tactics,
        tacticsPresets: tacticsState.tacticsPresets,
        activeTacticsId: tacticsState.activeTacticsId,
        seasonCompetitions: migrateSeasonCompetitions(action.state.seasonCompetitions),
        saveSlotId: action.state.saveSlotId ?? '1',
        pulse: action.state.pulse ?? createDefaultPulseState(),
        finance: action.state.finance ?? createDefaultFinance(),
        board: action.state.board ?? createDefaultBoardState(),
        transfers: {
          ...createDefaultTransferState(),
          ...(action.state.transfers ?? {}),
          pendingPayments: action.state.transfers?.pendingPayments ?? [],
        },
        seasonHistory: action.state.seasonHistory ?? [],
        currentDate: action.state.currentDate ?? null,
        payrollDue: action.state.payrollDue ?? false,
        transferPaymentsDue: Boolean(
          action.state.currentDate &&
            paymentsDueOnDate(
              action.state.transfers?.pendingPayments ?? [],
              action.state.currentDate,
            ).length,
        ),
        loanPaymentsDue: Boolean(
          action.state.currentDate &&
            loanPaymentsDueOnDate(
              action.state.finance?.loanPayments ?? [],
              action.state.currentDate,
            ).length,
        ),
        debtPaymentsDue: Boolean(
          action.state.currentDate &&
            debtsWithInstallmentDue(
              action.state.finance?.debts ?? [],
              action.state.currentDate,
            ).length,
        ),
        liveLifePromptPending: true,
        pendingDailyPulse: null,
        livelife: {
          ...createDefaultLiveLifeMeta(),
          ...(action.state.livelife ?? {}),
        },
        social: {
          ...createDefaultSocialState(action.state.team?.name ?? 'Clube'),
          ...(action.state.social ?? {}),
          activeArc: action.state.social?.activeArc ?? null,
          arcHistory: action.state.social?.arcHistory ?? [],
        },
        activeContext: action.state.activeContext ?? 'club',
        nationalTeam: normalizeNationalTeam(action.state.nationalTeam),
      };
    }

    case 'RESET':
      return initialState;

    // ─── Finance ───────────────────────────────────────────────────────────────

    case 'APPLY_LEDGER': {
      const newBalance = state.finance.balance + action.entry.amount;
      const updatedTeam = state.team ? { ...state.team, budget: newBalance } : state.team;
      return {
        ...state,
        team: updatedTeam,
        finance: {
          ...state.finance,
          balance: newBalance,
          ledger: [action.entry, ...state.finance.ledger],
        },
      };
    }

    case 'PAY_WAGES': {
      const bill = wageBill(state.players);
      if (bill <= 0) return { ...state, payrollDue: false };
      const gameDate = state.currentDate ?? new Date().toISOString().slice(0, 10);
      const entry = newLedgerEntry(
        'wage',
        -bill,
        'Folha salarial',
        state.season,
        undefined,
        gameDate,
      );
      let newBalance = state.finance.balance - bill;
      let debts = [...(state.finance.debts ?? [])];
      const ledger = [entry, ...state.finance.ledger];
      if (newBalance < 0) {
        debts = [createOverdraftDebt(-newBalance, gameDate), ...debts];
        newBalance = 0;
      }
      const updatedTeam = state.team ? { ...state.team, budget: newBalance } : state.team;
      const financeAfterWages = {
        ...state.finance,
        balance: newBalance,
        ledger,
        debts,
      };
      return {
        ...state,
        payrollDue: false,
        team: updatedTeam,
        finance: {
          ...financeAfterWages,
          health: computeFinancialHealth({
            finance: financeAfterWages,
            players: state.players,
            currentDate: gameDate,
          }),
        },
      };
    }

    case 'PAY_WAGES_WITH_BRIDGE_LOAN': {
      const { loan, payments, creditEntry, wageEntry } = action;
      const newBalance =
        state.finance.balance + creditEntry.amount + wageEntry.amount;
      const financeAfterBridge = {
        ...state.finance,
        balance: newBalance,
        ledger: [wageEntry, creditEntry, ...state.finance.ledger],
        loans: [loan, ...(state.finance.loans ?? [])],
        loanPayments: [...(state.finance.loanPayments ?? []), ...payments],
      };
      return {
        ...state,
        payrollDue: false,
        team: state.team ? { ...state.team, budget: newBalance } : state.team,
        finance: {
          ...financeAfterBridge,
          health: computeFinancialHealth({
            finance: financeAfterBridge,
            players: state.players,
            currentDate: state.currentDate,
          }),
        },
        loanPaymentsDue:
          state.loanPaymentsDue ||
          (state.currentDate
            ? loanPaymentsDueOnDate(payments, state.currentDate).length > 0
            : false),
      };
    }

    case 'DISMISS_PAYROLL':
      return {
        ...state,
        payrollDue: false,
        players: applyPayrollDelayMorale(state.players),
      };

    case 'SET_PRIZE_TABLE': {
      return {
        ...state,
        finance: {
          ...state.finance,
          prizeTable: { ...state.finance.prizeTable, [action.competition]: action.prize },
        },
      };
    }

    case 'UPDATE_FINANCE':
      return { ...state, finance: { ...state.finance, ...action.updates } };

    case 'SET_MONTHLY_BUDGET': {
      const rounded = Math.round(action.targetExpenseLimit);
      const targetExpenseLimit = Number.isFinite(rounded)
        ? Math.max(0, rounded)
        : (state.finance.monthlyBudget?.targetExpenseLimit ?? 0);
      return {
        ...state,
        finance: {
          ...state.finance,
          monthlyBudget: {
            targetExpenseLimit,
            updatedAt: state.currentDate ?? state.finance.monthlyBudget?.updatedAt ?? '1970-01-01',
          },
        },
      };
    }

    // ─── Board ─────────────────────────────────────────────────────────────────

    case 'UPDATE_BOARD':
      return { ...state, board: { ...state.board, ...action.updates } };

    case 'SET_BOARD_GOAL': {
      const exists = state.board.goals.find(g => g.id === action.goal.id);
      const goals = exists
        ? state.board.goals.map(g => g.id === action.goal.id ? action.goal : g)
        : [...state.board.goals, action.goal];
      return { ...state, board: { ...state.board, goals } };
    }

    case 'REMOVE_BOARD_GOAL':
      return { ...state, board: { ...state.board, goals: state.board.goals.filter(g => g.id !== action.goalId) } };

    case 'ADJUST_BOARD_CONFIDENCE': {
      if (!state.team) return state;
      const newConf = Math.max(0, Math.min(100, state.team.boardConfidence + action.delta));
      const entry = { date: new Date().toISOString().slice(0, 10), value: newConf, reason: action.reason };
      return {
        ...state,
        team: { ...state.team, boardConfidence: newConf },
        board: {
          ...state.board,
          confidenceHistory: [entry, ...state.board.confidenceHistory].slice(0, 50),
        },
      };
    }

    case 'ADJUST_SUPPORTER_CONFIDENCE': {
      if (!state.team) return state;
      const newConf = clampConfidence(state.team.supporterConfidence + action.delta);
      const entry = { date: new Date().toISOString().slice(0, 10), value: newConf, reason: action.reason };
      return {
        ...state,
        team: { ...state.team, supporterConfidence: newConf },
        board: {
          ...state.board,
          supporterHistory: [entry, ...(state.board.supporterHistory ?? [])].slice(0, 50),
        },
      };
    }

    case 'UPDATE_GOAL_PROGRESS': {
      if (!action.updates.length) return state;
      const byId = new Map(action.updates.map(u => [u.goalId, u.current]));
      const goals = state.board.goals.map(g =>
        byId.has(g.id) ? { ...g, current: byId.get(g.id)! } : g,
      );
      return { ...state, board: { ...state.board, goals } };
    }

    case 'RESOLVE_BOARD_GOALS': {
      if (!state.team || !action.resolutions.length) return state;
      const byId = new Map(action.resolutions.map(r => [r.goalId, r]));
      const goals = state.board.goals.map(g => {
        const res = byId.get(g.id);
        return res ? { ...g, status: res.status, current: res.current } : g;
      });

      const date = state.currentDate ?? new Date().toISOString().slice(0, 10);
      let board = state.team.boardConfidence;
      let supporter = state.team.supporterConfidence;
      const boardEntries: BoardConfidenceEntry[] = [];
      const supporterEntries: BoardConfidenceEntry[] = [];
      for (const res of action.resolutions) {
        board = clampConfidence(board + res.boardDelta);
        supporter = clampConfidence(supporter + res.supporterDelta);
        boardEntries.push({ date, value: board, reason: res.reason });
        supporterEntries.push({ date, value: supporter, reason: res.reason });
      }

      return {
        ...state,
        team: { ...state.team, boardConfidence: board, supporterConfidence: supporter },
        board: {
          ...state.board,
          goals,
          confidenceHistory: [...boardEntries.reverse(), ...state.board.confidenceHistory].slice(0, 50),
          supporterHistory: [
            ...supporterEntries.reverse(),
            ...(state.board.supporterHistory ?? []),
          ].slice(0, 50),
        },
      };
    }

    case 'MANUALLY_RESOLVE_GOAL': {
      if (!state.team) return state;
      const res = action.resolution;
      const goal = state.board.goals.find(g => g.id === res.goalId);
      if (!goal || goal.status !== 'active') return state;

      const goals = state.board.goals.map(g =>
        g.id === res.goalId
          ? { ...g, status: res.status, current: res.current, resolvedManually: true }
          : g,
      );
      const date = state.currentDate ?? new Date().toISOString().slice(0, 10);
      const board = clampConfidence(state.team.boardConfidence + res.boardDelta);
      const supporter = clampConfidence(state.team.supporterConfidence + res.supporterDelta);

      return {
        ...state,
        team: { ...state.team, boardConfidence: board, supporterConfidence: supporter },
        board: {
          ...state.board,
          goals,
          confidenceHistory: [{ date, value: board, reason: res.reason }, ...state.board.confidenceHistory].slice(0, 50),
          supporterHistory: [
            { date, value: supporter, reason: res.reason },
            ...(state.board.supporterHistory ?? []),
          ].slice(0, 50),
        },
      };
    }

    case 'TICK_GOAL_PACING': {
      if (!state.team) return state;
      const goals = state.board.goals.map(g =>
        g.id === action.goalId ? { ...g, pacingTickedGames: action.pacingTickedGames } : g,
      );
      if (action.boardDelta === 0) {
        return { ...state, board: { ...state.board, goals } };
      }
      const date = state.currentDate ?? new Date().toISOString().slice(0, 10);
      const board = clampConfidence(state.team.boardConfidence + action.boardDelta);
      return {
        ...state,
        team: { ...state.team, boardConfidence: board },
        board: {
          ...state.board,
          goals,
          confidenceHistory: [{ date, value: board, reason: action.reason }, ...state.board.confidenceHistory].slice(0, 50),
        },
      };
    }

    case 'DISMISS_GOAL_PROMPT':
      return { ...state, board: { ...state.board, goalPromptDismissedSeason: action.season } };

    case 'BACKFILL_FORMER_PLAYERS': {
      if (!action.players.length && !action.archivePatches.length) return state;
      const existingIds = new Set(state.formerPlayers.map(p => p.id));
      const toAdd = action.players.filter(p => !existingIds.has(p.id));

      const seasonHistory = action.archivePatches.length
        ? state.seasonHistory.map(arch => {
            const patches = action.archivePatches.filter(p => p.season === arch.season);
            if (!patches.length) return arch;
            const existingPlayerIds = new Set(arch.players.map(x => x.playerId));
            const snapshotsToAdd = patches
              .filter(p => !existingPlayerIds.has(p.snapshot.playerId))
              .map(p => p.snapshot);
            return snapshotsToAdd.length
              ? { ...arch, players: [...arch.players, ...snapshotsToAdd] }
              : arch;
          })
        : state.seasonHistory;

      return {
        ...state,
        formerPlayers: toAdd.length ? [...state.formerPlayers, ...toAdd] : state.formerPlayers,
        seasonHistory,
      };
    }

    case 'IMPORT_SEASON_ARCHIVE': {
      if (!state.team) return state;
      const { payload } = action;
      const nameKey = (n: string) => n.trim().toLowerCase();
      const playersByName = new Map(state.players.map(p => [nameKey(p.name), p]));
      const formerByName = new Map(state.formerPlayers.map(p => [nameKey(p.name), p]));

      let players = state.players;
      let formerPlayers = state.formerPlayers;
      const newFormer: Player[] = [];
      const snapshots: SeasonPlayerSnapshot[] = [];

      for (const imp of payload.players) {
        const stats: PlayerStats = {
          matches: imp.matches ?? 0,
          minutes: imp.minutes ?? 0,
          goals: imp.goals ?? 0,
          assists: imp.assists ?? 0,
          cleanSheets: imp.cleanSheets ?? 0,
          goalsConceded: 0,
          yellowCards: imp.yellowCards ?? 0,
          redCards: imp.redCards ?? 0,
        };
        const key = nameKey(imp.name);
        const existingActive = playersByName.get(key);
        const existingFormer = existingActive ? undefined : formerByName.get(key);
        const matched = existingActive ?? existingFormer;

        let playerId: string;
        if (matched) {
          playerId = matched.id;
          const bumpedCareer = sumPlayerStats([matched.careerStats ?? emptySquadStats(), stats]);
          if (existingActive) {
            players = players.map(p => (p.id === matched.id ? { ...p, careerStats: bumpedCareer } : p));
          } else {
            formerPlayers = formerPlayers.map(p =>
              p.id === matched.id ? { ...p, careerStats: bumpedCareer } : p,
            );
          }
        } else {
          playerId = `import-${uid()}`;
          newFormer.push({
            id: playerId,
            teamId: state.teamId ?? '',
            name: imp.name,
            position: imp.position,
            number: null,
            age: imp.age ?? 0,
            overall: imp.overall ?? 0,
            potential: imp.overall ?? 0,
            morale: 70,
            salary: 0,
            marketValue: 0,
            status: 'Transferível',
            stats,
            departedAt: { season: payload.season, date: `${payload.season}-12-31`, reason: 'imported' },
          });
        }

        snapshots.push({
          playerId,
          name: imp.name,
          position: imp.position,
          age: imp.age ?? 0,
          overall: imp.overall ?? 0,
          stats,
        });
      }

      const t = payload.team ?? {};
      const archive: SeasonArchive = {
        season: payload.season,
        closedAt: new Date().toISOString(),
        teamStats: {
          matches: t.matches ?? 0,
          wins: t.wins ?? 0,
          draws: t.draws ?? 0,
          losses: t.losses ?? 0,
          goalsFor: t.goalsFor ?? 0,
          goalsAgainst: t.goalsAgainst ?? 0,
          points: (t.wins ?? 0) * 3 + (t.draws ?? 0),
        },
        boardConfidence: t.boardConfidence ?? state.team.boardConfidence,
        supporterConfidence: t.supporterConfidence ?? state.team.supporterConfidence,
        balance: t.balance ?? 0,
        income: t.income ?? 0,
        expense: t.expense ?? 0,
        transferCount: t.transferCount ?? 0,
        players: snapshots,
      };

      const existingIdx = state.seasonHistory.findIndex(s => s.season === payload.season);
      const seasonHistory =
        existingIdx !== -1
          ? state.seasonHistory.map((s, i) => (i === existingIdx ? archive : s))
          : [...state.seasonHistory, archive];

      return {
        ...state,
        players,
        formerPlayers: newFormer.length ? [...formerPlayers, ...newFormer] : formerPlayers,
        seasonHistory,
      };
    }

    case 'UPDATE_TEAM': {
      if (!state.team) return state;
      return { ...state, team: { ...state.team, ...action.updates } };
    }

    // ─── Transfers ─────────────────────────────────────────────────────────────

    case 'ADD_WATCHLIST':
      return { ...state, transfers: { ...state.transfers, watchlist: [...state.transfers.watchlist, action.player] } };

    case 'REMOVE_WATCHLIST':
      return { ...state, transfers: { ...state.transfers, watchlist: state.transfers.watchlist.filter(p => p.id !== action.playerId) } };

    case 'UPDATE_WATCHLIST':
      return {
        ...state,
        transfers: {
          ...state.transfers,
          watchlist: state.transfers.watchlist.map(p =>
            p.id === action.playerId ? { ...p, ...action.updates } : p,
          ),
        },
      };

    case 'EXECUTE_TRANSFER': {
      const { record, newPlayer, removedPlayerId, ledgerEntries, pendingPayments = [] } = action;
      const dealDate = (state.currentDate ?? record.date).slice(0, 10);
      if (!isDateInTransferWindow(dealDate)) {
        return state; // fora da janela: só renovações
      }
      let players = state.players;
      let formerPlayers = state.formerPlayers;
      let finance = state.finance;

      if (removedPlayerId && record.type === 'sell') {
        const sold = players.find(p => p.id === removedPlayerId);
        players = players.filter(p => p.id !== removedPlayerId);
        if (sold) {
          formerPlayers = [
            ...formerPlayers,
            { ...sold, departedAt: { season: state.season, date: dealDate, reason: 'sold' } },
          ];
        }
      }
      if (newPlayer) {
        players = [...players, newPlayer];
      }
      if (record.type === 'loan_out' && removedPlayerId) {
        const loanReturnDate = addMonthsIso(dealDate, record.loanDurationMonths ?? 6);
        players = players.map(p =>
          p.id === removedPlayerId ? { ...p, status: 'Emprestado' as const, loanReturnDate } : p,
        );
      }

      let newBalance = finance.balance;
      const newLedger = [...finance.ledger];
      for (const e of ledgerEntries) {
        newBalance += e.amount;
        newLedger.unshift(e);
      }

      const updatedTeam = state.team ? { ...state.team, budget: newBalance } : state.team;
      finance = { ...finance, balance: newBalance, ledger: newLedger };

      const watchlist = state.transfers.watchlist.filter(w => w.id !== record.playerId);
      const today = (state.currentDate ?? new Date().toISOString()).slice(0, 10);
      const dueNow = paymentsDueOnDate(pendingPayments, today);

      const headline = buildTransferHeadline({
        record,
        teamName: state.team?.name ?? 'Clube',
        currencySymbol: currencySymbol(finance.currency),
        gameDate: today,
      });

      return {
        ...state,
        players,
        formerPlayers,
        team: updatedTeam,
        finance,
        transferPaymentsDue: state.transferPaymentsDue || dueNow.length > 0,
        transfers: {
          ...state.transfers,
          watchlist,
          history: [record, ...state.transfers.history],
          pendingPayments: [
            ...(state.transfers.pendingPayments ?? []),
            ...pendingPayments,
          ],
        },
        social: {
          ...state.social,
          posts: [headline, ...state.social.posts].slice(0, 200),
          unseenCount: state.social.unseenCount + 1,
        },
      };
    }

    case 'UPDATE_TRANSFER_RECORD': {
      return {
        ...state,
        transfers: {
          ...state.transfers,
          history: state.transfers.history.map(r =>
            r.id === action.transferId ? { ...r, ...action.updates } : r,
          ),
        },
      };
    }

    case 'PAY_TRANSFER_PAYMENT': {
      const payment = (state.transfers.pendingPayments ?? []).find(p => p.id === action.paymentId);
      if (!payment || payment.status === 'paid') return state;

      const entry = action.ledgerEntry;
      const newBalance = state.finance.balance + entry.amount;
      const pendingPayments = (state.transfers.pendingPayments ?? []).map(p =>
        p.id === action.paymentId
          ? { ...p, status: 'paid' as const, ledgerEntryId: entry.id }
          : p,
      );
      const stillDue = state.currentDate
        ? paymentsDueOnDate(pendingPayments, state.currentDate).length > 0
        : false;

      return {
        ...state,
        finance: {
          ...state.finance,
          balance: newBalance,
          ledger: [entry, ...state.finance.ledger],
        },
        team: state.team ? { ...state.team, budget: newBalance } : state.team,
        transferPaymentsDue: stillDue,
        transfers: {
          ...state.transfers,
          pendingPayments,
          history: state.transfers.history.map(r =>
            r.id === payment.transferId
              ? { ...r, ledgerEntryIds: [...r.ledgerEntryIds, entry.id] }
              : r,
          ),
        },
      };
    }

    case 'DISMISS_TRANSFER_PAYMENTS':
      return { ...state, transferPaymentsDue: false };

    case 'RENEW_PLAYER_CONTRACT': {
      const player = state.players.find(p => p.id === action.playerId);
      if (!player) return state;
      const years = Math.max(1, Math.round(action.years));
      const newSalary = Math.max(0, Math.round(action.newSalary));
      let finance = state.finance;
      if (action.ledgerEntry) {
        const newBalance = finance.balance + action.ledgerEntry.amount;
        finance = {
          ...finance,
          balance: newBalance,
          ledger: [action.ledgerEntry, ...finance.ledger],
        };
      }
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.playerId
            ? { ...p, salary: newSalary, contractYearsLeft: years }
            : p,
        ),
        finance,
        team: state.team ? { ...state.team, budget: finance.balance } : state.team,
      };
    }

    case 'TAKE_CLUB_LOAN': {
      const { loan, payments, creditEntry } = action;
      const newBalance = state.finance.balance + creditEntry.amount;
      return {
        ...state,
        finance: {
          ...state.finance,
          balance: newBalance,
          ledger: [creditEntry, ...state.finance.ledger],
          loans: [loan, ...(state.finance.loans ?? [])],
          loanPayments: [...(state.finance.loanPayments ?? []), ...payments],
        },
        team: state.team ? { ...state.team, budget: newBalance } : state.team,
        loanPaymentsDue:
          state.loanPaymentsDue ||
          (state.currentDate
            ? loanPaymentsDueOnDate(payments, state.currentDate).length > 0
            : false),
      };
    }

    case 'PAY_LOAN_PAYMENT': {
      const payment = (state.finance.loanPayments ?? []).find(p => p.id === action.paymentId);
      if (!payment || payment.status === 'paid') return state;
      const entry = action.ledgerEntry;
      const newBalance = state.finance.balance + entry.amount;
      const loanPayments = (state.finance.loanPayments ?? []).map(p =>
        p.id === action.paymentId
          ? { ...p, status: 'paid' as const, ledgerEntryId: entry.id }
          : p,
      );
      const loanFullyPaid = loanPayments
        .filter(p => p.loanId === payment.loanId)
        .every(p => p.status === 'paid');
      const loans = (state.finance.loans ?? []).map(l =>
        l.id === payment.loanId && loanFullyPaid ? { ...l, status: 'paid' as const } : l,
      );
      const stillDue = state.currentDate
        ? loanPaymentsDueOnDate(loanPayments, state.currentDate).length > 0
        : false;
      return {
        ...state,
        finance: {
          ...state.finance,
          balance: newBalance,
          ledger: [entry, ...state.finance.ledger],
          loanPayments,
          loans,
        },
        team: state.team ? { ...state.team, budget: newBalance } : state.team,
        loanPaymentsDue: stillDue,
      };
    }

    case 'DISMISS_LOAN_PAYMENTS':
      return { ...state, loanPaymentsDue: false };

    case 'ADD_CLUB_DEBT': {
      return {
        ...state,
        finance: {
          ...state.finance,
          debts: [action.debt, ...(state.finance.debts ?? [])],
        },
      };
    }

    case 'PAY_CLUB_DEBT': {
      const debt = (state.finance.debts ?? []).find(d => d.id === action.debtId);
      if (!debt || debt.status === 'paid' || debt.remaining <= 0) return state;
      const gameDate = state.currentDate ?? action.ledgerEntry.date;
      const updated = applyDebtPayment(debt, action.amount, gameDate, {
        asMonthlyInstallment: action.asMonthlyInstallment,
      });
      const paid = debt.remaining - updated.remaining;
      if (paid <= 0) return state;
      const entry =
        action.ledgerEntry.amount === -paid
          ? action.ledgerEntry
          : { ...action.ledgerEntry, amount: -paid };
      const newBalance = state.finance.balance + entry.amount;
      const debts = (state.finance.debts ?? []).map(d =>
        d.id === action.debtId ? updated : d,
      );
      const stillDue = state.currentDate
        ? debtsWithInstallmentDue(debts, state.currentDate).length > 0
        : false;
      const financeAfterDebtPayment = {
        ...state.finance,
        balance: newBalance,
        ledger: [entry, ...state.finance.ledger],
        debts,
      };
      return {
        ...state,
        finance: {
          ...financeAfterDebtPayment,
          health: computeFinancialHealth({
            finance: financeAfterDebtPayment,
            players: state.players,
            currentDate: gameDate,
          }),
        },
        team: state.team ? { ...state.team, budget: newBalance } : state.team,
        debtPaymentsDue: stillDue,
      };
    }

    case 'DISMISS_DEBT_PAYMENTS': {
      if (!state.currentDate) return { ...state, debtPaymentsDue: false };
      const dueIds = new Set(
        debtsWithInstallmentDue(state.finance.debts ?? [], state.currentDate).map(
          x => x.debt.id,
        ),
      );
      if (dueIds.size === 0) return { ...state, debtPaymentsDue: false };
      const debts = (state.finance.debts ?? []).map(d =>
        dueIds.has(d.id) ? skipDebtInstallment(d, state.currentDate!) : d,
      );
      return {
        ...state,
        debtPaymentsDue: false,
        finance: { ...state.finance, debts },
      };
    }

    case 'ADD_CLUB_SPONSOR': {
      if (hasActiveTier(state.finance.sponsors, action.sponsor.tier)) return state;
      return {
        ...state,
        finance: {
          ...state.finance,
          sponsors: [action.sponsor, ...(state.finance.sponsors ?? [])],
        },
      };
    }

    case 'RENEW_CLUB_SPONSOR': {
      const sponsors = (state.finance.sponsors ?? []).map(s =>
        s.id === action.sponsorId ? renewSponsor(s, action.extraSeasons ?? 1) : s,
      );
      return { ...state, finance: { ...state.finance, sponsors } };
    }

    case 'TERMINATE_CLUB_SPONSOR': {
      const sponsor = (state.finance.sponsors ?? []).find(s => s.id === action.sponsorId);
      if (!sponsor || sponsor.status !== 'active') return state;
      const sponsors = (state.finance.sponsors ?? []).map(s =>
        s.id === action.sponsorId
          ? { ...s, status: 'terminated' as const, seasonsRemaining: 0 }
          : s,
      );
      if (!action.ledgerEntry) {
        return { ...state, finance: { ...state.finance, sponsors } };
      }
      const newBalance = state.finance.balance + action.ledgerEntry.amount;
      return {
        ...state,
        finance: {
          ...state.finance,
          balance: newBalance,
          sponsors,
          ledger: [action.ledgerEntry, ...state.finance.ledger],
        },
        team: state.team ? { ...state.team, budget: newBalance } : state.team,
      };
    }

    // ─── National Team / Dual Career (v1.4) ────────────────────────────────────

    case 'SET_ACTIVE_CONTEXT': {
      if (state.careerMode !== 'coach') return state;
      if (action.context === 'national' && !state.nationalTeam) return state;
      return { ...state, activeContext: action.context };
    }

    case 'CREATE_NATIONAL_TEAM': {
      if (state.careerMode !== 'coach' || state.nationalTeam) return state;
      return {
        ...state,
        nationalTeam: createDefaultNationalTeamState(action.name, {
          primaryColor: action.primaryColor,
          secondaryColor: action.secondaryColor,
          startingFifaRanking: action.startingFifaRanking,
          onboardedAt: state.currentDate ?? undefined,
        }),
        activeContext: 'national',
      };
    }

    case 'ADD_FIFA_WINDOW': {
      if (!state.nationalTeam) return state;
      return {
        ...state,
        nationalTeam: {
          ...state.nationalTeam,
          windows: [...state.nationalTeam.windows, action.window],
        },
      };
    }

    case 'UPDATE_FIFA_WINDOW': {
      if (!state.nationalTeam) return state;
      const nationalTeam: NationalTeamState = {
        ...state.nationalTeam,
        windows: state.nationalTeam.windows.map(w =>
          w.id === action.windowId ? { ...w, ...action.updates } : w,
        ),
      };
      return {
        ...state,
        nationalTeam,
        // endDate pode mudar aqui — recalcula o desfalque pra não ficar com data velha.
        players: recomputeNationalDuty(nationalTeam, state.players),
      };
    }

    case 'ADD_FIFA_WINDOW_GAME': {
      if (!state.nationalTeam) return state;
      return {
        ...state,
        nationalTeam: {
          ...state.nationalTeam,
          windows: state.nationalTeam.windows.map(w =>
            w.id === action.windowId ? { ...w, games: [...w.games, action.game] } : w,
          ),
        },
      };
    }

    case 'UPDATE_FIFA_WINDOW_GAME': {
      if (!state.nationalTeam) return state;
      const gameBefore = state.nationalTeam.windows
        .find(w => w.id === action.windowId)
        ?.games.find(g => g.id === action.gameId);
      const justCompleted = !!gameBefore && !gameBefore.played && action.updates.played === true;

      let nationalTeam: NationalTeamState = {
        ...state.nationalTeam,
        windows: state.nationalTeam.windows.map(w =>
          w.id === action.windowId
            ? {
                ...w,
                games: w.games.map(g =>
                  g.id === action.gameId ? { ...g, ...action.updates } : g,
                ),
              }
            : w,
        ),
      };
      // Placar/desempenho registrado ou editado: recalcula os agregados do zero (sem duplicar).
      if ('performances' in action.updates || 'played' in action.updates) {
        nationalTeam = { ...nationalTeam, talentPool: recomputeNationalPlayerStats(nationalTeam) };
      }

      // Ranking FIFA simplificado: só mexe na primeira vez que o jogo é finalizado
      // (editar um jogo já registrado não pontua de novo).
      if (justCompleted) {
        const finishedGame = nationalTeam.windows
          .find(w => w.id === action.windowId)
          ?.games.find(g => g.id === action.gameId);
        if (finishedGame?.goalsFor != null && finishedGame.goalsAgainst != null) {
          const outcome = outcomeFromScore(finishedGame.goalsFor, finishedGame.goalsAgainst);
          const nextRanking = applyRankingDelta(nationalTeam.fifaRanking, outcome, finishedGame.opponentStrength);
          nationalTeam = {
            ...nationalTeam,
            fifaRanking: nextRanking,
            fifaRankingHistory: [
              ...nationalTeam.fifaRankingHistory,
              { date: (state.currentDate ?? new Date().toISOString()).slice(0, 10), value: nextRanking },
            ].slice(-50),
          };
        }
      }

      // Lesão em serviço na Seleção: se o atleta é vinculado a um jogador do clube,
      // ele volta machucado — mesmo campo (`availability`/`injuryDaysRemaining`) usado
      // pelas lesões de partidas do clube.
      let players = state.players;
      const injuries = action.updates.injuries;
      if (injuries?.length && state.currentDate) {
        const byClubId = new Map<string, string>();
        for (const np of nationalTeam.talentPool) {
          if (np.clubPlayerId) byClubId.set(np.id, np.clubPlayerId);
        }
        const patchByClubPlayerId = new Map<string, number>();
        for (const injury of injuries) {
          if (!injury.returnDate) continue;
          const clubPlayerId = byClubId.get(injury.playerId);
          if (!clubPlayerId) continue;
          const days = daysBetweenIso(state.currentDate, injury.returnDate);
          const current = patchByClubPlayerId.get(clubPlayerId) ?? 0;
          if (days > current) patchByClubPlayerId.set(clubPlayerId, days);
        }
        if (patchByClubPlayerId.size) {
          players = players.map(p => {
            const days = patchByClubPlayerId.get(p.id);
            if (!days) return p;
            return { ...p, availability: 'lesionado', injuryDaysRemaining: days };
          });
        }
      }

      return { ...state, nationalTeam, players };
    }

    case 'ADD_NATIONAL_PLAYERS': {
      if (!state.nationalTeam) return state;
      return {
        ...state,
        nationalTeam: {
          ...state.nationalTeam,
          talentPool: [...state.nationalTeam.talentPool, ...action.players],
        },
      };
    }

    case 'REMOVE_NATIONAL_PLAYER': {
      if (!state.nationalTeam) return state;
      const nationalTeam: NationalTeamState = {
        ...state.nationalTeam,
        talentPool: state.nationalTeam.talentPool.filter(p => p.id !== action.nationalPlayerId),
        windows: state.nationalTeam.windows.map(w => ({
          ...w,
          callUpIds: w.callUpIds.filter(id => id !== action.nationalPlayerId),
        })),
      };
      return {
        ...state,
        nationalTeam,
        players: recomputeNationalDuty(nationalTeam, state.players),
      };
    }

    case 'LINK_NATIONAL_PLAYER_TO_CLUB': {
      if (!state.nationalTeam) return state;
      const nationalTeam: NationalTeamState = {
        ...state.nationalTeam,
        talentPool: state.nationalTeam.talentPool.map(p =>
          p.id === action.nationalPlayerId
            ? { ...p, clubPlayerId: action.clubPlayerId ?? undefined }
            : p,
        ),
      };
      return {
        ...state,
        nationalTeam,
        players: recomputeNationalDuty(nationalTeam, state.players),
      };
    }

    case 'SET_CALL_UP_LIST': {
      if (!state.nationalTeam) return state;
      const window = state.nationalTeam.windows.find(w => w.id === action.windowId);
      if (!window) return state;
      const prevIds = new Set(window.callUpIds);
      const nextIds = new Set(action.callUpIds);
      const talentPool = state.nationalTeam.talentPool.map(p => {
        const wasIn = prevIds.has(p.id);
        const isIn = nextIds.has(p.id);
        if (isIn && !wasIn) return { ...p, caps: p.caps + 1 };
        if (!isIn && wasIn) return { ...p, caps: Math.max(0, p.caps - 1) };
        return p;
      });
      // Convocado novo nesta janela: sugere o número da última vez que ele foi convocado.
      const callUpNumbers = { ...window.callUpNumbers };
      for (const id of action.callUpIds) {
        if (prevIds.has(id) || callUpNumbers[id] != null) continue;
        const carried = carryOverCallUpNumber(state.nationalTeam.windows, id, action.windowId);
        if (carried != null) callUpNumbers[id] = carried;
      }
      const nationalTeam: NationalTeamState = {
        ...state.nationalTeam,
        talentPool,
        windows: state.nationalTeam.windows.map(w =>
          w.id === action.windowId ? { ...w, callUpIds: action.callUpIds, callUpNumbers } : w,
        ),
      };
      return {
        ...state,
        nationalTeam,
        players: recomputeNationalDuty(nationalTeam, state.players),
      };
    }

    case 'SET_CALL_UP_NUMBER': {
      if (!state.nationalTeam) return state;
      const window = state.nationalTeam.windows.find(w => w.id === action.windowId);
      if (!window) return state;
      const callUpNumbers = { ...window.callUpNumbers };
      if (action.number == null) delete callUpNumbers[action.nationalPlayerId];
      else callUpNumbers[action.nationalPlayerId] = action.number;
      return {
        ...state,
        nationalTeam: {
          ...state.nationalTeam,
          windows: state.nationalTeam.windows.map(w =>
            w.id === action.windowId ? { ...w, callUpNumbers } : w,
          ),
        },
      };
    }

    case 'SAVE_NATIONAL_TACTICS_PRESET': {
      if (!state.nationalTeam) return state;
      const window = state.nationalTeam.windows.find(w => w.id === action.windowId);
      if (!window) return state;
      const normalized = normalizeTacticsPreset({
        ...action.preset,
        updatedAt: action.preset.updatedAt ?? new Date().toISOString(),
      });
      if (!normalized) return state;

      const presets = window.tacticsPresets;
      const exists = presets.some(p => p.id === normalized.id);
      if (!exists && presets.length >= MAX_TACTICS_PRESETS) return state;

      const tacticsPresets = exists
        ? presets.map(p => (p.id === normalized.id ? normalized : p))
        : [...presets, normalized];

      return {
        ...state,
        nationalTeam: {
          ...state.nationalTeam,
          windows: state.nationalTeam.windows.map(w =>
            w.id === action.windowId
              ? { ...w, tacticsPresets, activeTacticsId: normalized.id, tactics: tacticsBodyFromPreset(normalized) }
              : w,
          ),
        },
      };
    }

    case 'DELETE_NATIONAL_TACTICS_PRESET': {
      if (!state.nationalTeam) return state;
      const window = state.nationalTeam.windows.find(w => w.id === action.windowId);
      if (!window) return state;
      const tacticsPresets = window.tacticsPresets.filter(p => p.id !== action.id);
      if (tacticsPresets.length === window.tacticsPresets.length) return state;
      const activeTacticsId =
        window.activeTacticsId === action.id ? tacticsPresets[0]?.id ?? null : window.activeTacticsId;
      const active = tacticsPresets.find(p => p.id === activeTacticsId);
      return {
        ...state,
        nationalTeam: {
          ...state.nationalTeam,
          windows: state.nationalTeam.windows.map(w =>
            w.id === action.windowId
              ? { ...w, tacticsPresets, activeTacticsId, tactics: active ? tacticsBodyFromPreset(active) : null }
              : w,
          ),
        },
      };
    }

    case 'SET_ACTIVE_NATIONAL_TACTICS': {
      if (!state.nationalTeam) return state;
      const window = state.nationalTeam.windows.find(w => w.id === action.windowId);
      if (!window) return state;
      const active = window.tacticsPresets.find(p => p.id === action.id);
      if (!active) return state;
      return {
        ...state,
        nationalTeam: {
          ...state.nationalTeam,
          windows: state.nationalTeam.windows.map(w =>
            w.id === action.windowId
              ? { ...w, activeTacticsId: action.id, tactics: tacticsBodyFromPreset(active) }
              : w,
          ),
        },
      };
    }

    case 'ADD_NATIONAL_GOAL': {
      if (!state.nationalTeam) return state;
      return {
        ...state,
        nationalTeam: { ...state.nationalTeam, goals: [...state.nationalTeam.goals, action.goal] },
      };
    }

    case 'UPDATE_NATIONAL_GOAL': {
      if (!state.nationalTeam) return state;
      return {
        ...state,
        nationalTeam: {
          ...state.nationalTeam,
          goals: state.nationalTeam.goals.map(g =>
            g.id === action.goalId ? { ...g, ...action.updates } : g,
          ),
        },
      };
    }

    case 'REMOVE_NATIONAL_GOAL': {
      if (!state.nationalTeam) return state;
      return {
        ...state,
        nationalTeam: {
          ...state.nationalTeam,
          goals: state.nationalTeam.goals.filter(g => g.id !== action.goalId),
        },
      };
    }

    case 'ADJUST_FEDERATION_MOOD': {
      if (!state.nationalTeam) return state;
      const value = Math.max(0, Math.min(100, Math.round(state.nationalTeam.federationMood + action.delta)));
      const entry = {
        date: (state.currentDate ?? new Date().toISOString()).slice(0, 10),
        value,
        reason: action.reason,
      };
      return {
        ...state,
        nationalTeam: {
          ...state.nationalTeam,
          federationMood: value,
          federationMoodHistory: [entry, ...state.nationalTeam.federationMoodHistory].slice(0, 50),
        },
      };
    }

    case 'RESOLVE_NATIONAL_DECONVOCATION': {
      if (!state.nationalTeam) return state;
      const window = state.nationalTeam.windows.find(w => w.id === action.windowId);
      if (!window || window.deconvocationResolvedIds.includes(action.nationalPlayerId)) return state;
      const cede = action.choice === 'cede';

      const talentPool = cede
        ? state.nationalTeam.talentPool.map(p =>
            p.id === action.nationalPlayerId ? { ...p, caps: Math.max(0, p.caps - 1) } : p,
          )
        : state.nationalTeam.talentPool;

      const nationalTeam: NationalTeamState = {
        ...state.nationalTeam,
        talentPool,
        federationMood: Math.max(0, Math.min(100, state.nationalTeam.federationMood + (cede ? -2 : 3))),
        windows: state.nationalTeam.windows.map(w =>
          w.id === action.windowId
            ? {
                ...w,
                deconvocationResolvedIds: [...w.deconvocationResolvedIds, action.nationalPlayerId],
                callUpIds: cede ? w.callUpIds.filter(id => id !== action.nationalPlayerId) : w.callUpIds,
              }
            : w,
        ),
      };

      const players = recomputeNationalDuty(nationalTeam, state.players);
      const team = state.team
        ? {
            ...state.team,
            boardConfidence: clampConfidence((state.team.boardConfidence ?? 50) + (cede ? 3 : -2)),
            supporterConfidence: clampConfidence((state.team.supporterConfidence ?? 50) + (cede ? 3 : -2)),
          }
        : state.team;

      return { ...state, nationalTeam, players, team };
    }

    default:
      return state;
  }
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const { persistSave, fetchCloudSave, setActiveSlot, activeSlotId } = useAuth();
  const pendingCloudRef = useRef<{
    data: Omit<GameSave, 'savedAt' | 'version'>;
    slotId: SaveSlotId;
  } | null>(null);
  const forceCloudRef = useRef(false);
  const cloudRetryTimerRef = useRef<number | null>(null);

  function buildPersistPayload(
    s: typeof state,
    slotId: SaveSlotId,
  ): Omit<GameSave, 'savedAt' | 'version'> | null {
    if (s.careerMode === 'coach' && s.team && s.teamId) {
      return {
        careerMode: 'coach',
        teamId: s.teamId,
        team: s.team,
        players: s.players,
        formerPlayers: s.formerPlayers,
        matches: s.matches,
        season: s.season,
        manager: s.manager,
        seasonCompetitions: s.seasonCompetitions,
        tactics: s.tactics,
        tacticsPresets: s.tacticsPresets,
        activeTacticsId: s.activeTacticsId,
        tutorialCompleted: s.tutorialCompleted,
        pulse: s.pulse,
        finance: s.finance,
        board: s.board,
        transfers: s.transfers,
        seasonHistory: s.seasonHistory,
        currentDate: s.currentDate,
        payrollDue: s.payrollDue,
        livelife: s.livelife,
        social: s.social,
        slotId,
        activeContext: s.activeContext,
        nationalTeam: s.nationalTeam,
      };
    }
    if (s.careerMode === 'player' && s.careerPlayer) {
      return {
        careerMode: 'player',
        careerPlayer: s.careerPlayer,
        matches: s.matches,
        season: s.season,
        seasonCompetitions: s.seasonCompetitions,
        tutorialCompleted: s.tutorialCompleted,
        currentDate: s.currentDate,
        payrollDue: s.payrollDue,
        livelife: s.livelife,
        social: s.social,
        slotId,
      };
    }
    return null;
  }

  async function pushPendingCloud() {
    const pending = pendingCloudRef.current;
    if (!pending) return;
    try {
      await persistSave(pending.data, pending.slotId, { cloud: true });
      if (pendingCloudRef.current === pending) pendingCloudRef.current = null;
      if (cloudRetryTimerRef.current != null) {
        window.clearInterval(cloudRetryTimerRef.current);
        cloudRetryTimerRef.current = null;
      }
    } catch (err) {
      console.error('Falha ao salvar na nuvem — nova tentativa em breve', err);
      if (cloudRetryTimerRef.current == null) {
        cloudRetryTimerRef.current = window.setInterval(() => {
          void pushPendingCloud();
        }, 8000);
      }
    }
  }

  useEffect(() => {
    if (!state.started) return;

    const slotId = state.saveSlotId || activeSlotId;
    const payload = buildPersistPayload(state, slotId);
    if (!payload) return;

    // Local imediato
    void persistSave(payload, slotId, { cloud: false }).catch(() => {
      /* local-only não deve falhar */
    });
    pendingCloudRef.current = { data: payload, slotId };

    const delay = forceCloudRef.current ? 0 : 250;
    forceCloudRef.current = false;
    const timer = window.setTimeout(() => {
      void pushPendingCloud();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [state, persistSave, activeSlotId]);

  // Flush nuvem ao sair/minimizar + limpeza do retry
  useEffect(() => {
    function flushCloud() {
      void pushPendingCloud();
    }

    function onVisibility() {
      if (document.visibilityState === 'hidden') flushCloud();
    }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushCloud);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushCloud);
      flushCloud();
      if (cloudRetryTimerRef.current != null) {
        window.clearInterval(cloudRetryTimerRef.current);
        cloudRetryTimerRef.current = null;
      }
    };
  }, [persistSave]);

  // Metas da diretoria: progresso ao vivo + resolução automática (ver utils/boardGoals.ts).
  const boardGoalsTickKey = [
    state.season,
    state.board.goals.map(g => `${g.id}:${g.status}:${g.current}:${g.pacingTickedGames ?? 0}`).join(';'),
    state.seasonCompetitions
      .map(
        c =>
          `${c.id}:${c.currentPosition ?? ''}:${c.leagueTable?.find(r => r.isUserTeam)?.matches ?? ''}:${(c.knockoutPhases ?? [])
            .map(p => `${p.id}:${p.advanced}:${p.outcome}:${p.isFinal}:${p.stage ?? ''}`)
            .join(',')}`,
      )
      .join('|'),
    state.transfers.history.length,
    state.players.reduce((s, p) => s + (p.salary ?? 0), 0),
    (state.finance.debts ?? []).reduce((s, d) => s + d.remaining, 0),
    state.finance.balance,
  ].join('::');

  useEffect(() => {
    if (!state.team) return;
    const seasonTransfers = state.transfers.history.filter(t => t.season === state.season);
    const ctx: GoalEvalContext = {
      competitions: state.seasonCompetitions,
      transfersSeason: seasonTransfers,
      spentOnTransfers: seasonTransfers
        .filter(t => t.type === 'buy')
        .reduce((s, t) => s + t.fee, 0),
      wageBill: wageBill(state.players),
      debtRemaining: (state.finance.debts ?? []).reduce((s, d) => s + d.remaining, 0),
      balance: state.finance.balance,
    };
    const { progress, resolutions } = tickBoardGoals(state.board.goals, state.season, ctx);
    if (progress.length) dispatch({ type: 'UPDATE_GOAL_PROGRESS', updates: progress });
    if (resolutions.length) dispatch({ type: 'RESOLVE_BOARD_GOALS', resolutions });

    for (const goal of state.board.goals) {
      if (goal.season !== state.season || goal.kind !== 'league_position') continue;
      const comp = state.seasonCompetitions.find(c => c.id === goal.competitionId);
      const tick = tickLeaguePacing(goal, comp);
      if (tick) {
        dispatch({
          type: 'TICK_GOAL_PACING',
          goalId: goal.id,
          pacingTickedGames: tick.pacingTickedGames,
          boardDelta: tick.boardDelta,
          reason: tick.reason,
        });
      }
    }
    // boardGoalsTickKey encapsula os campos relevantes (metas, competições, transfers, folha, dívida, caixa)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardGoalsTickKey]);

  // Recupera jogadores vendidos ANTES de `state.formerPlayers` existir: reconstrói as stats da
  // temporada da venda a partir de `state.matches` e completa o arquivo da temporada se ela já
  // tiver fechado sem ele. Roda uma vez por venda "órfã" — depois de recuperada, ela some da lista.
  const legacySoldBackfillKey = state.transfers.history
    .filter(t => t.type === 'sell' && t.playerId)
    .map(t => t.id)
    .join(',');

  useEffect(() => {
    if (!state.team || state.careerMode !== 'coach') return;
    const knownIds = new Set([
      ...state.players.map(p => p.id),
      ...state.formerPlayers.map(p => p.id),
    ]);
    const legacySales = state.transfers.history.filter(
      t => t.type === 'sell' && t.playerId && !knownIds.has(t.playerId),
    );
    if (!legacySales.length) return;

    const players: Player[] = [];
    const archivePatches: { season: number; snapshot: SeasonPlayerSnapshot }[] = [];

    for (const record of legacySales) {
      const playerId = record.playerId!;
      const snap = record.playerSnapshot;
      const position = (snap.position as PlayerPosition) || 'CM';
      const stats = statsForPlayerFromMatches(playerId, position === 'GK', state.matches, record.season);

      const priorStats = state.seasonHistory
        .filter(s => s.season < record.season)
        .map(s => s.players.find(p => p.playerId === playerId)?.stats)
        .filter((s): s is PlayerStats => !!s);
      const careerStats = priorStats.length ? sumPlayerStats(priorStats) : undefined;

      players.push({
        id: playerId,
        teamId: state.teamId ?? '',
        name: snap.name,
        position,
        number: snap.number ?? null,
        age: snap.age ?? 0,
        overall: snap.overall ?? 0,
        potential: snap.overall ?? 0,
        morale: 70,
        salary: 0,
        marketValue: 0,
        status: 'Transferível',
        stats,
        careerStats,
        departedAt: { season: record.season, date: record.date, reason: 'sold' },
      });

      if (state.seasonHistory.some(s => s.season === record.season)) {
        archivePatches.push({
          season: record.season,
          snapshot: {
            playerId,
            name: snap.name,
            position,
            age: snap.age ?? 0,
            overall: snap.overall ?? 0,
            stats,
          },
        });
      }
    }

    dispatch({ type: 'BACKFILL_FORMER_PLAYERS', players, archivePatches });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacySoldBackfillKey, state.careerMode]);

  function selectCareerMode(mode: CareerMode) {
    dispatch({ type: 'SELECT_CAREER_MODE', mode });
  }

  function setCoachCountry(country: string) {
    dispatch({ type: 'SET_COACH_COUNTRY', country });
  }

  function setCustomClub(team: Team, players: Player[]) {
    dispatch({ type: 'SET_CUSTOM_CLUB', team, players });
  }

  function setManager(manager: Manager) {
    dispatch({ type: 'SET_MANAGER', manager });
  }

  function updateManager(updates: Partial<Manager>) {
    dispatch({ type: 'UPDATE_MANAGER', updates });
  }

  function addAchievement(achievement: Omit<TeamAchievement, 'id'> & { id?: string }) {
    dispatch({
      type: 'ADD_ACHIEVEMENT',
      achievement: {
        ...achievement,
        id: achievement.id ?? uid(),
        awardedAt: achievement.awardedAt ?? new Date().toISOString().slice(0, 10),
      },
    });
  }

  function removeAchievement(achievementId: string) {
    dispatch({ type: 'REMOVE_ACHIEVEMENT', achievementId });
  }

  function startCareer(
    seasonCompetitions: string[] | SeasonCompetition[],
    slotId: SaveSlotId = activeSlotId,
    startDate?: string,
    options?: {
      currency?: Currency;
      prizeTable?: Record<string, PrizeTableEntry>;
      stadiumConfig?: StadiumConfig;
      openingDebt?: {
        amount: number;
        monthlyInstallment: number;
        paymentDay?: number;
        label?: string;
      };
    },
  ) {
    if (!state.pendingTeam || !state.manager || state.pendingPlayers.length === 0) return;
    const comps = migrateSeasonCompetitions(seasonCompetitions);
    const date =
      (startDate && startDate.slice(0, 10)) ||
      `${state.season}-01-01`;
    setActiveSlot(slotId);
    dispatch({ type: 'SET_SAVE_SLOT', slotId });
    dispatch({
      type: 'START_CAREER',
      manager: state.manager,
      seasonCompetitions: comps,
      startDate: date,
      currency: options?.currency,
      prizeTable: options?.prizeTable,
      stadiumConfig: options?.stadiumConfig,
      openingDebt: options?.openingDebt,
    });
  }

  function dismissLiveLifePrompt() {
    dispatch({ type: 'DISMISS_LIVELIFE_PROMPT' });
  }

  function dismissDailyPulse() {
    dispatch({ type: 'DISMISS_DAILY_PULSE' });
  }

  function completeLiveLifeOnboarding() {
    dispatch({ type: 'COMPLETE_LIVELIFE_ONBOARDING' });
  }

  function advanceDay(): { matchId: string | null } {
    if (!state.currentDate) return { matchId: null };
    const todayMatch = findMatchOnDate(state.matches, state.currentDate);
    if (todayMatch) {
      return { matchId: todayMatch.id };
    }
    dispatch({ type: 'ADVANCE_DAY' });
    return { matchId: null };
  }

  function rewindDay() {
    if (!state.currentDate) return;
    dispatch({ type: 'REWIND_DAY' });
  }

  function setCurrentDate(date: string) {
    dispatch({ type: 'SET_CURRENT_DATE', date });
  }

  function setCareerPlayer(data: Partial<CareerPlayer>) {
    dispatch({ type: 'SET_CAREER_PLAYER', player: data });
  }

  function setPlayerClub(data: {
    club: ClubInfo;
    status: CareerPlayer['status'];
    salary: number;
    contractYearsLeft: number;
  }) {
    dispatch({ type: 'SET_PLAYER_CLUB', ...data });
  }

  function finishPlayerSetup(data: {
    club: ClubInfo;
    status: CareerPlayer['status'];
    salary: number;
    contractYearsLeft: number;
    mainCompetition: string;
  }) {
    dispatch({ type: 'FINISH_PLAYER_SETUP', ...data });
  }

  function addCompetition(input: string | (Partial<SeasonCompetition> & { name: string })) {
    const competition =
      typeof input === 'string'
        ? createSeasonCompetition(input)
        : createSeasonCompetition(input.name, input);
    dispatch({ type: 'ADD_COMPETITION', competition });
  }

  function updateCompetition(id: string, updates: Partial<Omit<SeasonCompetition, 'id'>>) {
    dispatch({ type: 'UPDATE_COMPETITION', id, updates });
  }

  function removeCompetition(id: string) {
    dispatch({ type: 'REMOVE_COMPETITION', id });
  }

  function competitionNameList() {
    return competitionNames(state.seasonCompetitions);
  }

  function setSaveSlot(slotId: SaveSlotId) {
    setActiveSlot(slotId);
    dispatch({ type: 'SET_SAVE_SLOT', slotId });
  }

  function updateCareerPlayer(updates: Partial<CareerPlayer>) {
    dispatch({ type: 'UPDATE_CAREER_PLAYER', updates });
  }

  function transferPlayer(club: ClubInfo, salary: number, contractYears: number) {
    dispatch({ type: 'TRANSFER_PLAYER', club, salary, contractYears });
  }

  function addInjury(injury: Omit<InjuryEntry, 'id'>) {
    dispatch({ type: 'ADD_INJURY', injury });
  }

  function removeInjury(injuryId: string) {
    dispatch({ type: 'REMOVE_INJURY', injuryId });
  }

  function advanceSeason() {
    dispatch({ type: 'ADVANCE_SEASON' });
  }

  function updatePlayer(
    playerId: string,
    updates: Partial<Pick<Player, 'number' | 'age' | 'overall' | 'status' | 'personality' | 'fatigue' | 'availability' | 'injuryDaysRemaining' | 'suspensionMatchesRemaining' | 'suspensionCompetition' | 'morale' | 'name' | 'position' | 'potential' | 'salary' | 'marketValue' | 'contractYearsLeft'>>,
  ) {
    dispatch({ type: 'UPDATE_PLAYER', playerId, updates });
  }

  function addPlayer(player: Player) {
    dispatch({ type: 'ADD_PLAYER', player });
  }

  function removePlayer(playerId: string) {
    dispatch({ type: 'REMOVE_PLAYER', playerId });
  }

  function scheduleMatch(input: ScheduleMatchInput): string {
    const id = `match-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const match: Match = {
      id,
      teamId: state.teamId!,
      date: input.date,
      opponent: input.opponent,
      location: input.location,
      goalsFor: 0,
      goalsAgainst: 0,
      result: null,
      competition: input.competition,
      status: 'scheduled',
      goals: [],
      assists: [],
      cards: [],
      playerMatches: [],
      season: state.season,
      significance: input.significance ?? 'normal',
    };
    dispatch({ type: 'SCHEDULE_MATCH', match });
    return id;
  }

  function schedulePlayerMatch(input: ScheduleMatchInput): string {
    const id = `match-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const match: Match = {
      id,
      teamId: PLAYER_TEAM_ID,
      clubName: state.careerPlayer?.currentClub.name,
      date: input.date,
      opponent: input.opponent,
      location: input.location,
      goalsFor: 0,
      goalsAgainst: 0,
      result: null,
      competition: input.competition,
      status: 'scheduled',
      goals: [],
      assists: [],
      cards: [],
      playerMatches: [],
      season: state.season,
      significance: input.significance ?? 'normal',
    };
    dispatch({ type: 'SCHEDULE_MATCH', match });
    return id;
  }

  function updateScheduledMatch(matchId: string, updates: ScheduleMatchInput) {
    dispatch({ type: 'UPDATE_SCHEDULED_MATCH', matchId, updates });
  }

  function completeMatch(input: CompleteMatchInput) {
    forceCloudRef.current = true;
    dispatch({ type: 'COMPLETE_MATCH', input });
  }

  function updateCompletedMatch(input: CompleteMatchInput) {
    forceCloudRef.current = true;
    dispatch({ type: 'UPDATE_COMPLETED_MATCH', input });
  }

  function recalcSeasonStats() {
    forceCloudRef.current = true;
    dispatch({ type: 'RECALC_SEASON_STATS' });
  }

  function completePlayerMatch(input: CompletePlayerMatchInput) {
    forceCloudRef.current = true;
    dispatch({ type: 'COMPLETE_PLAYER_MATCH', input });
  }

  function updatePlayerMatch(input: CompletePlayerMatchInput) {
    forceCloudRef.current = true;
    dispatch({ type: 'UPDATE_PLAYER_MATCH', input });
  }

  function saveTactics(tactics: SavedTactics) {
    dispatch({
      type: 'SAVE_TACTICS',
      tactics: { ...tactics, updatedAt: new Date().toISOString() },
    });
  }

  function saveTacticsPreset(preset: Omit<TacticsPreset, 'updatedAt'> & { updatedAt?: string }) {
    dispatch({
      type: 'SAVE_TACTICS_PRESET',
      preset: {
        ...preset,
        updatedAt: preset.updatedAt ?? new Date().toISOString(),
      },
    });
  }

  function deleteTacticsPreset(id: string) {
    dispatch({ type: 'DELETE_TACTICS_PRESET', id });
  }

  function setActiveTactics(id: string) {
    dispatch({ type: 'SET_ACTIVE_TACTICS', id });
  }

  function rollPulseForMatch(matchId: string) {
    dispatch({ type: 'APPLY_PULSE', matchId });
  }

  function updatePulseSettings(settings: Partial<PulseSettings>) {
    dispatch({ type: 'UPDATE_PULSE_SETTINGS', settings });
  }

  function addSocialPost(post: SocialPost) {
    dispatch({ type: 'ADD_SOCIAL_POST', post });
  }

  function markSocialSeen() {
    dispatch({ type: 'MARK_SOCIAL_SEEN' });
  }

  function applyPressConference(input: {
    context: PressContext;
    matchId?: string;
    deltas: PressConferenceDeltas;
    headline: string;
    playerMorale?: { playerId: string; delta: number }[];
    aggressiveCount?: number;
    specialDoneKey?: string;
  }) {
    forceCloudRef.current = true;
    dispatch({ type: 'APPLY_PRESS_CONFERENCE', ...input });
  }

  async function loadSavedGame(slotId: SaveSlotId = activeSlotId): Promise<CareerMode | null> {
    const save = await fetchCloudSave(slotId);
    if (!save) return null;
    setActiveSlot(slotId);

    if (save.careerMode === 'player' && save.careerPlayer) {
      dispatch({
        type: 'LOAD_SAVE',
        state: {
          careerMode: 'player',
          careerPlayer: save.careerPlayer,
          teamId: null,
          team: null,
          manager: null,
          seasonCompetitions: migrateSeasonCompetitions(save.seasonCompetitions),
          players: [],
          formerPlayers: [],
          matches: save.matches,
          season: save.season,
          tactics: null,
          tacticsPresets: [],
          activeTacticsId: null,
          tutorialCompleted: save.tutorialCompleted ?? false,
          pulse: createDefaultPulseState(),
          finance: createDefaultFinance(),
          board: createDefaultBoardState(),
          transfers: createDefaultTransferState(),
          seasonHistory: [],
          saveSlotId: slotId,
          currentDate: save.currentDate ?? null,
          payrollDue: save.payrollDue ?? false,
          transferPaymentsDue: false,
          loanPaymentsDue: false,
          debtPaymentsDue: false,
          liveLifePromptPending: false,
          pendingDailyPulse: null,
          livelife: {
            ...createDefaultLiveLifeMeta(),
            ...(save.livelife ?? {}),
          },
          social: {
            ...createDefaultSocialState(),
            ...(save.social ?? {}),
            activeArc: save.social?.activeArc ?? null,
            arcHistory: save.social?.arcHistory ?? [],
          },
          activeContext: 'club',
          nationalTeam: null,
        },
      });
      return 'player';
    }

    if (save.team && save.teamId) {
      const players = save.players ?? [];
      const matches = save.matches;
      const recalculated = recalculateFromMatches(save.team, players, matches, save.season ?? 2026);
      const tacticsState = migrateTacticsPresets(
        save.tactics,
        save.tacticsPresets,
        save.activeTacticsId,
      );
      const comps = migrateSeasonCompetitions(save.seasonCompetitions);
      const financeSeeded = seedLiveLifeFinance(
        save.finance ?? createDefaultFinance(save.team.budget ?? 5_000_000),
        comps,
      );
      const finance: ClubFinance = financeSeeded.health
        ? financeSeeded
        : {
            ...financeSeeded,
            health: computeFinancialHealth({
              finance: financeSeeded,
              players: recalculated.players,
              currentDate: save.currentDate ?? null,
            }),
          };
      dispatch({
        type: 'LOAD_SAVE',
        state: {
          careerMode: 'coach',
          teamId: save.teamId,
          team: recalculated.team,
          manager: save.manager ?? null,
          seasonCompetitions: comps,
          players: recalculated.players,
          formerPlayers: save.formerPlayers ?? [],
          matches,
          season: save.season,
          tactics: tacticsState.tactics,
          tacticsPresets: tacticsState.tacticsPresets,
          activeTacticsId: tacticsState.activeTacticsId,
          careerPlayer: null,
          tutorialCompleted: save.tutorialCompleted ?? false,
          pulse: save.pulse ?? createDefaultPulseState(),
          finance,
          board: save.board
            ? { ...save.board, goals: (save.board.goals ?? []).map(migrateBoardGoal) }
            : createDefaultBoardState(),
          transfers: {
            ...createDefaultTransferState(),
            ...(save.transfers ?? {}),
            pendingPayments: save.transfers?.pendingPayments ?? [],
          },
          seasonHistory: save.seasonHistory ?? [],
          saveSlotId: slotId,
          currentDate: save.currentDate ?? null,
          payrollDue: save.payrollDue ?? false,
          transferPaymentsDue: Boolean(
            save.currentDate &&
              paymentsDueOnDate(save.transfers?.pendingPayments ?? [], save.currentDate).length,
          ),
          loanPaymentsDue: Boolean(
            save.currentDate &&
              loanPaymentsDueOnDate(save.finance?.loanPayments ?? [], save.currentDate).length,
          ),
          debtPaymentsDue: Boolean(
            save.currentDate &&
              debtsWithInstallmentDue(finance.debts ?? [], save.currentDate).length,
          ),
          liveLifePromptPending: true,
          pendingDailyPulse: null,
          livelife: {
            ...createDefaultLiveLifeMeta(),
            ...(save.livelife ?? {}),
          },
          social: {
            ...createDefaultSocialState(save.team.name),
            ...(save.social ?? {}),
            activeArc: save.social?.activeArc ?? null,
            arcHistory: save.social?.arcHistory ?? [],
          },
          activeContext: save.activeContext ?? 'club',
          nationalTeam: save.nationalTeam ?? null,
        },
      });
      return 'coach';
    }

    return null;
  }

  function getSaveSnapshot(): GameSave | null {
    if (!state.started) return null;
    if (state.careerMode === 'coach' && state.team && state.teamId) {
      return {
        version: '0.6.0',
        savedAt: new Date().toISOString(),
        careerMode: 'coach',
        teamId: state.teamId,
        team: state.team,
        players: state.players,
        matches: state.matches,
        season: state.season,
        manager: state.manager,
        seasonCompetitions: state.seasonCompetitions,
        tactics: state.tactics,
        tacticsPresets: state.tacticsPresets,
        activeTacticsId: state.activeTacticsId,
        tutorialCompleted: state.tutorialCompleted,
        pulse: state.pulse,
        finance: state.finance,
        board: state.board,
        transfers: state.transfers,
        seasonHistory: state.seasonHistory,
        currentDate: state.currentDate,
        payrollDue: state.payrollDue,
        livelife: state.livelife,
        social: state.social,
        slotId: state.saveSlotId,
        activeContext: state.activeContext,
        nationalTeam: state.nationalTeam,
      };
    }
    if (state.careerMode === 'player' && state.careerPlayer) {
      return {
        version: '0.6.0',
        savedAt: new Date().toISOString(),
        careerMode: 'player',
        careerPlayer: state.careerPlayer,
        matches: state.matches,
        season: state.season,
        seasonCompetitions: state.seasonCompetitions,
        tutorialCompleted: state.tutorialCompleted,
        currentDate: state.currentDate,
        payrollDue: state.payrollDue,
        livelife: state.livelife,
        social: state.social,
        slotId: state.saveSlotId,
      };
    }
    return null;
  }

  function completeTutorial() {
    dispatch({ type: 'COMPLETE_TUTORIAL' });
  }

  function resetGame() {
    clearGame();
    dispatch({ type: 'RESET' });
  }

  function getTeamPlayers(): Player[] {
    return state.players;
  }

  function getMatch(matchId: string): Match | undefined {
    return state.matches.find(m => m.id === matchId);
  }

  // ─── Finance ───────────────────────────────────────────────────────────────

  function applyLedger(entry: FinanceLedgerEntry) {
    dispatch({ type: 'APPLY_LEDGER', entry });
  }

  function payWages() {
    dispatch({ type: 'PAY_WAGES' });
  }

  function dismissPayroll() {
    dispatch({ type: 'DISMISS_PAYROLL' });
  }

  function setPrizeTable(competition: string, prize: { win?: number; draw?: number; knockout?: number; champion?: number }) {
    dispatch({ type: 'SET_PRIZE_TABLE', competition, prize });
  }

  function updateFinance(updates: Partial<ClubFinance>) {
    dispatch({ type: 'UPDATE_FINANCE', updates });
  }

  function setMonthlyBudget(targetExpenseLimit: number) {
    dispatch({ type: 'SET_MONTHLY_BUDGET', targetExpenseLimit });
  }

  // ─── Board ─────────────────────────────────────────────────────────────────

  function updateBoard(updates: Partial<BoardState>) {
    dispatch({ type: 'UPDATE_BOARD', updates });
  }

  function setBoardGoal(goal: BoardGoal) {
    dispatch({ type: 'SET_BOARD_GOAL', goal });
  }

  function removeBoardGoal(goalId: string) {
    dispatch({ type: 'REMOVE_BOARD_GOAL', goalId });
  }

  function adjustBoardConfidence(delta: number, reason: string) {
    dispatch({ type: 'ADJUST_BOARD_CONFIDENCE', delta, reason });
  }

  function adjustSupporterConfidence(delta: number, reason: string) {
    dispatch({ type: 'ADJUST_SUPPORTER_CONFIDENCE', delta, reason });
  }

  function resolveBoardGoals(resolutions: GoalResolution[]) {
    if (!resolutions.length) return;
    dispatch({ type: 'RESOLVE_BOARD_GOALS', resolutions });
  }

  function manuallyResolveGoal(goal: BoardGoal, status: 'done' | 'exceeded' | 'failed') {
    const resolution = resolveGoalManually(goal, status, goal.current);
    dispatch({ type: 'MANUALLY_RESOLVE_GOAL', resolution });
  }

  function dismissGoalPrompt(season: number) {
    dispatch({ type: 'DISMISS_GOAL_PROMPT', season });
  }

  function importSeasonArchive(
    payload: SeasonImportPayload,
    options?: { replace?: boolean },
  ): { ok: true } | { ok: false; reason: 'exists' } {
    const exists = state.seasonHistory.some(s => s.season === payload.season);
    if (exists && !options?.replace) return { ok: false, reason: 'exists' };
    dispatch({ type: 'IMPORT_SEASON_ARCHIVE', payload });
    return { ok: true };
  }

  function updateTeam(updates: Partial<Pick<Team, 'name' | 'primaryColor' | 'secondaryColor' | 'description' | 'fans'>>) {
    dispatch({ type: 'UPDATE_TEAM', updates });
  }

  // ─── Transfers ─────────────────────────────────────────────────────────────

  function addWatchlist(player: WatchlistPlayer) {
    dispatch({ type: 'ADD_WATCHLIST', player });
  }

  function removeWatchlist(playerId: string) {
    dispatch({ type: 'REMOVE_WATCHLIST', playerId });
  }

  function updateWatchlist(playerId: string, updates: Partial<WatchlistPlayer>) {
    dispatch({ type: 'UPDATE_WATCHLIST', playerId, updates });
  }

  function executeTransfer(
    record: TransferRecord,
    newPlayer?: Player,
    removedPlayerId?: string,
    ledgerEntries?: FinanceLedgerEntry[],
    pendingPayments?: TransferPayment[],
  ) {
    forceCloudRef.current = true;
    dispatch({
      type: 'EXECUTE_TRANSFER',
      record,
      newPlayer,
      removedPlayerId,
      ledgerEntries: ledgerEntries ?? [],
      pendingPayments,
    });
  }

  function updateTransferRecord(transferId: string, updates: Partial<TransferRecord>) {
    forceCloudRef.current = true;
    dispatch({ type: 'UPDATE_TRANSFER_RECORD', transferId, updates });
  }

  function payTransferPayment(paymentId: string) {
    const payment = state.transfers.pendingPayments?.find(p => p.id === paymentId);
    if (!payment || payment.status === 'paid') return;
    const amount = payment.direction === 'in' ? payment.amount : -payment.amount;
    const entry = newLedgerEntry(
      'transfer_fee',
      amount,
      payment.label,
      state.season,
      { relatedTransferId: payment.transferId },
      state.currentDate ?? undefined,
    );
    forceCloudRef.current = true;
    dispatch({ type: 'PAY_TRANSFER_PAYMENT', paymentId, ledgerEntry: entry });
  }

  function dismissTransferPayments() {
    dispatch({ type: 'DISMISS_TRANSFER_PAYMENTS' });
  }

  function renewPlayerContract(input: {
    playerId: string;
    years: number;
    newSalary: number;
    signingBonus?: number;
  }) {
    const bonus = Math.max(0, Math.round(input.signingBonus ?? 0));
    const ledgerEntry =
      bonus > 0
        ? newLedgerEntry(
            'wage',
            -bonus,
            `Bônus de renovação`,
            state.season,
            undefined,
            state.currentDate ?? undefined,
          )
        : undefined;
    forceCloudRef.current = true;
    dispatch({
      type: 'RENEW_PLAYER_CONTRACT',
      playerId: input.playerId,
      years: input.years,
      newSalary: input.newSalary,
      signingBonus: bonus || undefined,
      ledgerEntry,
    });
  }

  function takeClubLoan(input: {
    principal: number;
    interestRatePercent: number;
    installmentCount: number;
    firstPaymentDate: string;
    notes?: string;
  }) {
    const pack = createClubLoanPackage(input);
    const creditEntry = newLedgerEntry(
      'loan_credit',
      pack.creditAmount,
      `Empréstimo bancário (+${pack.loan.interestRate}% juros)`,
      state.season,
      undefined,
      state.currentDate ?? undefined,
    );
    forceCloudRef.current = true;
    dispatch({
      type: 'TAKE_CLUB_LOAN',
      loan: pack.loan,
      payments: pack.payments,
      creditEntry,
    });
  }

  function payWagesWithBridgeLoan(): boolean {
    const bill = wageBill(state.players);
    const gameDate = state.currentDate ?? new Date().toISOString().slice(0, 10);
    const suggestion = suggestPayrollBridgeLoan({
      balance: state.finance.balance,
      wageBill: bill,
      gameDate,
    });
    if (!suggestion) return false;
    const pack = createClubLoanPackage({
      principal: suggestion.principal,
      interestRatePercent: suggestion.interestRatePercent,
      installmentCount: suggestion.installmentCount,
      firstPaymentDate: suggestion.firstPaymentDate,
      notes: 'Empréstimo-ponte — folha dia 5',
    });
    const creditEntry = newLedgerEntry(
      'loan_credit',
      pack.creditAmount,
      `Empréstimo-ponte folha (+${pack.loan.interestRate}% juros)`,
      state.season,
      undefined,
      gameDate,
    );
    const wageEntry = newLedgerEntry(
      'wage',
      -bill,
      'Folha salarial',
      state.season,
      undefined,
      gameDate,
    );
    forceCloudRef.current = true;
    dispatch({
      type: 'PAY_WAGES_WITH_BRIDGE_LOAN',
      loan: pack.loan,
      payments: pack.payments,
      creditEntry,
      wageEntry,
    });
    return true;
  }

  function payLoanPayment(paymentId: string) {
    const payment = state.finance.loanPayments?.find(p => p.id === paymentId);
    if (!payment || payment.status === 'paid') return;
    const entry = newLedgerEntry(
      'loan_repay',
      -payment.amount,
      payment.label,
      state.season,
      undefined,
      state.currentDate ?? undefined,
    );
    forceCloudRef.current = true;
    dispatch({ type: 'PAY_LOAN_PAYMENT', paymentId, ledgerEntry: entry });
  }

  function addClubDebt(input: {
    amount: number;
    monthlyInstallment: number;
    paymentDay: number;
    label?: string;
  }) {
    if (input.amount < 1 || input.monthlyInstallment < 1) return;
    const debt = createClubDebt({
      amount: input.amount,
      monthlyInstallment: input.monthlyInstallment,
      paymentDay: input.paymentDay,
      label: input.label,
      source: 'manual',
      createdAt: state.currentDate ?? new Date().toISOString().slice(0, 10),
    });
    forceCloudRef.current = true;
    dispatch({ type: 'ADD_CLUB_DEBT', debt });
  }

  function payClubDebt(debtId: string, amount: number, asMonthlyInstallment?: boolean) {
    const debt = state.finance.debts?.find(d => d.id === debtId);
    if (!debt || debt.status === 'paid' || amount < 1) return;
    const pay = Math.min(debt.remaining, Math.round(amount));
    const entry = newLedgerEntry(
      'debt_repay',
      -pay,
      `Dívida: ${debt.label}`,
      state.season,
      undefined,
      state.currentDate ?? undefined,
    );
    forceCloudRef.current = true;
    dispatch({
      type: 'PAY_CLUB_DEBT',
      debtId,
      amount: pay,
      ledgerEntry: entry,
      asMonthlyInstallment,
    });
  }

  function dismissDebtPayments() {
    dispatch({ type: 'DISMISS_DEBT_PAYMENTS' });
  }

  function addClubSponsor(input: {
    brand: string;
    tier: SponsorTier;
    monthlyFee: number;
    seasons: number;
    paymentDay: number;
    minLeaguePosition?: number;
    terminationFee?: number;
    bonuses?: Omit<SponsorBonusClause, 'id'>[];
  }): boolean {
    if (hasActiveTier(state.finance.sponsors, input.tier)) return false;
    const sponsor = createClubSponsor({
      ...input,
      startSeason: state.season,
    });
    forceCloudRef.current = true;
    dispatch({ type: 'ADD_CLUB_SPONSOR', sponsor });
    return true;
  }

  function renewClubSponsor(sponsorId: string, extraSeasons = 1) {
    forceCloudRef.current = true;
    dispatch({ type: 'RENEW_CLUB_SPONSOR', sponsorId, extraSeasons });
  }

  function terminateClubSponsor(sponsorId: string) {
    const sponsor = state.finance.sponsors?.find(s => s.id === sponsorId);
    if (!sponsor || sponsor.status !== 'active') return;
    const fee = sponsor.terminationFee;
    const ledgerEntry =
      fee > 0
        ? newLedgerEntry(
            'other_out',
            -fee,
            `Rescisão antecipada: ${sponsor.brand}`,
            state.season,
            undefined,
            state.currentDate ?? undefined,
          )
        : undefined;
    forceCloudRef.current = true;
    dispatch({ type: 'TERMINATE_CLUB_SPONSOR', sponsorId, ledgerEntry });
  }

  function dismissLoanPayments() {
    dispatch({ type: 'DISMISS_LOAN_PAYMENTS' });
  }

  function setActiveContext(context: 'club' | 'national') {
    dispatch({ type: 'SET_ACTIVE_CONTEXT', context });
  }

  function createNationalTeam(input: {
    name: string;
    primaryColor?: string;
    secondaryColor?: string;
    startingFifaRanking?: number;
  }) {
    dispatch({ type: 'CREATE_NATIONAL_TEAM', ...input });
  }

  function addFifaWindow(input: {
    label?: string;
    type: FifaWindowType;
    typeOther?: string;
    startDate: string;
    endDate: string;
    listSize: CallUpListSize;
  }): string {
    const window = createFifaWindow(input);
    dispatch({ type: 'ADD_FIFA_WINDOW', window });
    return window.id;
  }

  function updateFifaWindow(windowId: string, updates: Partial<Omit<FifaWindow, 'id'>>) {
    dispatch({ type: 'UPDATE_FIFA_WINDOW', windowId, updates });
  }

  function addFifaWindowGame(
    windowId: string,
    input: { opponent: string; location: MatchLocation; date: string; opponentStrength: OpponentStrength },
  ): string {
    const game = createFifaWindowGame(input);
    dispatch({ type: 'ADD_FIFA_WINDOW_GAME', windowId, game });
    return game.id;
  }

  function updateFifaWindowGame(
    windowId: string,
    gameId: string,
    updates: Partial<Omit<FifaWindowGame, 'id'>>,
  ) {
    dispatch({ type: 'UPDATE_FIFA_WINDOW_GAME', windowId, gameId, updates });
  }

  function addNationalPlayer(input: {
    name: string;
    position: PlayerPosition;
    age: number;
    club: string;
    overall?: number;
    clubPlayerId?: string;
  }): string {
    const player: NationalPlayer = {
      id: uid(),
      name: input.name,
      position: input.position,
      age: input.age,
      club: input.club,
      overall: input.overall,
      clubPlayerId: input.clubPlayerId,
      caps: 0,
      stats: emptyNationalPlayerStats(),
    };
    dispatch({ type: 'ADD_NATIONAL_PLAYERS', players: [player] });
    return player.id;
  }

  function importNationalPlayers(players: NationalPlayer[]) {
    dispatch({ type: 'ADD_NATIONAL_PLAYERS', players });
  }

  function removeNationalPlayer(nationalPlayerId: string) {
    dispatch({ type: 'REMOVE_NATIONAL_PLAYER', nationalPlayerId });
  }

  function linkNationalPlayerToClub(nationalPlayerId: string, clubPlayerId: string | null) {
    dispatch({ type: 'LINK_NATIONAL_PLAYER_TO_CLUB', nationalPlayerId, clubPlayerId });
  }

  function setCallUpList(windowId: string, callUpIds: string[]) {
    dispatch({ type: 'SET_CALL_UP_LIST', windowId, callUpIds });
  }

  function setCallUpNumber(windowId: string, nationalPlayerId: string, number: number | null) {
    dispatch({ type: 'SET_CALL_UP_NUMBER', windowId, nationalPlayerId, number });
  }

  function saveNationalTacticsPreset(
    windowId: string,
    preset: Omit<TacticsPreset, 'updatedAt'> & { updatedAt?: string },
  ) {
    dispatch({
      type: 'SAVE_NATIONAL_TACTICS_PRESET',
      windowId,
      preset: { ...preset, updatedAt: preset.updatedAt ?? new Date().toISOString() },
    });
  }

  function deleteNationalTacticsPreset(windowId: string, id: string) {
    dispatch({ type: 'DELETE_NATIONAL_TACTICS_PRESET', windowId, id });
  }

  function setActiveNationalTactics(windowId: string, id: string) {
    dispatch({ type: 'SET_ACTIVE_NATIONAL_TACTICS', windowId, id });
  }

  function addNationalGoal(input: { kind: NationalBoardGoal['kind']; label: string; target: number }) {
    dispatch({
      type: 'ADD_NATIONAL_GOAL',
      goal: { id: uid(), kind: input.kind, label: input.label, target: input.target, current: 0, status: 'active' },
    });
  }

  function updateNationalGoal(goalId: string, updates: Partial<Omit<NationalBoardGoal, 'id'>>) {
    dispatch({ type: 'UPDATE_NATIONAL_GOAL', goalId, updates });
  }

  function removeNationalGoal(goalId: string) {
    dispatch({ type: 'REMOVE_NATIONAL_GOAL', goalId });
  }

  function adjustFederationMood(delta: number, reason: string) {
    dispatch({ type: 'ADJUST_FEDERATION_MOOD', delta, reason });
  }

  function resolveNationalDeconvocation(
    windowId: string,
    nationalPlayerId: string,
    choice: 'cede' | 'refuse',
  ) {
    dispatch({ type: 'RESOLVE_NATIONAL_DECONVOCATION', windowId, nationalPlayerId, choice });
  }

  return (
    <GameContext.Provider
      value={{
        state,
        selectCareerMode,
        setCoachCountry,
        setCustomClub,
        setManager,
        updateManager,
        addAchievement,
        removeAchievement,
        startCareer,
        dismissLiveLifePrompt,
        dismissDailyPulse,
        completeLiveLifeOnboarding,
        advanceDay,
        rewindDay,
        setCurrentDate,
        setCareerPlayer,
        setPlayerClub,
        finishPlayerSetup,
        addCompetition,
        updateCompetition,
        removeCompetition,
        competitionNameList,
        setSaveSlot,
        updateCareerPlayer,
        transferPlayer,
        addInjury,
        removeInjury,
        advanceSeason,
        updatePlayer,
        addPlayer,
        removePlayer,
        scheduleMatch,
        schedulePlayerMatch,
        updateScheduledMatch,
        completeMatch,
        updateCompletedMatch,
        recalcSeasonStats,
        completePlayerMatch,
        updatePlayerMatch,
        saveTactics,
        saveTacticsPreset,
        deleteTacticsPreset,
        setActiveTactics,
        rollPulseForMatch,
        updatePulseSettings,
        addSocialPost,
        markSocialSeen,
        applyPressConference,
        loadSavedGame,
        completeTutorial,
        resetGame,
        getTeamPlayers,
        getMatch,
        getSaveSnapshot,
        applyLedger,
        payWages,
        dismissPayroll,
        setPrizeTable,
        updateFinance,
        setMonthlyBudget,
        updateBoard,
        setBoardGoal,
        removeBoardGoal,
        adjustBoardConfidence,
        adjustSupporterConfidence,
        resolveBoardGoals,
        manuallyResolveGoal,
        dismissGoalPrompt,
        importSeasonArchive,
        updateTeam,
        addWatchlist,
        removeWatchlist,
        updateWatchlist,
        executeTransfer,
        updateTransferRecord,
        payTransferPayment,
        dismissTransferPayments,
        renewPlayerContract,
        takeClubLoan,
        payWagesWithBridgeLoan,
        payLoanPayment,
        dismissLoanPayments,
        addClubDebt,
        payClubDebt,
        dismissDebtPayments,
        addClubSponsor,
        renewClubSponsor,
        terminateClubSponsor,
        setActiveContext,
        createNationalTeam,
        addFifaWindow,
        updateFifaWindow,
        addFifaWindowGame,
        updateFifaWindowGame,
        addNationalPlayer,
        importNationalPlayers,
        removeNationalPlayer,
        linkNationalPlayerToClub,
        setCallUpList,
        setCallUpNumber,
        saveNationalTacticsPreset,
        deleteNationalTacticsPreset,
        setActiveNationalTactics,
        addNationalGoal,
        updateNationalGoal,
        removeNationalGoal,
        adjustFederationMood,
        resolveNationalDeconvocation,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}
