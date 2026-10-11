import type { Format, Pitch } from './types.ts';

/** Dimensões por formato — o campo sempre ocupa a tela inteira, só muda a proporção do jogo. */
export const PITCHES: Record<Format, Pitch> = {
  5: { L: 40, H: 22, goalW: 3, scale: 0.62 },
  7: { L: 60, H: 40, goalW: 5, scale: 0.8 },
  11: { L: 105, H: 68, goalW: 7.32, scale: 1 },
};

export interface Markings {
  boxD: number;
  boxW: number;
  sixD: number;
  sixW: number;
  circle: number;
  spot: number;
  goalDepth: number;
}

/** Medidas oficiais para 11; proporções equivalentes para society (7) e fut5. */
export const MARKINGS: Record<Format, Markings> = {
  11: { boxD: 16.5, boxW: 40.32, sixD: 5.5, sixW: 18.32, circle: 9.15, spot: 11, goalDepth: 2.4 },
  7: { boxD: 9, boxW: 22, sixD: 3.5, sixW: 10, circle: 6, spot: 7, goalDepth: 2 },
  5: { boxD: 6, boxW: 13, sixD: 0, sixW: 0, circle: 3.5, spot: 6, goalDepth: 1.5 },
};

/** Ajustes por formato: campos menores pedem chute de mais longe e ritmos diferentes. */
export const FORMAT_TUNING: Record<Format, { shootRange: number; shotP: number }> = {
  5: { shootRange: 0.3, shotP: 0.6 },
  7: { shootRange: 0.24, shotP: 0.8 },
  11: { shootRange: 0.27, shotP: 1.2 },
};

/** Constantes de balanceamento — ajustar com `scripts/trainingCalibration.ts`. */
export const TUNING = {
  dt: 1 / 30,
  /** m/s do jogador mais lento / mais rápido (campo de 11). */
  speedMin: 5.8,
  speedMax: 8.8,
  walkFactor: 0.72,
  accel: 9,
  ballFriction: 5,
  pickupRadius: 1.15,
  gkPickupRadius: 1.9,
  pickupMaxSpeed: 16,
  carryDistance: 0.55,
  tackleRadius: 1.6,
  tackleCooldown: 0.7,
  protectTime: 0.45,
  kickLock: 0.4,
  thinkMin: 0.28,
  thinkJitter: 0.22,
  /** distância de chute em fração do comprimento do campo */
  shootRange: 0.22,
  clearZone: 0.24,
  restartDelay: 0.8,
  goalDelay: 2.2,
  halfTimeDelay: 2.0,
  gkReach: 1.9,
  /** perda de energia por segundo em velocidade máxima */
  staminaDrain: 0.0016,
} as const;
