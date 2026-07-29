export type FormationKey =
  // 4 defensores
  | '442'
  | '442-losango'
  | '4412'
  | '433'
  | '4231'
  | '4141'
  | '4222'
  | '4312'
  | '451'
  | '424'
  // 3 defensores
  | '352'
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

/** Tactics with every field resolved and consistent — what the UI works with. */
export interface TacticsDraft {
  formationKey: FormationKey;
  style: TacticalStyleKey;
  formation: FormationSlot[];
  bench: string[];
}
