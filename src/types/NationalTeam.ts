import type { PlayerPosition } from './Player';
import type {
  AssistEvent,
  CardEvent,
  GoalEvent,
  MatchLineup,
  OpponentCardEntry,
  OpponentGoalEntry,
  OpponentSubEntry,
  PlayerMatchRating,
  SubstitutionEvent,
  TeamInjuryEntry,
} from './Match';
import type { SavedTactics, TacticsPreset } from './Tactics';

/**
 * Seleção Nacional / Dual Career (International Duty Update, v1.4).
 * Ver `InternationalDuty - Desenvolvimento/plano_de_desenvolvimento.md` (Fase 1).
 */

export type FifaWindowType =
  | 'eliminatorias'
  | 'amistoso'
  | 'copa_mundo'
  | 'copa_continental'
  | 'outros';

/** Classificação manual da força do adversário — não existe base real de seleções. */
export type OpponentStrength = 'top10' | 'top30' | 'outros';

export type CallUpListSize = 23 | 26;

export interface NationalPlayerStats {
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  /** Soma das notas recebidas — média = ratingSum / ratingCount. */
  ratingSum: number;
  ratingCount: number;
}

/**
 * Atleta convocado. Independente de `Player` (clube) — a maioria dos convocados
 * não pertence ao elenco do usuário. `clubPlayerId` só existe quando o convocado
 * é, de fato, um `Player` do elenco do usuário (dispara o desfalque no clube).
 */
export interface NationalPlayer {
  id: string;
  name: string;
  position: PlayerPosition;
  age: number;
  /** Clube de origem do atleta (texto livre). */
  club: string;
  overall?: number;
  clubPlayerId?: string;
  /** Total de convocações (independente de ter entrado em campo). */
  caps: number;
  stats: NationalPlayerStats;
}

export interface NationalMatchPerformance {
  nationalPlayerId: string;
  minutes: number;
  goals: number;
  assists: number;
  /** 5–10, opcional — nem toda partida precisa de nota. */
  rating?: number;
  yellowCard?: boolean;
  redCard?: boolean;
}

export interface FifaWindowGame {
  id: string;
  opponent: string;
  location: 'home' | 'away' | 'neutral';
  /** ISO — data do jogo. */
  date: string;
  opponentStrength: OpponentStrength;
  played: boolean;
  goalsFor?: number;
  goalsAgainst?: number;
  /** Escalação titular/banco usada nesta partida (Fase 6.1 — "jogar como no clube"). */
  lineup?: MatchLineup;
  goals?: GoalEvent[];
  assists?: AssistEvent[];
  cards?: CardEvent[];
  substitutions?: SubstitutionEvent[];
  injuries?: TeamInjuryEntry[];
  /** Gols/cartões/subs do adversário — estruturados, só para exibição no resumo. */
  opponentGoals?: OpponentGoalEntry[];
  opponentCards?: OpponentCardEntry[];
  opponentSubs?: OpponentSubEntry[];
  playerRatings?: PlayerMatchRating[];
  motmNationalPlayerId?: string;
  worstNationalPlayerId?: string;
  description?: string;
  /** Agregado derivado de `goals`/`assists`/`cards`/`lineup` ao finalizar a partida. */
  performances?: NationalMatchPerformance[];
}

/** Data FIFA — janela de liberação de atletas + jogos mapeados. */
export interface FifaWindow {
  id: string;
  /** Sugestão automática (ex. "OUT/2026"), editável pelo usuário. */
  label: string;
  type: FifaWindowType;
  /** Texto livre — obrigatório quando `type === 'outros'`. */
  typeOther?: string;
  /** ISO — início da liberação dos atletas pelos clubes. */
  startDate: string;
  /** ISO — fim da liberação. Também usado como `Player.nationalDutyUntil`. */
  endDate: string;
  listSize: CallUpListSize;
  /** `NationalPlayer.id` convocados nesta janela. */
  callUpIds: string[];
  /**
   * Numeração de camisa por convocado, específica desta Data FIFA (não é um
   * atributo fixo do `NationalPlayer` — pode mudar de uma convocação pra outra).
   * Sem entrada = "—"; ao convocar alguém, o número da convocação anterior em
   * que participou é sugerido automaticamente (ver `carryOverCallUpNumber`).
   */
  callUpNumbers: Record<string, number>;
  games: FifaWindowGame[];
  /**
   * `NationalPlayer.id` já resolvidos no evento "clube pede desconvocação para
   * amistoso" (Fase 8) nesta janela — evita perguntar de novo pelo mesmo atleta.
   */
  deconvocationResolvedIds: string[];
  /** Tática desta Data FIFA — escopo é só quem foi convocado pra ela. */
  tactics: SavedTactics | null;
  tacticsPresets: TacticsPreset[];
  activeTacticsId: string | null;
}

