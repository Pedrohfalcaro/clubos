import type { PlayerPosition } from '../types/Player';

/** Agrupamento amplo por setor — usado onde a posição exata não importa (ex.: anúncio de convocação). */
export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'FWD';

export const POSITION_GROUP: Record<PlayerPosition, PositionGroup> = {
  GK: 'GK',
  CB: 'DEF',
  RB: 'DEF',
  LB: 'DEF',
  CDM: 'MID',
  CM: 'MID',
  CAM: 'MID',
  RW: 'FWD',
  LW: 'FWD',
  ST: 'FWD',
  CF: 'FWD',
};

export const POSITION_GROUP_LABELS: Record<PositionGroup, string> = {
  GK: 'Goleiros',
  DEF: 'Defensores',
  MID: 'Meio-campistas',
  FWD: 'Atacantes',
};

export const POSITION_GROUP_ORDER: PositionGroup[] = ['GK', 'DEF', 'MID', 'FWD'];

export function groupByPositionGroup<T extends { position: PlayerPosition }>(
  items: T[],
): Record<PositionGroup, T[]> {
  const result: Record<PositionGroup, T[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const item of items) {
    result[POSITION_GROUP[item.position]].push(item);
  }
  return result;
}
