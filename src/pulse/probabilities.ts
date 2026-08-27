import type { PulseAthlete, PulseCategory, PulseClub, PulseRarity } from './types';
import { ageBand, pickWeighted } from './utils';

const CATEGORIA_PESOS: Record<Exclude<PulseCategory, 'nenhum'>, number> = {
  atleta: 28,
  diretoria: 14,
  torcida: 14,
  imprensa: 12,
  lesao: 11,
  financeiro: 10,
  familia: 5,
  transferencia: 4,
  patrocinio: 2,
  escandalo: 4,
};

const RARIDADE_PESOS: Record<PulseRarity, number> = {
  comum: 55,
  incomum: 28,
  raro: 13,
  'muito-raro': 4,
};

const PERSONALIDADE_MODS: Record<string, Partial<Record<string, number>>> = {
  Líder: { atleta: 1.2, diretoria: 1.15, torcida: 1.1 },
  Veterano: { familia: 1.3, lesao: 1.2, atleta: 1.1 },
  Promessa: { transferencia: 1.35, imprensa: 1.2, atleta: 1.15 },
  Temperamental: { escandalo: 1.5, imprensa: 1.25, torcida: 1.15 },
  Vaidoso: { imprensa: 1.4, patrocinio: 1.3, escandalo: 1.2 },
  Ambicioso: { transferencia: 1.4, financeiro: 1.2, diretoria: 1.1 },
  Reservado: { familia: 1.2, atleta: 1.1, escandalo: 0.6 },
  Disciplinado: { atleta: 1.2, lesao: 0.85, escandalo: 0.5 },
};

const IDADE_MODS: Record<string, Partial<Record<string, number>>> = {
  jovem: { transferencia: 1.25, atleta: 1.15, familia: 0.8, lesao: 0.9 },
  pico: { transferencia: 1.15, diretoria: 1.1, imprensa: 1.1 },
  veterano: { familia: 1.35, lesao: 1.3, transferencia: 0.7, atleta: 1.1 },
};

const CATEGORIAS_RUINS = new Set(['lesao', 'escandalo', 'imprensa']);
const CATEGORIAS_BOAS = new Set(['atleta', 'patrocinio', 'familia']);

export type ClubClimate = Pick<
  PulseClub,
  'boardConfidence' | 'supporterConfidence' | 'mediaConfidence'
>;

function pesoCategoria(
  categoria: string,
  atletasContexto: PulseAthlete[],
  club?: ClubClimate | null,
): number {
  const base = CATEGORIA_PESOS[categoria as keyof typeof CATEGORIA_PESOS] || 1;
  if (!atletasContexto || atletasContexto.length === 0) {
    return applyClubCategoryMod(base, categoria, club);
  }

  let modSum = 0;
  let moralSum = 0;
  for (const a of atletasContexto) {
    const pMods = PERSONALIDADE_MODS[a.personalidade] || {};
    const band = ageBand(a.idade);
    const iMods = IDADE_MODS[band] || {};
    const m = (pMods[categoria] || 1) * (iMods[categoria] || 1);
    modSum += m;
    moralSum += a.moral ?? 70;
  }
  let weight = base * (modSum / atletasContexto.length);

  const avgMoral = moralSum / atletasContexto.length;
  const t = (avgMoral - 50) / 50;
  if (CATEGORIAS_RUINS.has(categoria)) weight *= Math.max(0.35, 1 - t * 0.55);
  else if (CATEGORIAS_BOAS.has(categoria)) weight *= Math.max(0.45, 1 + t * 0.45);

  // Atacantes em seca → mais torcida/imprensa
  if (categoria === 'torcida' || categoria === 'imprensa') {
    const dry = atletasContexto.filter(a => {
      const pos = String(a.posicao);
      return (
        (pos === 'ATA' || pos === 'PE' || pos === 'PD') &&
        (a.matches ?? 0) >= 8 &&
        (a.goals ?? 0) === 0
      );
    }).length;
    if (dry > 0) weight *= 1 + Math.min(0.9, dry * 0.35);
  }

  // Moral baixa média → mais escândalo / lesão / atleta drama
  if (avgMoral < 45 && (categoria === 'escandalo' || categoria === 'atleta' || categoria === 'lesao')) {
    weight *= 1.25;
  }

  return applyClubCategoryMod(weight, categoria, club);
}

/** Extremos de confiança aumentam a chance da categoria aparecer no Pulse. */
function applyClubCategoryMod(
  weight: number,
  categoria: string,
  club?: ClubClimate | null,
): number {
  if (!club) return weight;
  if (categoria === 'torcida' && club.supporterConfidence != null) {
    const t = Math.abs(club.supporterConfidence - 50) / 50;
    return weight * (1 + t * 0.7);
  }
  if (categoria === 'diretoria' && club.boardConfidence != null) {
    const t = Math.abs(club.boardConfidence - 50) / 50;
    return weight * (1 + t * 0.7);
  }
  // Mídia hostil → bem mais imprensa (e um pouco de escândalo)
  if (club.mediaConfidence != null) {
    const media = club.mediaConfidence;
    if (categoria === 'imprensa') {
      if (media <= 25) return weight * 2.4;
      if (media <= 40) return weight * 1.7;
      if (media >= 70) return weight * 0.75;
    }
    if (categoria === 'escandalo' && media <= 35) {
      return weight * 1.35;
    }
  }
  return weight;
}

export function escolherCategoria(
  atletasContexto: PulseAthlete[],
  recentCategories: string[],
  club?: ClubClimate | null,
): Exclude<PulseCategory, 'nenhum'> {
  const cats = Object.keys(CATEGORIA_PESOS);
  const last3 = (recentCategories || []).slice(-3);
  const sameStreak =
    last3.length === 3 && last3.every(c => c === last3[0]) ? last3[0] : null;

  return pickWeighted(cats, cat => {
    let w = pesoCategoria(cat, atletasContexto, club);
    if (sameStreak && cat === sameStreak) w *= 0.15;
    if (last3[last3.length - 1] === cat) w *= 0.55;
    return w;
  }) as Exclude<PulseCategory, 'nenhum'>;
}

export function escolherRaridade(): PulseRarity {
  const keys = Object.keys(RARIDADE_PESOS) as PulseRarity[];
  return pickWeighted(keys, k => RARIDADE_PESOS[k]) as PulseRarity;
}
