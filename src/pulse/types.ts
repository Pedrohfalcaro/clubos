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

export type PulseAvailability = 'disponivel' | 'lesionado' | 'indisponivel';

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
}

export interface PulseEventEffects {
  moral?: number;
  fadiga?: number;
  status?: PulseAvailability;
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
}

export interface PulseClub {
  id: string;
  nome: string;
  temporadaAtual: number;
  partidasGeradas?: number;
}

export interface PulseSettings {
  chanceEvento: number;
  cooldownEventos: number;
  showLoading: boolean;
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
  }>;
  historyEntry: PulseHistoryEntry;
}

export const DEFAULT_PULSE_SETTINGS: PulseSettings = {
  chanceEvento: 0.28,
  cooldownEventos: 20,
  showLoading: true,
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
