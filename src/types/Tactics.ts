export type FormationKey =
  // 4-4-2 e variantes
  | '442'
  | '442-losango'
  | '442-aberto'
  | '4412'
  // 4-3-3 e variantes
  | '433'
  | '433-holding'
  | '433-falso9'
  // 4-2-3-1 e variantes
  | '4231'
  | '4231-estreito'
  // outras com 4 defensores
  | '4141'
  | '4222'
  | '4312'
  | '451'
  | '451-fechado'
  | '424'
  // 3 defensores
  | '352'
  | '352-ofensivo'
  | '343'
  | '3421'
  // 5 defensores
  | '532'
  | '541';

export type TacticalStyleKey =
  | 'padrao'
  | 'ofensivo'
  | 'ultra-ofensivo'
  | 'defensivo'
  | 'retranca'
  | 'contra-ataque'
  | 'posse'
  | 'direto'
  | 'pressao'
  | 'aberto';

export type SlotRole =
  | 'GOL'
  | 'ZAG'
  | 'LE'
  | 'LD'
  | 'ALE'
  | 'ALD'
  | 'VOL'
  | 'MC'
  | 'MEI'
  | 'ME'
  | 'MD'
  | 'PE'
  | 'PD'
  | 'SA'
  | 'ATA';

export interface FormationSlot {
  playerId: string;
  x: number;
  y: number;
  /** Index of the slot inside the formation preset. Source of truth for placement. */
  slot?: number;
}

export interface SavedTactics {
  formation: FormationSlot[];
  bench: string[];
  formationKey?: FormationKey;
  style?: TacticalStyleKey;
  updatedAt?: string;
}

/** Preset nomeado (até 5 por carreira). */
export interface TacticsPreset extends SavedTactics {
  id: string;
  name: string;
}

export const MAX_TACTICS_PRESETS = 5;

/** Tactics with every field resolved and consistent — what the UI works with. */
export interface TacticsDraft {
  formationKey: FormationKey;
  style: TacticalStyleKey;
  formation: FormationSlot[];
  bench: string[];
}
