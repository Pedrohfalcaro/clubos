import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { Team } from '../types/Team';
import type { Player } from '../types/Player';
import type { Match, ScheduleMatchInput, CompleteMatchInput } from '../types/Match';
import type { Manager } from '../types/Manager';
import type { SavedTactics } from '../types/Tactics';
import type { CareerMode, SetupStep } from '../types/CareerMode';
import type { CareerPlayer, ClubInfo, InjuryEntry } from '../types/CareerPlayer';
import { createDefaultCareerPlayer, emptyPlayerStats } from '../types/CareerPlayer';
import type { CompletePlayerMatchInput } from '../types/PlayerMatchPerformance';
import { saveGame, loadGame, clearGame } from '../services/storage';
import { calcResult, recalculateFromMatches } from '../utils/matchStats';
import { applyPerformanceToStats, subtractPerformanceFromStats } from '../utils/playerStats';
import { calcMoraleChanges, applyMoraleDelta } from '../utils/playerMorale';
import type { MatchResult } from '../types/Match';
import teamsData from '../data/teams.json';
import playersData from '../data/players.json';

const allTeams = teamsData as Team[];
const allPlayers = playersData as Player[];

const PLAYER_TEAM_ID = 'player-career';

export interface GameState {
  started: boolean;
  careerMode: CareerMode | null;
  setupStep: SetupStep;
  pendingTeamId: string | null;
  pendingCoachCountry: string | null;
  pendingCareerPlayer: Partial<CareerPlayer> | null;
  teamId: string | null;
  team: Team | null;
  manager: Manager | null;
  seasonCompetitions: string[];
  players: Player[];
  careerPlayer: CareerPlayer | null;
  matches: Match[];
  season: number;
  tactics: SavedTactics | null;
  tutorialCompleted: boolean;
}

type GameAction =
  | { type: 'SELECT_CAREER_MODE'; mode: CareerMode }
  | { type: 'SET_COACH_COUNTRY'; country: string }
  | { type: 'SELECT_TEAM'; teamId: string }
  | { type: 'SET_MANAGER'; manager: Manager }
  | { type: 'START_CAREER'; teamId: string; manager: Manager; seasonCompetitions: string[] }
  | { type: 'SET_CAREER_PLAYER'; player: Partial<CareerPlayer> }
  | { type: 'SET_PLAYER_CLUB'; club: ClubInfo; status: CareerPlayer['status']; salary: number; contractYearsLeft: number }
  | { type: 'FINISH_PLAYER_SETUP'; club: ClubInfo; status: CareerPlayer['status']; salary: number; contractYearsLeft: number; mainCompetition: string }
  | { type: 'ADD_COMPETITION'; name: string }
  | { type: 'UPDATE_CAREER_PLAYER'; updates: Partial<CareerPlayer> }
  | { type: 'TRANSFER_PLAYER'; club: ClubInfo; salary: number; contractYears: number }
  | { type: 'ADD_INJURY'; injury: Omit<InjuryEntry, 'id'> }
  | { type: 'REMOVE_INJURY'; injuryId: string }
  | { type: 'ADVANCE_SEASON' }
  | { type: 'UPDATE_PLAYER'; playerId: string; updates: Partial<Pick<Player, 'number' | 'age' | 'overall' | 'status'>> }
  | { type: 'SCHEDULE_MATCH'; match: Match }
  | { type: 'UPDATE_SCHEDULED_MATCH'; matchId: string; updates: ScheduleMatchInput }
  | { type: 'COMPLETE_MATCH'; input: CompleteMatchInput }
  | { type: 'UPDATE_COMPLETED_MATCH'; input: CompleteMatchInput }
  | { type: 'COMPLETE_PLAYER_MATCH'; input: CompletePlayerMatchInput }
  | { type: 'UPDATE_PLAYER_MATCH'; input: CompletePlayerMatchInput }
  | { type: 'SAVE_TACTICS'; tactics: SavedTactics }
  | { type: 'LOAD_SAVE'; state: Omit<GameState, 'started' | 'setupStep' | 'pendingTeamId' | 'pendingCoachCountry' | 'pendingCareerPlayer'> }
  | { type: 'COMPLETE_TUTORIAL' }
  | { type: 'RESET' };

