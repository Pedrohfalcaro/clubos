import type { PlayerPosition } from '../../types/Player.ts';
import type { SlotRole } from '../../types/Tactics.ts';
import { hashUnit } from './rng.ts';
import { findTrait, NEUTRAL_BIASES, type AttrMods, type Biases } from './traits.ts';
import { TUNING } from './tuning.ts';
import type { Attrs, EnginePlayerInput, RoleGroup } from './types.ts';

interface Bonus {
  speed: number;
  pass: number;
  shoot: number;
  defend: number;
  dribble: number;
  stamina: number;
  aerial: number;
  strength: number;
  vision: number;
  crossing: number;
  workRate: number;
}

/** Perfil por posição: o overall é a base e cada posição puxa uns atributos para cima e outros para baixo. */
const POSITION_BONUS: Record<PlayerPosition, Bonus> = {
  GK: { speed: -10, pass: -8, shoot: -25, defend: -5, dribble: -15, stamina: 0, aerial: 0, strength: 0, vision: -4, crossing: -20, workRate: -6 },
  CB: { speed: -4, pass: -3, shoot: -12, defend: 6, dribble: -8, stamina: 0, aerial: 5, strength: 5, vision: -3, crossing: -8, workRate: 0 },
  LB: { speed: 4, pass: 0, shoot: -6, defend: 3, dribble: 0, stamina: 3, aerial: -3, strength: 0, vision: 0, crossing: 5, workRate: 3 },
  RB: { speed: 4, pass: 0, shoot: -6, defend: 3, dribble: 0, stamina: 3, aerial: -3, strength: 0, vision: 0, crossing: 5, workRate: 3 },
  CDM: { speed: -2, pass: 3, shoot: -6, defend: 5, dribble: -3, stamina: 3, aerial: 1, strength: 4, vision: 2, crossing: -3, workRate: 3 },
  CM: { speed: 0, pass: 4, shoot: 0, defend: -2, dribble: 2, stamina: 4, aerial: -1, strength: 0, vision: 3, crossing: 0, workRate: 4 },
  CAM: { speed: 0, pass: 6, shoot: 3, defend: -8, dribble: 6, stamina: 0, aerial: -3, strength: -3, vision: 6, crossing: 2, workRate: 0 },
  LW: { speed: 6, pass: 0, shoot: 2, defend: -10, dribble: 7, stamina: 0, aerial: -4, strength: -4, vision: 0, crossing: 5, workRate: 2 },
  RW: { speed: 6, pass: 0, shoot: 2, defend: -10, dribble: 7, stamina: 0, aerial: -4, strength: -4, vision: 0, crossing: 5, workRate: 2 },
  CF: { speed: 2, pass: 2, shoot: 3, defend: -12, dribble: 4, stamina: -2, aerial: 1, strength: 1, vision: 3, crossing: -3, workRate: 0 },
  ST: { speed: 3, pass: -4, shoot: 4, defend: -14, dribble: 2, stamina: -2, aerial: 3, strength: 2, vision: -3, crossing: -6, workRate: 0 },
};

/** Ajustes de personalidade. Sem personalidade (ou desconhecida) = perfil neutro. */
export const PERSONALITY_MODS: Record<string, AttrMods> = {
  Líder: { pass: 2, defend: 2, stamina: 2, volatility: -0.1 },
  Veterano: { pass: 4, shoot: 2, defend: 2, speed: -4, stamina: -4, vision: 4, volatility: -0.15 },
  Promessa: { speed: 3, dribble: 4, pass: -2, volatility: 0.15 },
  Temperamental: { shoot: 2, defend: 2, aggression: 0.3, volatility: 0.25 },
  Vaidoso: { dribble: 4, shoot: 3, pass: -4, selfish: 0.35 },
  Ambicioso: { speed: 1, shoot: 1, stamina: 4, selfish: 0.1 },
  Reservado: { pass: 2, dribble: -2, selfish: -0.15 },
  Disciplinado: { defend: 4, pass: 2, stamina: 2, volatility: -0.2, aggression: -0.1 },
};

/** Quanto a característica pesa nos atributos (1 = valores da tabela). Alto o bastante para o perfil ser visível no jogo. */
const TRAIT_SCALE = 1.7;
/** Idem para as tendências de comportamento. */
const BIAS_SCALE = 1.4;

