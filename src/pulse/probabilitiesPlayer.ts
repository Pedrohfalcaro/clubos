import type { PulseAthlete, PulseCategory, PulseClub, PulseRarity } from './types';
import { ageBand, pickWeighted } from './utils';
import { escolherRaridade } from './probabilities';

export type PlayerPulseCategory = Exclude<
  PulseCategory,
  'nenhum' | 'financeiro' | 'patrocinio'
>;

const CATEGORIA_PESOS_PLAYER: Record<PlayerPulseCategory, number> = {
  atleta: 30,
  diretoria: 16,
  torcida: 16,
  imprensa: 14,
  lesao: 10,
  familia: 8,
  transferencia: 5,
  escandalo: 3,
};

const IDADE_MODS: Record<string, Partial<Record<PlayerPulseCategory, number>>> = {
  jovem: { transferencia: 1.3, atleta: 1.1, familia: 0.8, lesao: 0.9 },
  pico: { transferencia: 1.1, diretoria: 1.1, imprensa: 1.1 },
  veterano: { familia: 1.3, lesao: 1.25, transferencia: 0.6, atleta: 1.05 },
};

const CATEGORIAS_RUINS = new Set<PlayerPulseCategory>(['lesao', 'escandalo', 'imprensa']);
const CATEGORIAS_BOAS = new Set<PlayerPulseCategory>(['atleta', 'familia']);

export type PlayerPulseClimate = Pick<PulseClub, 'boardConfidence' | 'supporterConfidence'>;

function isFormDryAttack(atleta: PulseAthlete): boolean {
  const posDry = new Set(['ATA', 'PE', 'PD']);
  if (!posDry.has(String(atleta.posicao))) return false;
  return (atleta.matches ?? 0) >= 8 && (atleta.goals ?? 0) === 0;
}

function pesoCategoriaPlayer(
  categoria: PlayerPulseCategory,
  atleta: PulseAthlete,
  climate?: PlayerPulseClimate | null,
): number {
  const base = CATEGORIA_PESOS_PLAYER[categoria] || 1;
  const band = ageBand(atleta.idade);
  const iMods = IDADE_MODS[band] || {};
  let weight = base * (iMods[categoria] || 1);

  const moral = atleta.moral ?? 70;
  const t = (moral - 50) / 50;
  if (CATEGORIAS_RUINS.has(categoria)) weight *= Math.max(0.35, 1 - t * 0.55);
  else if (CATEGORIAS_BOAS.has(categoria)) weight *= Math.max(0.45, 1 + t * 0.45);

  if ((categoria === 'torcida' || categoria === 'imprensa') && isFormDryAttack(atleta)) {
    weight *= 1.35;
  }

  if (climate) {
    if (categoria === 'torcida' && climate.supporterConfidence != null) {
      weight *= 1 + Math.abs(climate.supporterConfidence - 50) / 50 * 0.7;
    }
    if (categoria === 'diretoria' && climate.boardConfidence != null) {
      weight *= 1 + Math.abs(climate.boardConfidence - 50) / 50 * 0.7;
    }
  }

  return weight;
}

export function escolherCategoriaPlayer(
  atleta: PulseAthlete,
  recentCategories: string[],
  climate?: PlayerPulseClimate | null,
): PlayerPulseCategory {
  const cats = Object.keys(CATEGORIA_PESOS_PLAYER) as PlayerPulseCategory[];
  const last3 = (recentCategories || []).slice(-3);
  const sameStreak =
    last3.length === 3 && last3.every(c => c === last3[0]) ? last3[0] : null;

  return pickWeighted(cats, cat => {
    let w = pesoCategoriaPlayer(cat, atleta, climate);
    if (sameStreak && cat === sameStreak) w *= 0.15;
    if (last3[last3.length - 1] === cat) w *= 0.55;
    return w;
  })!;
}

export function escolherRaridadePlayer(): PulseRarity {
  return escolherRaridade();
}