interface GameContextValue {
  state: GameState;
  selectCareerMode: (mode: CareerMode) => void;
  setCoachCountry: (country: string) => void;
  selectTeam: (teamId: string) => void;
  setManager: (manager: Manager) => void;
  startCareer: (seasonCompetitions: string[]) => void;
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
  addCompetition: (name: string) => void;
  updateCareerPlayer: (updates: Partial<CareerPlayer>) => void;
  transferPlayer: (club: ClubInfo, salary: number, contractYears: number) => void;
  addInjury: (injury: Omit<InjuryEntry, 'id'>) => void;
  removeInjury: (injuryId: string) => void;
  advanceSeason: () => void;
  updatePlayer: (playerId: string, updates: Partial<Pick<Player, 'number' | 'age' | 'overall' | 'status'>>) => void;
  scheduleMatch: (input: ScheduleMatchInput) => string;
  schedulePlayerMatch: (input: ScheduleMatchInput) => string;
  updateScheduledMatch: (matchId: string, updates: ScheduleMatchInput) => void;
  completeMatch: (input: CompleteMatchInput) => void;
  updateCompletedMatch: (input: CompleteMatchInput) => void;
  completePlayerMatch: (input: CompletePlayerMatchInput) => void;
  updatePlayerMatch: (input: CompletePlayerMatchInput) => void;
  saveTactics: (tactics: SavedTactics) => void;
  loadSavedGame: () => CareerMode | null;
  completeTutorial: () => void;
  resetGame: () => void;
  getTeamPlayers: () => Player[];
  getMatch: (matchId: string) => Match | undefined;
}