export type NationalBoardGoalKind = 'reach_stage' | 'win_tournament' | 'avoid_relegation_ranking';
export type NationalBoardGoalStatus = 'active' | 'done' | 'failed';

/**
 * Meta da diretoria/federação. Estrutura própria e menor que `BoardGoal` do
 * clube — nunca reaproveitar `BoardGoal`/`BoardState` por herança (ver plano §1).
 */
export interface NationalBoardGoal {
  id: string;
  kind: NationalBoardGoalKind;
  label: string;
  target: number;
  current: number;
  status: NationalBoardGoalStatus;
}

export interface NationalTeamState {
  name: string;
  primaryColor?: string;
  secondaryColor?: string;
  /** Moral da federação, 0–100 — equivalente a `boardConfidence`, mas independente. */
  federationMood: number;
  /** Ranking FIFA simplificado — métrica autocontida da seleção do usuário. */
  fifaRanking: number;
  fifaRankingHistory: { date: string; value: number }[];
  /** Banco recorrente de convocados. */
  talentPool: NationalPlayer[];
  windows: FifaWindow[];
  goals: NationalBoardGoal[];
  /** Histórico de ajustes da moral da federação (mais recente primeiro). */
  federationMoodHistory: { date: string; value: number; reason: string }[];
  /** `currentDate` do jogo no momento da criação (onboarding). */
  onboardedAt: string;
}

export function emptyNationalPlayerStats(): NationalPlayerStats {
  return { matches: 0, minutes: 0, goals: 0, assists: 0, ratingSum: 0, ratingCount: 0 };
}

export function createDefaultNationalTeamState(
  name: string,
  options?: {
    primaryColor?: string;
    secondaryColor?: string;
    startingFifaRanking?: number;
    onboardedAt?: string;
  },
): NationalTeamState {
  return {
    name,
    primaryColor: options?.primaryColor,
    secondaryColor: options?.secondaryColor,
    federationMood: 60,
    fifaRanking: options?.startingFifaRanking ?? 50,
    fifaRankingHistory: [],
    talentPool: [],
    windows: [],
    goals: [],
    federationMoodHistory: [],
    onboardedAt: options?.onboardedAt ?? new Date().toISOString().slice(0, 10),
  };
}

/** Preenche campos ausentes numa `FifaWindow` carregada de um save anterior a esta fase. */
export function normalizeFifaWindow(w: FifaWindow): FifaWindow {
  return {
    ...w,
    callUpNumbers: w.callUpNumbers ?? {},
    tactics: w.tactics ?? null,
    tacticsPresets: w.tacticsPresets ?? [],
    activeTacticsId: w.activeTacticsId ?? null,
    deconvocationResolvedIds: w.deconvocationResolvedIds ?? [],
  };
}

/** Preenche campos ausentes em `nationalTeam` carregado de um save anterior a esta fase. */
export function normalizeNationalTeam(
  nt: NationalTeamState | null | undefined,
): NationalTeamState | null {
  if (!nt) return null;
  return {
    ...nt,
    windows: nt.windows.map(normalizeFifaWindow),
    federationMoodHistory: nt.federationMoodHistory ?? [],
  };
}

export const FIFA_WINDOW_TYPE_LABELS: Record<FifaWindowType, string> = {
  eliminatorias: 'Eliminatórias',
  amistoso: 'Amistoso',
  copa_mundo: 'Copa do Mundo',
  copa_continental: 'Copa Continental',
  outros: 'Outros',
};

export const OPPONENT_STRENGTH_LABELS: Record<OpponentStrength, string> = {
  top10: 'Top 10 do ranking',
  top30: 'Top 30 do ranking',
  outros: 'Fora do Top 30',
};

export const CALL_UP_LIST_SIZES: CallUpListSize[] = [23, 26];
