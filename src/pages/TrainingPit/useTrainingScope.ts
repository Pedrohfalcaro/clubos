import { useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { applyTrainingEffects } from '../../training/effects';
import type { NationalPlayer } from '../../types/NationalTeam';
import type { Player } from '../../types/Player';
import { defaultKits, resolveKits, type Kit } from '../../types/Kit';
import {
  createDefaultTrainingState,
  normalizeTrainingState,
  type TrainingSession,
  type TrainingSettings,
} from '../../types/Training';
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY } from '../../utils/clubColors';
import { trainingAvailability, type TrainingAvailability } from '../../utils/trainingSchedule';

export type TrainingScopeKind = 'club' | 'national';

/**
 * Tudo que a aba de Treinamento precisa saber de onde está sendo usada:
 * - **club** (aba Treinamento do clube): elenco do clube, 1 treino por semana, efeitos em moral/lesão e Pulse.
 * - **national** (Data FIFA): banco de convocados da Seleção, treino livre e ilimitado, sem efeitos —
 *   serve para testar times rapidamente.
 */
export interface TrainingScope {
  kind: TrainingScopeKind;
  players: Player[];
  formerPlayers: Player[];
  teamName: string;
  primary: string;
  secondary: string;
  kits: Kit[];
  history: TrainingSession[];
  settings: TrainingSettings;
  season: number;
  currentDate: string | null;
  unlimited: boolean;
  availability: TrainingAvailability;
  routes: { base: string; play: string };
  /** Registra o treino (clube: aplica moral/lesão antes) e devolve a sessão final. */
  register: (session: TrainingSession) => TrainingSession;
  setTrait: (playerId: string, trait: string | undefined) => void;
}

/** Convocado da Seleção → atleta com os campos que o treino usa. */
export function nationalToPlayer(np: NationalPlayer): Player {
  return {
    id: np.id,
    teamId: '',
    name: np.name,
    position: np.position,
    number: null,
    age: np.age,
    overall: np.overall ?? 70,
    potential: np.overall ?? 70,
    morale: 70,
    salary: 0,
    marketValue: 0,
    status: 'Titular',
    stats: {
      matches: 0,
      minutes: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      goalsConceded: 0,
      yellowCards: 0,
      redCards: 0,
    },
    fatigue: 0,
    availability: 'disponivel',
    trait: np.trait,
  };
}

export function useTrainingScope(kind: TrainingScopeKind): TrainingScope {
  const { state, addTrainingSession, addNationalTrainingSession, updatePlayer, updateNationalPlayer } = useGame();

  return useMemo<TrainingScope>(() => {
    if (kind === 'national') {
      const nt = state.nationalTeam;
      const primary = nt?.primaryColor ?? DEFAULT_PRIMARY;
      const secondary = nt?.secondaryColor ?? DEFAULT_SECONDARY;
      const training = normalizeTrainingState(nt?.training ?? createDefaultTrainingState());
      return {
        kind,
        players: (nt?.talentPool ?? []).map(nationalToPlayer),
        formerPlayers: [],
        teamName: nt?.name?.trim() || 'Seleção',
        primary,
        secondary,
        kits: defaultKits(primary, secondary),
        history: training.history,
        settings: training.settings,
        season: state.season,
        currentDate: state.currentDate,
        unlimited: true,
        availability: {
          available: true,
          reason: null,
          message: 'Treino livre na Data FIFA — sem limite de uso.',
        },
        routes: { base: '/national/training', play: '/national/training/play' },
        register: session => {
          addNationalTrainingSession(session);
          return session;
        },
        setTrait: (id, trait) => updateNationalPlayer(id, { trait }),
      };
    }

    const primary = state.team?.primaryColor ?? DEFAULT_PRIMARY;
    const secondary = state.team?.secondaryColor ?? DEFAULT_SECONDARY;
    return {
      kind,
      players: state.players,
      formerPlayers: state.formerPlayers,
      teamName: state.team?.name?.trim() || 'Clube',
      primary,
      secondary,
      kits: resolveKits(state.team, primary, secondary),
      history: state.training.history,
      settings: state.training.settings,
      season: state.season,
      currentDate: state.currentDate,
      unlimited: false,
      availability: trainingAvailability(state.currentDate, state.matches, state.training.history),
      routes: { base: '/training', play: '/training/play' },
      register: session => {
        const final = applyTrainingEffects(session, state.players);
        addTrainingSession(final);
        return final;
      },
      setTrait: (id, trait) => updatePlayer(id, { trait }),
    };
  }, [kind, state, addTrainingSession, addNationalTrainingSession, updatePlayer, updateNationalPlayer]);
}
