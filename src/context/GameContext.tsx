import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { SeasonCompetition } from '../types/Competition';
import {
  competitionNames,
  createSeasonCompetition,
  migrateSeasonCompetitions,
} from '../utils/competitions';
import type { Team } from '../types/Team';
import type { Player } from '../types/Player';
import type { Match, ScheduleMatchInput, CompleteMatchInput } from '../types/Match';
import type { Manager } from '../types/Manager';
import type { SavedTactics } from '../types/Tactics';
import type { CareerMode, SetupStep } from '../types/CareerMode';
import type { CareerPlayer, ClubInfo, InjuryEntry } from '../types/CareerPlayer';
import { createDefaultCareerPlayer, emptyPlayerStats } from '../types/CareerPlayer';
import type { CompletePlayerMatchInput } from '../types/PlayerMatchPerformance';
import { clearGame, type GameSave } from '../services/storage';
import { calcResult, recalculateFromMatches } from '../utils/matchStats';
import { normalizeSavedTactics } from '../utils/formations';
import { applyPerformanceToStats, subtractPerformanceFromStats } from '../utils/playerStats';
import { calcMoraleChanges, applyMoraleDelta } from '../utils/playerMorale';
import type { MatchResult } from '../types/Match';
import {
  createDefaultPulseState,
  generatePulse,
  playerToPulseAthlete,
  type PulseSettings,
  type PulseState,
} from '../pulse';
import type { ClubFinance, FinanceLedgerEntry } from '../types/Finance';
import { createDefaultFinance } from '../types/Finance';
import type { BoardState, BoardGoal } from '../types/Board';
import { createDefaultBoardState } from '../types/Board';
import type { TransferState, WatchlistPlayer, TransferRecord } from '../types/Transfer';
import { createDefaultTransferState } from '../types/Transfer';
import type { SeasonArchive } from '../types/SeasonHistory';
import { emptyTeamStats } from '../types/SeasonHistory';
import { newLedgerEntry, wageBill } from '../utils/finance';
import { useAuth } from './AuthContext';
import { emptyPlayerStats as emptySquadStats } from '../types/Player';
import type { SaveSlotId } from '../services/saveSlots';

const PLAYER_TEAM_ID = 'player-career';

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
  careerPlayer: CareerPlayer | null;
  matches: Match[];
  season: number;
  tactics: SavedTactics | null;
  tutorialCompleted: boolean;
  pulse: PulseState;
  finance: ClubFinance;
  board: BoardState;
  transfers: TransferState;
  seasonHistory: SeasonArchive[];
  /** Slot de save ativo desta carreira (1–3). */
  saveSlotId: SaveSlotId;
}