/** Moral neutra (sem bônus nem penalidade). */
const NEUTRAL_MORALE = 60;
/** Teto do efeito da moral, em pontos de atributo. */
const MORALE_RANGE = 5;
/** Perda máxima por jogar improvisado numa função que não é a sua. */
const OUT_OF_POSITION_PENALTY = 14;

function clampAttr(n: number): number {
  return Math.max(25, Math.min(99, n));
}

/** Pontos de atributo (−5 a +5) vindos da moral: acima de 60 ajuda, abaixo atrapalha. */
export function moraleBonus(morale: number | undefined): number {
  if (morale === undefined || !Number.isFinite(morale)) return 0;
  const norm = Math.max(-1, Math.min(1, (morale - NEUTRAL_MORALE) / 40));
  return norm * MORALE_RANGE;
}

export interface Derived {
  attrs: Attrs;
  biases: Biases;
}

/**
 * Atributos de jogo: `overall` como base → perfil da posição → improviso (fora de função) →
 * moral → personalidade → característica → ruído fixo por jogador (mesmo atleta, mesmo perfil).
 */
export function deriveAttrs(input: EnginePlayerInput, scale: number): Derived {
  const { id, position, overall } = input;
  const b = POSITION_BONUS[position] ?? POSITION_BONUS.CM;
  const pers = (input.personality ? PERSONALITY_MODS[input.personality] : undefined) ?? {};
  const trait = findTrait(input.trait, position);
  const t: AttrMods = trait?.attr ?? {};
  const noise = (salt: number) => (hashUnit(id, salt) - 0.5) * 8;

  const fit = input.fit === undefined ? 1 : Math.max(0, Math.min(1, input.fit));
  const base = overall - (1 - fit) * OUT_OF_POSITION_PENALTY + moraleBonus(input.morale);
  const isGk = position === 'GK';

  const mod = (key: keyof AttrMods) => (pers[key] ?? 0) + (t[key] ?? 0) * TRAIT_SCALE;
  const pick = (value: number, key: keyof AttrMods, salt: number) => clampAttr(value + mod(key) + noise(salt));

  const speedAttr = pick(base + b.speed, 'speed', 1);
  const speedFrac = (speedAttr - 25) / 74;
  const speed = (TUNING.speedMin + speedFrac * (TUNING.speedMax - TUNING.speedMin)) * Math.sqrt(scale);

  const attrs: Attrs = {
    speed,
    pass: pick(base + b.pass, 'pass', 2),
    shoot: pick(base + b.shoot, 'shoot', 3),
    defend: pick(base + b.defend, 'defend', 4),
    dribble: pick(base + b.dribble, 'dribble', 5),
    gk: isGk ? pick(base, 'reflex', 6) : clampAttr(base - 40),
    stamina: pick(base + b.stamina, 'stamina', 7),
    aerial: pick(base + b.aerial, 'aerial', 8),
    strength: pick(base + b.strength, 'strength', 9),
    vision: pick(base + b.vision, 'vision', 10),
    crossing: pick(base + b.crossing, 'crossing', 11),
    workRate: pick(base + b.workRate, 'workRate', 12),
    handling: isGk ? pick(base, 'handling', 13) : clampAttr(base - 40),
    sweeping: isGk ? pick(base, 'sweeping', 14) : 25,
    distribution: isGk ? pick(base, 'distribution', 15) : pick(base + b.pass, 'pass', 2),
    penaltySave: isGk ? pick(base, 'penaltySave', 16) : 25,
    aggression: Math.max(0, Math.min(1, 0.5 + mod('aggression'))),
    volatility: Math.max(0.6, 1 + mod('volatility')),
    selfish: Math.max(0, Math.min(1, 0.4 + mod('selfish'))),
  };

  const biases: Biases = { ...NEUTRAL_BIASES };
  for (const key of Object.keys(trait?.bias ?? {}) as (keyof Biases)[]) {
    biases[key] = Math.max(-1.2, Math.min(1.2, (trait?.bias[key] ?? 0) * BIAS_SCALE));
  }
  // Personalidade também empurra o comportamento (egoísta chuta mais, reservado toca mais)
  biases.shoot += (attrs.selfish - 0.4) * 0.8;
  return { attrs, biases };
}

export function roleGroup(role: SlotRole): RoleGroup {
  switch (role) {
    case 'GOL':
      return 'GK';
    case 'ZAG':
    case 'LE':
    case 'LD':
      return 'DEF';
    case 'PE':
    case 'PD':
    case 'SA':
    case 'ATA':
      return 'ATT';
    default:
      return 'MID';
  }
}
