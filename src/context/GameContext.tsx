import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { Team } from '../types/Team';
import type { Player } from '../types/Player';
import type { Match, ScheduleMatchInput, CompleteMatchInput } from '../types/Match';
import type { Manager } from '../types/Manager';
import type { SavedTactics } from '../types/Tactics';
import { saveGame, loadGame, clearGame } from '../services/storage';
import { calcResult, recalculateFromMatches } from '../utils/matchStats';
import teamsData from '../data/teams.json';
import playersData from '../data/players.json';

const allTeams = teamsData as Team[];
const allPlayers = playersData as Player[];

export interface GameState {
  started: boolean;
  setupStep: 'team' | 'manager' | 'competitions' | 'done';
  pendingTeamId: string | null;
  teamId: string | null;
  team: Team | null;
  manager: Manager | null;
  seasonCompetitions: string[];
  players: Player[];
  matches: Match[];
  season: number;
  tactics: SavedTactics | null;
  tutorialCompleted: boolean;
}

type GameAction =
  | { type: 'SELECT_TEAM'; teamId: string }
  | { type: 'SET_MANAGER'; manager: Manager }
  | { type: 'START_CAREER'; teamId: string; manager: Manager; seasonCompetitions: string[] }
  | { type: 'UPDATE_PLAYER'; playerId: string; updates: Partial<Pick<Player, 'number' | 'age' | 'overall' | 'status'>> }
  | { type: 'SCHEDULE_MATCH'; match: Match }
  | { type: 'UPDATE_SCHEDULED_MATCH'; matchId: string; updates: ScheduleMatchInput }
  | { type: 'COMPLETE_MATCH'; input: CompleteMatchInput }
  | { type: 'UPDATE_COMPLETED_MATCH'; input: CompleteMatchInput }
  | { type: 'SAVE_TACTICS'; tactics: SavedTactics }
  | { type: 'LOAD_SAVE'; state: Omit<GameState, 'started' | 'setupStep' | 'pendingTeamId'> }
  | { type: 'COMPLETE_TUTORIAL' }
  | { type: 'RESET' };

interface GameContextValue {
  state: GameState;
  selectTeam: (teamId: string) => void;
  setManager: (manager: Manager) => void;
  startCareer: (seasonCompetitions: string[]) => void;
  updatePlayer: (playerId: string, updates: Partial<Pick<Player, 'number' | 'age' | 'overall' | 'status'>>) => void;
  scheduleMatch: (input: ScheduleMatchInput) => string;
  updateScheduledMatch: (matchId: string, updates: ScheduleMatchInput) => void;
  completeMatch: (input: CompleteMatchInput) => void;
  updateCompletedMatch: (input: CompleteMatchInput) => void;
  saveTactics: (tactics: SavedTactics) => void;
  loadSavedGame: () => boolean;
  completeTutorial: () => void;
  resetGame: () => void;
  getTeamPlayers: () => Player[];
  getMatch: (matchId: string) => Match | undefined;
}

const initialState: GameState = {
  started: false,
  setupStep: 'team',
  pendingTeamId: null,
  teamId: null,
  team: null,
  manager: null,
  seasonCompetitions: [],
  players: [],
  matches: [],
  season: 2025,
  tactics: null,
  tutorialCompleted: false,
};

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
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
        setupStep: 'done',
        pendingTeamId: null,
        teamId: action.teamId,
        team,
        manager: action.manager,
        seasonCompetitions: action.seasonCompetitions,
        players,
        matches: [],
        season: 2025,
        tutorialCompleted: false,
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

    case 'SAVE_TACTICS':
      return { ...state, tactics: action.tactics };

    case 'COMPLETE_TUTORIAL':
      return { ...state, tutorialCompleted: true };

    case 'LOAD_SAVE':
      return {
        started: true,
        setupStep: 'done',
        pendingTeamId: null,
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
    if (state.started && state.team) {
      saveGame({
        teamId: state.teamId!,
        team: state.team,
        players: state.players,
        matches: state.matches,
        season: state.season,
        manager: state.manager,
        seasonCompetitions: state.seasonCompetitions,
        tactics: state.tactics,
        tutorialCompleted: state.tutorialCompleted,
      });
    }
  }, [state]);

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

  function updateScheduledMatch(matchId: string, updates: ScheduleMatchInput) {
    dispatch({ type: 'UPDATE_SCHEDULED_MATCH', matchId, updates });
  }

  function completeMatch(input: CompleteMatchInput) {
    dispatch({ type: 'COMPLETE_MATCH', input });
  }

  function updateCompletedMatch(input: CompleteMatchInput) {
    dispatch({ type: 'UPDATE_COMPLETED_MATCH', input });
  }

  function saveTactics(tactics: SavedTactics) {
    dispatch({ type: 'SAVE_TACTICS', tactics });
  }

  function loadSavedGame(): boolean {
    const save = loadGame();
    if (!save) return false;
    dispatch({
      type: 'LOAD_SAVE',
      state: {
        teamId: save.teamId,
        team: save.team,
        manager: save.manager,
        seasonCompetitions: save.seasonCompetitions,
        players: save.players,
        matches: save.matches,
        season: save.season,
        tactics: save.tactics,
        tutorialCompleted: save.tutorialCompleted ?? false,
      },
    });
    return true;
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
        selectTeam,
        setManager,
        startCareer,
        updatePlayer,
        scheduleMatch,
        updateScheduledMatch,
        completeMatch,
        updateCompletedMatch,
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
