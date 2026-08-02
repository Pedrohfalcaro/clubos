export type PulseRarity = 'comum' | 'incomum' | 'raro' | 'muito-raro';

export type PulseCategory =
  | 'atleta'
  | 'diretoria'
  | 'torcida'
  | 'imprensa'
  | 'lesao'
  | 'financeiro'
  | 'familia'
  | 'transferencia'
  | 'patrocinio'
  | 'escandalo'
  | 'nenhum';

export type PulseAvailability = 'disponivel' | 'lesionado' | 'indisponivel' | 'suspenso';

export type PulsePosition =
  | 'GOL'
  | 'ZAG'
  | 'LE'
  | 'LD'
  | 'VOL'
  | 'MC'
  | 'ME'
  | 'MD'
  | 'PE'
  | 'PD'
  | 'ATA';

export interface PulseEventTags {
  idades?: Array<'jovem' | 'pico' | 'veterano'>;
  personalidades?: string[];
  posicoes?: PulsePosition[];
  status?: PulseAvailability[];
  precisaAtleta?: boolean;
  /** Só atletas com moral ≤ este valor. */
  moralMax?: number;
  /** Só atletas com moral ≥ este valor. */
  moralMin?: number;
  /**
   * Atacantes/pontas em má fase: jogos ≥ minMatches (default 8) e gols ≤ maxGoals (default 0).
   */
  formDryAttack?: boolean;
  minMatches?: number;
  maxGoals?: number;
}

export interface PulseEventEffects {
  moral?: number;
  fadiga?: number;
  status?: PulseAvailability;
  /** Dias fora explícitos (prioridade sobre gravidade). */
  diasFora?: number;
  /**
   * Gravidade para sortear duração:
   * leve 2–5 · media 7–21 · grave 45–120 dias
   */
  gravidade?: 'leve' | 'media' | 'grave';
  /** Delta de caixa do clube (positivo = receita, negativo = despesa). */
  caixa?: number;
  /** Delta na confiança da diretoria (0–100). */
  boardConfidence?: number;
  /** Delta na confiança da torcida (0–100). */
  supporterConfidence?: number;
  /** Delta na relação com a mídia (0–100). Difícil de agradar. */
  mediaConfidence?: number;
}

export interface PulseEventDef {
  id: string;
  categoria: Exclude<PulseCategory, 'nenhum'>;
  raridade: PulseRarity;
  titulo: string;
  descricao: string;
  tags?: PulseEventTags;
  efeitos?: PulseEventEffects;
  impactos?: string[];
  cadeia?: { nextId: string; chance?: number } | null;
  cooldown?: number;
  /**
   * `match_only` = só no Pulse pré-partida.
   * `any` / omitido = pode sair no Pulse diário (com heurística em `eventTrigger`).
   */
  trigger?: 'any' | 'match_only';
}

export interface PulseAthlete {
  id: string;
  nome: string;
  posicao: PulsePosition | string;
  idade: number | null;
  personalidade: string;
  moral: number;
  fadiga: number;
  status: PulseAvailability;
  /** Stats da temporada (personalização de eventos). */
  matches?: number;
  goals?: number;
  assists?: number;
}

export interface PulseClub {
  id: string;
  nome: string;
  temporadaAtual: number;
  partidasGeradas?: number;
  /** Confiança da diretoria (0–100) — influencia eventos de diretoria */
  boardConfidence?: number;
  /** Moral da torcida (0–100) — influencia eventos de torcida */
  supporterConfidence?: number;
  /** Relação com a imprensa (0–100) — baixa → mais notícias ruins */
  mediaConfidence?: number;
}

export interface PulseSettings {
  chanceEvento: number;
  cooldownEventos: number;
  showLoading: boolean;
  /** Chance de evento Pulse em dias sem jogo (0–0.5). Default 0.2. */
  dailyEventChance: number;
}

export interface PulseChainPending {
  nextId: string;
  atletaId: string | null;
  fromId: string;
  createdAt: string;
}

export interface PulseHistoryEntry {
  id: string;
  data: string;
  temporada: number;
  categoria: PulseCategory;
  raridade: PulseRarity | null;
  titulo: string;
  descricao: string;
  impactos: string[];
  atletaId: string | null;
  atletaNome: string | null;
  eventoId: string | null;
  cadeiaId: string | null;
  matchId?: string | null;
}

export interface PulseState {
  history: PulseHistoryEntry[];
  cooldowns: Record<string, number>;
  chains: { active: PulseChainPending[] };
  settings: PulseSettings;
  /** Match IDs that already rolled Pulse (skip re-roll when re-entering) */
  rolledMatchIds: string[];
}

export interface PulseGenerateResult {
  tipo: 'nada' | 'evento' | 'erro';
  mensagem?: string;
  eventoId?: string;
  categoria?: PulseCategory;
  raridade?: PulseRarity | null;
  titulo?: string;
  descricao?: string;
  impactos?: string[];
  atletaId?: string | null;
  atletaNome?: string | null;
  cadeiaId?: string | null;
  temporada?: number;
}

export interface PulseGenerateOutput {
  resultado: PulseGenerateResult;
  pulseState: PulseState;
  athletePatches: Array<{
    id: string;
    moral?: number;
    fadiga?: number;
    availability?: PulseAvailability;
    injuryDaysRemaining?: number;
  }>;
  /** Movimento de caixa gerado pelo evento (Pulse → Finance). */
  financePatch?: { amount: number; label: string } | null;
  /** Clima do clube (diretoria / torcida / mídia). */
  climatePatch?: {
    board?: number;
    supporter?: number;
    media?: number;
    reason: string;
  } | null;
  historyEntry: PulseHistoryEntry;
}

export const DEFAULT_PULSE_SETTINGS: PulseSettings = {
  chanceEvento: 0.28,
  cooldownEventos: 20,
  showLoading: true,
  dailyEventChance: 0.2,
};

export function createDefaultPulseState(): PulseState {
  return {
    history: [],
    cooldowns: {},
    chains: { active: [] },
    settings: { ...DEFAULT_PULSE_SETTINGS },
    rolledMatchIds: [],
  };
}