type GameAction =
  | { type: 'SELECT_CAREER_MODE'; mode: CareerMode }
  | { type: 'SET_COACH_COUNTRY'; country: string }
  | { type: 'SET_CUSTOM_CLUB'; team: Team; players: Player[] }
  | { type: 'SET_MANAGER'; manager: Manager }
  | { type: 'START_CAREER'; manager: Manager; seasonCompetitions: SeasonCompetition[] }
  | { type: 'SET_CAREER_PLAYER'; player: Partial<CareerPlayer> }
  | { type: 'SET_PLAYER_CLUB'; club: ClubInfo; status: CareerPlayer['status']; salary: number; contractYearsLeft: number }
  | { type: 'FINISH_PLAYER_SETUP'; club: ClubInfo; status: CareerPlayer['status']; salary: number; contractYearsLeft: number; mainCompetition: string }
  | { type: 'ADD_COMPETITION'; competition: SeasonCompetition }
  | { type: 'UPDATE_COMPETITION'; id: string; updates: Partial<Pick<SeasonCompetition, 'name' | 'color' | 'shortName' | 'type'>> }
  | { type: 'REMOVE_COMPETITION'; id: string }
  | { type: 'SET_SAVE_SLOT'; slotId: SaveSlotId }
  | { type: 'UPDATE_CAREER_PLAYER'; updates: Partial<CareerPlayer> }
  | { type: 'TRANSFER_PLAYER'; club: ClubInfo; salary: number; contractYears: number }
  | { type: 'ADD_INJURY'; injury: Omit<InjuryEntry, 'id'> }
  | { type: 'REMOVE_INJURY'; injuryId: string }
  | { type: 'ADVANCE_SEASON' }
  | { type: 'UPDATE_PLAYER'; playerId: string; updates: Partial<Pick<Player, 'number' | 'age' | 'overall' | 'status' | 'personality' | 'fatigue' | 'availability' | 'morale' | 'name' | 'position' | 'potential' | 'salary' | 'marketValue'>> }
  | { type: 'ADD_PLAYER'; player: Player }
  | { type: 'REMOVE_PLAYER'; playerId: string }
  | { type: 'SCHEDULE_MATCH'; match: Match }
  | { type: 'UPDATE_SCHEDULED_MATCH'; matchId: string; updates: ScheduleMatchInput }
  | { type: 'COMPLETE_MATCH'; input: CompleteMatchInput }
  | { type: 'UPDATE_COMPLETED_MATCH'; input: CompleteMatchInput }
  | { type: 'COMPLETE_PLAYER_MATCH'; input: CompletePlayerMatchInput }
  | { type: 'UPDATE_PLAYER_MATCH'; input: CompletePlayerMatchInput }
  | { type: 'SAVE_TACTICS'; tactics: SavedTactics }
  | { type: 'APPLY_PULSE'; matchId: string }
  | { type: 'UPDATE_PULSE_SETTINGS'; settings: Partial<PulseSettings> }
  | { type: 'LOAD_SAVE'; state: Omit<GameState, 'started' | 'setupStep' | 'pendingTeam' | 'pendingPlayers' | 'pendingCoachCountry' | 'pendingCareerPlayer'> }
  | { type: 'COMPLETE_TUTORIAL' }
  | { type: 'RESET' }
  // Finance
  | { type: 'APPLY_LEDGER'; entry: FinanceLedgerEntry }
  | { type: 'PAY_WAGES' }
  | { type: 'SET_PRIZE_TABLE'; competition: string; prize: { win?: number; draw?: number; knockout?: number; champion?: number } }
  | { type: 'UPDATE_FINANCE'; updates: Partial<ClubFinance> }
  // Board
  | { type: 'UPDATE_BOARD'; updates: Partial<BoardState> }
  | { type: 'SET_BOARD_GOAL'; goal: BoardGoal }
  | { type: 'REMOVE_BOARD_GOAL'; goalId: string }
  | { type: 'ADJUST_BOARD_CONFIDENCE'; delta: number; reason: string }
  | { type: 'UPDATE_TEAM'; updates: Partial<Pick<Team, 'name' | 'primaryColor' | 'secondaryColor' | 'description' | 'fans'>> }
  // Transfers
  | { type: 'ADD_WATCHLIST'; player: WatchlistPlayer }
  | { type: 'REMOVE_WATCHLIST'; playerId: string }
  | { type: 'UPDATE_WATCHLIST'; playerId: string; updates: Partial<WatchlistPlayer> }
  | { type: 'EXECUTE_TRANSFER'; record: TransferRecord; newPlayer?: Player; removedPlayerId?: string; ledgerEntries: FinanceLedgerEntry[] };