const initialState: GameState = {
  started: false,
  careerMode: null,
  setupStep: 'mode',
  pendingTeamId: null,
  pendingCoachCountry: null,
  pendingCareerPlayer: null,
  teamId: null,
  team: null,
  manager: null,
  seasonCompetitions: [],
  players: [],
  careerPlayer: null,
  matches: [],
  season: 2025,
  tactics: null,
  tutorialCompleted: false,
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

    case 'SELECT_TEAM':
      return { ...state, setupStep: 'manager', pendingTeamId: action.teamId };

    case 'SET_MANAGER':
      return { ...state, setupStep: 'competitions', manager: action.manager };

    case 'START_CAREER': {
      const team = allTeams.find(t => t.id === action.teamId);
      if (!team) return state;
      const players = allPlayers.filter(p => p.teamId === action.teamId);
      return {
        ...state,
        started: true,
        careerMode: 'coach',
        setupStep: 'done',
        pendingTeamId: null,
        pendingCoachCountry: null,
        pendingCareerPlayer: null,
        teamId: action.teamId,
        team,
        manager: action.manager,
        seasonCompetitions: action.seasonCompetitions,
        players,
        careerPlayer: null,
        matches: [],
        season: 2025,
        tutorialCompleted: false,
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
        seasonCompetitions: [action.mainCompetition],
        matches: [],
        tutorialCompleted: false,
      };
    }

    case 'ADD_COMPETITION': {
      const name = action.name.trim();
      if (!name || state.seasonCompetitions.includes(name)) return state;
      return { ...state, seasonCompetitions: [...state.seasonCompetitions, name] };
    }

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
      if (!state.careerPlayer) return state;
      const newSeason = state.season + 1;
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

    case 'UPDATE_PLAYER':
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.playerId ? { ...p, ...action.updates } : p,
        ),
      };

    case 'SCHEDULE_MATCH':
      return { ...state, matches: [...state.matches, action.match] };

    case 'UPDATE_SCHEDULED_MATCH':
      return {
        ...state,
        matches: state.matches.map(m =>
          m.id === action.matchId && m.status === 'scheduled'
            ? { ...m, ...action.updates }
            : m,
        ),
      };

    case 'COMPLETE_MATCH': {
      if (!state.team) return state;
      const updatedMatches = state.matches.map(m =>
        m.id === action.input.matchId
          ? {
              ...m,
              status: 'completed' as const,
              goalsFor: action.input.goalsFor,
              goalsAgainst: action.input.goalsAgainst,
              result: calcResult(action.input.goalsFor, action.input.goalsAgainst),
              goals: action.input.goals,
              assists: action.input.assists,
              cards: action.input.cards,
              playerMatches: action.input.playerMatches,
              lineup: action.input.lineup,
              substitutions: action.input.substitutions,
              opponentGoalScorers: action.input.opponentGoalScorers,
              description: action.input.description,
              playerRatings: action.input.playerRatings,
              motmPlayerId: action.input.motmPlayerId,
              worstPlayerId: action.input.worstPlayerId,
            }
          : m,
      );
      const recalculated = recalculateFromMatches(state.team, state.players, updatedMatches);
      return { ...state, matches: updatedMatches, ...recalculated };
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
              opponentGoalScorers: action.input.opponentGoalScorers,
              description: action.input.description,
              playerRatings: action.input.playerRatings,
              motmPlayerId: action.input.motmPlayerId,
              worstPlayerId: action.input.worstPlayerId,
            }
          : m,
      );
      const recalculated = recalculateFromMatches(state.team, state.players, updatedMatches);
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
      return { ...state, tactics: action.tactics };

    case 'COMPLETE_TUTORIAL':
      return { ...state, tutorialCompleted: true };

    case 'LOAD_SAVE':
      return {
        started: true,
        setupStep: 'done',
        pendingTeamId: null,
        pendingCoachCountry: null,
        pendingCareerPlayer: null,
        ...action.state,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  useEffect(() => {
    if (!state.started) return;

    if (state.careerMode === 'coach' && state.team && state.teamId) {
      saveGame({
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
      });
    } else if (state.careerMode === 'player' && state.careerPlayer) {
      saveGame({
        careerMode: 'player',
        careerPlayer: state.careerPlayer,
        matches: state.matches,
        season: state.season,
        seasonCompetitions: state.seasonCompetitions,
        tutorialCompleted: state.tutorialCompleted,
      });
    }
  }, [state]);

  function selectCareerMode(mode: CareerMode) {
    dispatch({ type: 'SELECT_CAREER_MODE', mode });
  }

  function setCoachCountry(country: string) {
    dispatch({ type: 'SET_COACH_COUNTRY', country });
  }

  function selectTeam(teamId: string) {
    dispatch({ type: 'SELECT_TEAM', teamId });
  }

  function setManager(manager: Manager) {
    dispatch({ type: 'SET_MANAGER', manager });
  }

  function startCareer(seasonCompetitions: string[]) {
    if (!state.pendingTeamId || !state.manager) return;
    dispatch({
      type: 'START_CAREER',
      teamId: state.pendingTeamId,
      manager: state.manager,
      seasonCompetitions,
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

  function addCompetition(name: string) {
    dispatch({ type: 'ADD_COMPETITION', name });
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
    updates: Partial<Pick<Player, 'number' | 'age' | 'overall' | 'status'>>,
  ) {
    dispatch({ type: 'UPDATE_PLAYER', playerId, updates });
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
    dispatch({ type: 'SAVE_TACTICS', tactics });
  }

  function loadSavedGame(): CareerMode | null {
    const save = loadGame();
    if (!save) return null;

    if (save.careerMode === 'player' && save.careerPlayer) {
      dispatch({
        type: 'LOAD_SAVE',
        state: {
          careerMode: 'player',
          careerPlayer: save.careerPlayer,
          teamId: null,
          team: null,
          manager: null,
          seasonCompetitions: save.seasonCompetitions,
          players: [],
          matches: save.matches,
          season: save.season,
          tactics: null,
          tutorialCompleted: save.tutorialCompleted ?? false,
        },
      });
      return 'player';
    }

    if (save.team && save.teamId) {
      dispatch({
        type: 'LOAD_SAVE',
        state: {
          careerMode: 'coach',
          teamId: save.teamId,
          team: save.team,
          manager: save.manager ?? null,
          seasonCompetitions: save.seasonCompetitions,
          players: save.players ?? [],
          matches: save.matches,
          season: save.season,
          tactics: save.tactics ?? null,
          careerPlayer: null,
          tutorialCompleted: save.tutorialCompleted ?? false,
        },
      });
      return 'coach';
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

  return (
    <GameContext.Provider
      value={{
        state,
        selectCareerMode,
        setCoachCountry,
        selectTeam,
        setManager,
        startCareer,
        setCareerPlayer,
        setPlayerClub,
        finishPlayerSetup,
        addCompetition,
        updateCareerPlayer,
        transferPlayer,
        addInjury,
        removeInjury,
        advanceSeason,
        updatePlayer,
        scheduleMatch,
        schedulePlayerMatch,
        updateScheduledMatch,
        completeMatch,
        updateCompletedMatch,
        completePlayerMatch,
        updatePlayerMatch,
        saveTactics,
        loadSavedGame,
        completeTutorial,
        resetGame,
        getTeamPlayers,
        getMatch,
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

export { allTeams, allPlayers };
