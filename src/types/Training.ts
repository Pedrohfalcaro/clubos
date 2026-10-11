import type { Kit } from './Kit';
import type { Player } from './Player';

export type TrainingFormatSize = 5 | 7 | 11;
export type TrainingMode = 'vs-cpu' | 'cpu-cpu' | 'two-players';
export type TrainingTeamKey = 'a' | 'b';

export interface TrainingTeamSetup {
  /** "<Clube> A" / "<Clube> B" */
  name: string;
  /** Cor base do uniforme usado. */
  kit: string;
  /** Uniforme completo (cor base + desenho); ausente em treinos antigos. */
  kitDesign?: Kit;
  formationKey: string;
  /** Estilo tático usado no jogo (chave de `TacticalStyleKey`). */
  style?: string;
  lineup: { slot: number; playerId: string }[];
  /** Reservas que entraram no jogo (na ordem das substituições). */
  substitutes?: string[];
}

export interface TrainingPlayerStats {
  goals: number;
  assists: number;
  /** Defesas — goleiros. */
  saves?: number;
  /** Cortes (bola afastada do perigo) — zagueiros e defensores. */
  clearances?: number;
  /** Time não sofreu gol — conta para goleiro e defensores. */
  cleanSheet?: boolean;
  shotsOn?: number;
  shotsOff?: number;
  passesOk?: number;
  passesBad?: number;
  keyPasses?: number;
  tackles?: number;
  interceptions?: number;
  crosses?: number;
  fouls?: number;
  foulsWon?: number;
  yellows?: number;
  reds?: number;
  offsides?: number;
  dribbles?: number;
  dribblesWon?: number;
}

export interface TrainingGoal {
  /** Segundos desde o início da partida (somando os dois tempos). */
  t: number;
  team: TrainingTeamKey;
  /** Quem marcou — ou quem fez o gol contra. */
  playerId?: string;
  assistId?: string;
  ownGoal?: boolean;
}

export interface TrainingSession {
  id: string;
  /** Data ISO (YYYY-MM-DD) do jogo no calendário da carreira. */
  date: string;
  season: number;
  open: boolean;
  mode: TrainingMode;
  /** Só em `vs-cpu`. */
  controlledTeam?: TrainingTeamKey;
  format: TrainingFormatSize;
  halfDurationSec: number;
  teams: Record<TrainingTeamKey, TrainingTeamSetup>;
  score: { a: number; b: number };
  goals?: TrainingGoal[];
  playerStats: Record<string, TrainingPlayerStats>;
  /** Nota 0–10 por jogador, calculada pelo motor de notas. */
  ratings: Record<string, number>;
  /** Variação de moral aplicada — gravada para o "Voltar dia" conseguir desfazer. */
  moraleDelta: Record<string, number>;
  /** Lesões do treino, com o estado anterior do atleta (para o "Voltar dia" desfazer). */
  injuries: {
    playerId: string;
    days: number;
    prevAvailability?: Player['availability'];
    prevDays?: number;
  }[];
  /** Fração da partida que cada atleta jogou (0–1). */
  shares?: Record<string, number>;
  /** Treino aberto: quem a imprensa destacou (melhores) e criticou (piores). */
  highlights?: { best: string[]; worst: string[] };
  /** Notícias do Pulse geradas por este treino (para o "Voltar dia" removê-las). */
  pulseIds?: string[];
  mvpId: string | null;
  /**
   * Sessão registrada antes de o jogo 2D existir (Fase 1): só consome o treino da
   * semana, sem placar nem notas.
   */
  placeholder?: boolean;
}

export interface TrainingSettings {
  halfDurationSec: 120 | 150;
}

export interface TrainingState {
  history: TrainingSession[];
  settings: TrainingSettings;
}

export function createDefaultTrainingState(): TrainingState {
  return { history: [], settings: { halfDurationSec: 150 } };
}

export function normalizeTrainingState(raw: Partial<TrainingState> | null | undefined): TrainingState {
  const base = createDefaultTrainingState();
  return {
    history: Array.isArray(raw?.history) ? raw.history : base.history,
    settings: {
      halfDurationSec: raw?.settings?.halfDurationSec === 120 ? 120 : 150,
    },
  };
}
