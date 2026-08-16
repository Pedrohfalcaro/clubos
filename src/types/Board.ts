export type BoardGoalKind =
  | 'league_position'
  | 'cup_stage'
  | 'dont_spend_over'
  | 'sell_players'
  | 'sign_players'
  | 'reduce_debt'
  | 'positive_balance'
  | 'wage_bill_cap'
  | 'win_competition';

export type BoardGoalStatus = 'active' | 'done' | 'exceeded' | 'failed';

export type BoardGoalPriority = 'low' | 'medium' | 'high' | 'critical';

/** Faixa de posição na liga — converte para um `target` numérico ao criar a meta. */
export type LeagueTier = 'champion' | 'g4' | 'continental' | 'mid_table' | 'relegation_escape';

/** Fase mínima de mata-mata exigida. `champion` mapeia para o kind `win_competition`. */
export type CupStage = 'r16' | 'qf' | 'sf' | 'final' | 'champion';

export interface BoardGoal {
  id: string;
  season: number;
  kind: BoardGoalKind;
  label: string;
  /** Numeric target (e.g. position number, amount in currency, player count) */
  target: number;
  /** Numeric current progress */
  current: number;
  status: BoardGoalStatus;
  /**
   * Competição vinculada — obrigatório para `league_position`/`cup_stage`/`win_competition`
   * quando a meta deve ser avaliada automaticamente (ver utils/boardGoals.ts).
   */
  competitionId?: string;
  /** Prioridade — escala o impacto de moral ao resolver (ver PRIORITY_MULTIPLIER). */
  priority?: BoardGoalPriority;
  /** Faixa escolhida na criação (só `league_position`) — guardada para reexibir o rótulo. */
  leagueTier?: LeagueTier;
  /** Fase escolhida na criação (só `cup_stage`) — guardada para reexibir o rótulo. */
  cupStageTarget?: CupStage;
  /** Total de rodadas da fase de liga (só `league_position`), padrão 38. */
  totalMatchdays?: number;
  /** Nº de jogos já processados pelo ajuste de moral "por rodada" (bookkeeping interno). */
  pacingTickedGames?: number;
  /** Meta finalizada manualmente pelo usuário — o tick automático não a reavalia mais. */
  resolvedManually?: boolean;
}

export interface BoardConfidenceEntry {
  date: string;
  value: number;
  reason: string;
}

export interface BoardState {
  goals: BoardGoal[];
  confidenceHistory: BoardConfidenceEntry[];
  /** Histórico da moral/confiança da torcida */
  supporterHistory: BoardConfidenceEntry[];
  /** Histórico da relação com a mídia */
  mediaHistory?: BoardConfidenceEntry[];
  notes?: string;
  /** Última temporada em que o popup de configuração de metas foi dispensado/concluído. */
  goalPromptDismissedSeason?: number;
}

export function createDefaultBoardState(): BoardState {
  return {
    goals: [],
    confidenceHistory: [],
    supporterHistory: [],
    mediaHistory: [],
    notes: undefined,
    goalPromptDismissedSeason: undefined,
  };
}

export function boardStatus(confidence: number): 'stable' | 'watchful' | 'crisis' {
  if (confidence >= 65) return 'stable';
  if (confidence >= 35) return 'watchful';
  return 'crisis';
}

export const PRIORITY_LABELS: Record<BoardGoalPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

export const LEAGUE_TIER_LABELS: Record<LeagueTier, string> = {
  champion: 'Campeão',
  g4: 'G4 / Classificação direta',
  continental: 'Classificação continental',
  mid_table: 'Meio de tabela',
  relegation_escape: 'Fuga do rebaixamento',
};

export const CUP_STAGE_LABELS: Record<CupStage, string> = {
  r16: 'Oitavas de final',
  qf: 'Quartas de final',
  sf: 'Semifinal',
  final: 'Final',
  champion: 'Campeão',
};