interface GameContextValue {
  state: GameState;
  selectCareerMode: (mode: CareerMode) => void;
  setCoachCountry: (country: string) => void;
  setCustomClub: (team: Team, players: Player[]) => void;
  setManager: (manager: Manager) => void;
  startCareer: (seasonCompetitions: string[] | SeasonCompetition[], slotId?: SaveSlotId) => void;
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
  updateCompetition: (
    id: string,
    updates: Partial<Pick<SeasonCompetition, 'name' | 'color' | 'shortName' | 'type'>>,
  ) => void;
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
    updates: Partial<Pick<Player, 'number' | 'age' | 'overall' | 'status' | 'personality' | 'fatigue' | 'availability' | 'morale' | 'name' | 'position' | 'potential' | 'salary' | 'marketValue'>>,
  ) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  scheduleMatch: (input: ScheduleMatchInput) => string;
  schedulePlayerMatch: (input: ScheduleMatchInput) => string;
  updateScheduledMatch: (matchId: string, updates: ScheduleMatchInput) => void;
  completeMatch: (input: CompleteMatchInput) => void;
  updateCompletedMatch: (input: CompleteMatchInput) => void;
  completePlayerMatch: (input: CompletePlayerMatchInput) => void;
  updatePlayerMatch: (input: CompletePlayerMatchInput) => void;
  saveTactics: (tactics: SavedTactics) => void;
  rollPulseForMatch: (matchId: string) => void;
  updatePulseSettings: (settings: Partial<PulseSettings>) => void;
  completeTutorial: () => void;
  resetGame: () => void;
  getTeamPlayers: () => Player[];
  getMatch: (matchId: string) => Match | undefined;
  getSaveSnapshot: () => GameSave | null;
  // Finance
  applyLedger: (entry: FinanceLedgerEntry) => void;
  payWages: () => void;
  setPrizeTable: (competition: string, prize: { win?: number; draw?: number; knockout?: number; champion?: number }) => void;
  updateFinance: (updates: Partial<ClubFinance>) => void;
  // Board
  updateBoard: (updates: Partial<BoardState>) => void;
  setBoardGoal: (goal: BoardGoal) => void;
  removeBoardGoal: (goalId: string) => void;
  adjustBoardConfidence: (delta: number, reason: string) => void;
  updateTeam: (updates: Partial<Pick<Team, 'name' | 'primaryColor' | 'secondaryColor' | 'description' | 'fans'>>) => void;
  // Transfers
  addWatchlist: (player: WatchlistPlayer) => void;
  removeWatchlist: (playerId: string) => void;
  updateWatchlist: (playerId: string, updates: Partial<WatchlistPlayer>) => void;
  executeTransfer: (record: TransferRecord, newPlayer?: Player, removedPlayerId?: string, ledgerEntries?: FinanceLedgerEntry[]) => void;
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
  careerPlayer: null,
  matches: [],
  season: 2026,
  tactics: null,
  tutorialCompleted: false,
  pulse: createDefaultPulseState(),
  finance: createDefaultFinance(),
  board: createDefaultBoardState(),
  transfers: createDefaultTransferState(),
  seasonHistory: [],
  saveSlotId: '1',
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

    case 'START_CAREER': {
      if (!state.pendingTeam || state.pendingPlayers.length === 0) return state;
      const team = state.pendingTeam;
      const players = state.pendingPlayers.map(p => ({ ...p, teamId: team.id }));
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
        tutorialCompleted: false,
        pulse: createDefaultPulseState(),
        finance: createDefaultFinance(team.budget ?? 5_000_000),
        board: createDefaultBoardState(),
        transfers: createDefaultTransferState(),
        seasonHistory: [],
      };
    }

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
      const updated: SeasonCompetition = {
        ...current,
        ...action.updates,
        name: nextName || current.name,
      };
      const matches =
        updated.name !== current.name
          ? state.matches.map(m =>
              m.competition === current.name ? { ...m, competition: updated.name } : m,
            )
          : state.matches;
      return {
        ...state,
        seasonCompetitions: state.seasonCompetitions.map(c => (c.id === action.id ? updated : c)),
        matches,
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
          players: state.players.map(p => ({
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
          careerStats: {
            matches: (p.careerStats?.matches ?? 0) + (p.stats.matches ?? 0),
            minutes: (p.careerStats?.minutes ?? 0) + (p.stats.minutes ?? 0),
            goals: (p.careerStats?.goals ?? 0) + (p.stats.goals ?? 0),
            assists: (p.careerStats?.assists ?? 0) + (p.stats.assists ?? 0),
            yellowCards: (p.careerStats?.yellowCards ?? 0) + (p.stats.yellowCards ?? 0),
            redCards: (p.careerStats?.redCards ?? 0) + (p.stats.redCards ?? 0),
          },
          stats: emptySquadStats(),
          fatigue: 0,
        }));
        const goals = state.board.goals.map(g =>
          g.status === 'active' && g.season === state.season
            ? { ...g, status: 'failed' as const }
            : g,
        );
        return {
          ...state,
          season: newSeason,
          players,
          seasonHistory: [...state.seasonHistory, archive],
          team: {
            ...state.team,
            statistics: emptyTeamStats(),
          },
          board: {
            ...state.board,
            goals,
            confidenceHistory: [
              {
                date: new Date().toISOString().slice(0, 10),
                value: state.team.boardConfidence,
                reason: `Início da temporada ${newSeason}`,
              },
              ...state.board.confidenceHistory,
            ].slice(0, 50),
          },
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
              }
            : m,
        ),
      };

    case 'COMPLETE_MATCH': {
      if (!state.team) return state;
      const injuredIds = new Set((action.input.injuries ?? []).map(i => i.playerId));
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
              description: action.input.description,
              playerRatings: action.input.playerRatings,
              motmPlayerId: action.input.motmPlayerId,
              worstPlayerId: action.input.worstPlayerId,
            }
          : m,
      );
      const playersWithInjury = state.players.map(p =>
        injuredIds.has(p.id) ? { ...p, availability: 'lesionado' as const } : p,
      );
      const recalculated = recalculateFromMatches(state.team, playersWithInjury, updatedMatches);

      // Board confidence reaction
      const confDelta = result === 'win' ? 3 : result === 'draw' ? 0 : -4;
      const confReason = result === 'win' ? 'Vitória' : result === 'draw' ? 'Empate' : 'Derrota';
      const newConf = Math.max(0, Math.min(100, (recalculated.team?.boardConfidence ?? state.team.boardConfidence) + confDelta));
      const confEntry = confDelta !== 0
        ? { date: new Date().toISOString().slice(0, 10), value: newConf, reason: confReason }
        : null;
      const updatedBoard = confEntry
        ? {
            ...state.board,
            confidenceHistory: [confEntry, ...state.board.confidenceHistory].slice(0, 50),
          }
        : state.board;
      const teamWithConf = recalculated.team
        ? { ...recalculated.team, boardConfidence: newConf }
        : recalculated.team;

      return {
        ...state,
        matches: updatedMatches,
        ...recalculated,
        team: teamWithConf ?? recalculated.team,
        board: updatedBoard,
      };
    }

    case 'UPDATE_COMPLETED_MATCH': {
      if (!state.team) return state;
      const injuredIds = new Set((action.input.injuries ?? []).map(i => i.playerId));
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
              description: action.input.description,
              playerRatings: action.input.playerRatings,
              motmPlayerId: action.input.motmPlayerId,
              worstPlayerId: action.input.worstPlayerId,
            }
          : m,
      );
      const playersWithInjury = state.players.map(p =>
        injuredIds.has(p.id) ? { ...p, availability: 'lesionado' as const } : p,
      );
      const recalculated = recalculateFromMatches(state.team, playersWithInjury, updatedMatches);
      return { ...state, matches: updatedMatches, ...recalculated };
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

    case 'SAVE_TACTICS':
      return { ...state, tactics: normalizeSavedTactics(action.tactics) };

    case 'APPLY_PULSE': {
      if (!state.team) return state;
      if (state.pulse.rolledMatchIds.includes(action.matchId)) return state;

      const output = generatePulse({
        club: {
          id: state.team.id,
          nome: state.team.name,
          temporadaAtual: state.season,
        },
        athletes: state.players.map(playerToPulseAthlete),
        pulseState: state.pulse,
        matchId: action.matchId,
      });

      const players = state.players.map(p => {
        const patch = output.athletePatches.find(x => x.id === p.id);
        if (!patch) return p;
        return {
          ...p,
          morale: patch.moral ?? p.morale,
          fatigue: patch.fadiga ?? p.fatigue,
          availability: patch.availability ?? p.availability,
        };
      });

      return {
        ...state,
        players,
        pulse: output.pulseState,
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

    case 'LOAD_SAVE':
      return {
        started: true,
        setupStep: 'done',
        pendingTeam: null,
        pendingPlayers: [],
        pendingCoachCountry: null,
        pendingCareerPlayer: null,
        ...action.state,
        seasonCompetitions: migrateSeasonCompetitions(action.state.seasonCompetitions),
        saveSlotId: action.state.saveSlotId ?? '1',
        pulse: action.state.pulse ?? createDefaultPulseState(),
        finance: action.state.finance ?? createDefaultFinance(),
        board: action.state.board ?? createDefaultBoardState(),
        transfers: action.state.transfers ?? createDefaultTransferState(),
        seasonHistory: action.state.seasonHistory ?? [],
      };

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
      if (bill <= 0) return state;
      const entry = newLedgerEntry('wage', -bill, 'Folha salarial', state.season);
      const newBalance = state.finance.balance - bill;
      const updatedTeam = state.team ? { ...state.team, budget: newBalance } : state.team;
      return {
        ...state,
        team: updatedTeam,
        finance: {
          ...state.finance,
          balance: newBalance,
          ledger: [entry, ...state.finance.ledger],
        },
      };
    }

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
      const { record, newPlayer, removedPlayerId, ledgerEntries } = action;
      let players = state.players;
      let finance = state.finance;

      if (removedPlayerId) {
        players = players.filter(p => p.id !== removedPlayerId);
      }
      if (newPlayer) {
        players = [...players, newPlayer];
      }
      if (record.type === 'loan_out' && removedPlayerId) {
        players = state.players.map(p =>
          p.id === removedPlayerId ? { ...p, status: 'Emprestado' as const } : p,
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

      // Remove from watchlist if converted from there
      const watchlist = state.transfers.watchlist.filter(w => w.id !== record.playerId);

      return {
        ...state,
        players,
        team: updatedTeam,
        finance,
        transfers: {
          ...state.transfers,
          watchlist,
          history: [record, ...state.transfers.history],
        },
      };
    }

    default:
      return state;
  }
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const { persistSave, fetchCloudSave, setActiveSlot, activeSlotId } = useAuth();

  useEffect(() => {
    if (!state.started) return;

    let cancelled = false;

    async function sync() {
      try {
        const slotId = state.saveSlotId || activeSlotId;
        if (state.careerMode === 'coach' && state.team && state.teamId) {
          await persistSave(
            {
              careerMode: 'coach',
              teamId: state.teamId,
              team: state.team,
              players: state.players,
              matches: state.matches,
              season: state.season,
              manager: state.manager,
              seasonCompetitions: state.seasonCompetitions,
              tactics: state.tactics,
              tutorialCompleted: state.tutorialCompleted,
              pulse: state.pulse,
              finance: state.finance,
              board: state.board,
              transfers: state.transfers,
              seasonHistory: state.seasonHistory,
              slotId,
            },
            slotId,
          );
        } else if (state.careerMode === 'player' && state.careerPlayer) {
          await persistSave(
            {
              careerMode: 'player',
              careerPlayer: state.careerPlayer,
              matches: state.matches,
              season: state.season,
              seasonCompetitions: state.seasonCompetitions,
              tutorialCompleted: state.tutorialCompleted,
              slotId,
            },
            slotId,
          );
        }
      } catch (err) {
        if (!cancelled) console.error('Falha ao salvar na nuvem', err);
      }
    }

    // Debounce cloud writes — avoid hammering Firestore on every keystroke
    const timer = window.setTimeout(sync, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state, persistSave, activeSlotId]);

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

  function startCareer(
    seasonCompetitions: string[] | SeasonCompetition[],
    slotId: SaveSlotId = activeSlotId,
  ) {
    if (!state.pendingTeam || !state.manager || state.pendingPlayers.length === 0) return;
    const comps = migrateSeasonCompetitions(seasonCompetitions);
    setActiveSlot(slotId);
    dispatch({ type: 'SET_SAVE_SLOT', slotId });
    dispatch({
      type: 'START_CAREER',
      manager: state.manager,
      seasonCompetitions: comps,
    });
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

  function updateCompetition(
    id: string,
    updates: Partial<Pick<SeasonCompetition, 'name' | 'color' | 'shortName' | 'type'>>,
  ) {
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
    updates: Partial<Pick<Player, 'number' | 'age' | 'overall' | 'status' | 'personality' | 'fatigue' | 'availability' | 'morale' | 'name' | 'position' | 'potential' | 'salary' | 'marketValue'>>,
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
    };
    dispatch({ type: 'SCHEDULE_MATCH', match });
    return id;
  }

  function updateScheduledMatch(matchId: string, updates: ScheduleMatchInput) {
    dispatch({ type: 'UPDATE_SCHEDULED_MATCH', matchId, updates });
  }

  function completeMatch(input: CompleteMatchInput) {
    dispatch({ type: 'COMPLETE_MATCH', input });
  }

  function updateCompletedMatch(input: CompleteMatchInput) {
    dispatch({ type: 'UPDATE_COMPLETED_MATCH', input });
  }

  function completePlayerMatch(input: CompletePlayerMatchInput) {
    dispatch({ type: 'COMPLETE_PLAYER_MATCH', input });
  }

  function updatePlayerMatch(input: CompletePlayerMatchInput) {
    dispatch({ type: 'UPDATE_PLAYER_MATCH', input });
  }

  function saveTactics(tactics: SavedTactics) {
    dispatch({
      type: 'SAVE_TACTICS',
      tactics: { ...tactics, updatedAt: new Date().toISOString() },
    });
  }

  function rollPulseForMatch(matchId: string) {
    dispatch({ type: 'APPLY_PULSE', matchId });
  }

  function updatePulseSettings(settings: Partial<PulseSettings>) {
    dispatch({ type: 'UPDATE_PULSE_SETTINGS', settings });
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
          matches: save.matches,
          season: save.season,
          tactics: null,
          tutorialCompleted: save.tutorialCompleted ?? false,
          pulse: createDefaultPulseState(),
          finance: createDefaultFinance(),
          board: createDefaultBoardState(),
          transfers: createDefaultTransferState(),
          seasonHistory: [],
          saveSlotId: slotId,
        },
      });
      return 'player';
    }

    if (save.team && save.teamId) {
      const players = save.players ?? [];
      const matches = save.matches;
      const recalculated = recalculateFromMatches(save.team, players, matches);
      dispatch({
        type: 'LOAD_SAVE',
        state: {
          careerMode: 'coach',
          teamId: save.teamId,
          team: recalculated.team,
          manager: save.manager ?? null,
          seasonCompetitions: migrateSeasonCompetitions(save.seasonCompetitions),
          players: recalculated.players,
          matches,
          season: save.season,
          tactics: normalizeSavedTactics(save.tactics),
          careerPlayer: null,
          tutorialCompleted: save.tutorialCompleted ?? false,
          pulse: save.pulse ?? createDefaultPulseState(),
          finance: save.finance ?? createDefaultFinance(save.team.budget ?? 5_000_000),
          board: save.board ?? createDefaultBoardState(),
          transfers: save.transfers ?? createDefaultTransferState(),
          seasonHistory: save.seasonHistory ?? [],
          saveSlotId: slotId,
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
        tutorialCompleted: state.tutorialCompleted,
        pulse: state.pulse,
        finance: state.finance,
        board: state.board,
        transfers: state.transfers,
        seasonHistory: state.seasonHistory,
        slotId: state.saveSlotId,
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

  function setPrizeTable(competition: string, prize: { win?: number; draw?: number; knockout?: number; champion?: number }) {
    dispatch({ type: 'SET_PRIZE_TABLE', competition, prize });
  }

  function updateFinance(updates: Partial<ClubFinance>) {
    dispatch({ type: 'UPDATE_FINANCE', updates });
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

  function executeTransfer(record: TransferRecord, newPlayer?: Player, removedPlayerId?: string, ledgerEntries?: FinanceLedgerEntry[]) {
    dispatch({ type: 'EXECUTE_TRANSFER', record, newPlayer, removedPlayerId, ledgerEntries: ledgerEntries ?? [] });
  }

  return (
    <GameContext.Provider
      value={{
        state,
        selectCareerMode,
        setCoachCountry,
        setCustomClub,
        setManager,
        startCareer,
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
        completePlayerMatch,
        updatePlayerMatch,
        saveTactics,
        rollPulseForMatch,
        updatePulseSettings,
        loadSavedGame,
        completeTutorial,
        resetGame,
        getTeamPlayers,
        getMatch,
        getSaveSnapshot,
        applyLedger,
        payWages,
        setPrizeTable,
        updateFinance,
        updateBoard,
        setBoardGoal,
        removeBoardGoal,
        adjustBoardConfidence,
        updateTeam,
        addWatchlist,
        removeWatchlist,
        updateWatchlist,
        executeTransfer,
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
