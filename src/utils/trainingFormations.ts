import type { SlotRole } from '../types/Tactics';
import { FORMATION_FAMILIES } from './formations';

/** Jogadores por time no Training Pit. */
export type TrainingFormat = 5 | 7 | 11;

export const TRAINING_FORMATS: TrainingFormat[] = [5, 7, 11];

export interface TrainingFormationVariant {
  key: string;
  variantLabel: string;
  description: string;
  slots: { x: number; y: number; role: SlotRole }[];
}

export interface TrainingFormationFamily {
  id: string;
  label: string;
  variants: TrainingFormationVariant[];
}

/** Espalha `roles` uniformemente numa linha horizontal. */
function line(y: number, roles: SlotRole[]): { x: number; y: number; role: SlotRole }[] {
  const xs: Record<number, number[]> = {
    1: [50],
    2: [32, 68],
    3: [20, 50, 80],
    4: [12, 37, 63, 88],
  };
  const row = xs[roles.length];
  return roles.map((role, i) => ({ x: row[i], y, role }));
}

const GK = { x: 50, y: 88, role: 'GOL' as SlotRole };

function small(
  key: string,
  label: string,
  description: string,
  lines: { y: number; roles: SlotRole[] }[],
): TrainingFormationFamily {
  return {
    id: key,
    label,
    variants: [
      {
        key,
        variantLabel: label,
        description,
        slots: [GK, ...lines.flatMap(l => line(l.y, l.roles))],
      },
    ],
  };
}

const FIVE: TrainingFormationFamily[] = [
  small('t5-22', '2-2', 'Dupla defensiva e dupla de ataque. Simples e equilibrado.', [
    { y: 66, roles: ['ZAG', 'ZAG'] },
    { y: 34, roles: ['ATA', 'ATA'] },
  ]),
  small('t5-121', '1-2-1', 'Losango: um fixo, dois laterais de quadra e um pivô.', [
    { y: 68, roles: ['ZAG'] },
    { y: 50, roles: ['ME', 'MD'] },
    { y: 28, roles: ['ATA'] },
  ]),
  small('t5-31', '3-1', 'Três atrás e um homem de frente. Postura defensiva.', [
    { y: 66, roles: ['ZAG', 'ZAG', 'ZAG'] },
    { y: 30, roles: ['ATA'] },
  ]),
  small('t5-112', '1-1-2', 'Fixo, um meia de ligação e dupla de ataque.', [
    { y: 70, roles: ['ZAG'] },
    { y: 50, roles: ['MC'] },
    { y: 28, roles: ['ATA', 'ATA'] },
  ]),
];

const SEVEN: TrainingFormationFamily[] = [
  small('t7-231', '2-3-1', 'Dois zagueiros, trio de meio e um atacante. Formação base do society.', [
    { y: 70, roles: ['ZAG', 'ZAG'] },
    { y: 48, roles: ['ME', 'MC', 'MD'] },
    { y: 24, roles: ['ATA'] },
  ]),
  small('t7-321', '3-2-1', 'Três atrás, dois meias e um atacante. Mais sólida.', [
    { y: 70, roles: ['ZAG', 'ZAG', 'ZAG'] },
    { y: 48, roles: ['MC', 'MC'] },
    { y: 24, roles: ['ATA'] },
  ]),
  small('t7-222', '2-2-2', 'Duas linhas de dois e dupla de ataque. Equilibrado.', [
    { y: 70, roles: ['ZAG', 'ZAG'] },
    { y: 48, roles: ['MC', 'MC'] },
    { y: 24, roles: ['ATA', 'ATA'] },
  ]),
  small('t7-312', '3-1-2', 'Três atrás, um articulador e dupla de ataque.', [
    { y: 70, roles: ['ZAG', 'ZAG', 'ZAG'] },
    { y: 48, roles: ['MEI'] },
    { y: 24, roles: ['ATA', 'ATA'] },
  ]),
  small('t7-2121', '2-1-2-1', 'Volante fixo, dois meias abertos e um pivô de referência.', [
    { y: 70, roles: ['ZAG', 'ZAG'] },
    { y: 56, roles: ['VOL'] },
    { y: 40, roles: ['ME', 'MD'] },
    { y: 22, roles: ['ATA'] },
  ]),
];

/** Formações de 11 reaproveitam o catálogo das partidas. */
const ELEVEN: TrainingFormationFamily[] = FORMATION_FAMILIES.map(f => ({
  id: f.id,
  label: f.label,
  variants: f.variants.map(v => ({
    key: v.key,
    variantLabel: v.variantLabel,
    description: v.description,
    slots: v.slots,
  })),
}));

export const TRAINING_FAMILIES: Record<TrainingFormat, TrainingFormationFamily[]> = {
  5: FIVE,
  7: SEVEN,
  11: ELEVEN,
};

export function defaultTrainingVariant(format: TrainingFormat): TrainingFormationVariant {
  return TRAINING_FAMILIES[format][0].variants[0];
}

export function findTrainingVariant(
  format: TrainingFormat,
  key: string,
): TrainingFormationVariant {
  for (const family of TRAINING_FAMILIES[format]) {
    const hit = family.variants.find(v => v.key === key);
    if (hit) return hit;
  }
  return defaultTrainingVariant(format);
}

export function findTrainingFamily(
  format: TrainingFormat,
  key: string,
): TrainingFormationFamily {
  return (
    TRAINING_FAMILIES[format].find(f => f.variants.some(v => v.key === key)) ??
    TRAINING_FAMILIES[format][0]
  );
}

export type TrainingSide = 'north' | 'south';

/**
 * Converte um slot de formação (campo de 0-100 com o gol em y=88) para a metade
 * do campo completo. Sul = metade de baixo; norte = metade de cima, espelhada para
 * o time olhar para o lado oposto.
 */
export function slotOnFullPitch(
  slot: { x: number; y: number },
  side: TrainingSide,
): { x: number; y: number } {
  const southY = 52 + slot.y * 0.46;
  if (side === 'south') return { x: slot.x, y: southY };
  return { x: 100 - slot.x, y: 100 - southY };
}
