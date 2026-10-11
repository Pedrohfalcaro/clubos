/**
 * Uniformes do clube. São independentes das cores do clube (primária/secundária, usadas no tema
 * e no escudo): cada uniforme tem cor base + um desenho (liso, modelo pronto ou desenho livre).
 */

export type KitPatternId =
  | 'vstripes'
  | 'hoops'
  | 'pinstripes'
  | 'sash'
  | 'diagstripes'
  | 'halves'
  | 'quarters'
  | 'checkers'
  | 'chevron'
  | 'sleeves'
  | 'band'
  | 'gradient';

export type KitDesign =
  | { type: 'solid' }
  | { type: 'preset'; pattern: KitPatternId; color2: string }
  /** Desenho livre salvo como imagem (PNG em data URL, quadrada). */
  | { type: 'custom'; image: string };

export interface Kit {
  id: string;
  /** Cor base: preenche o uniforme e é a cor "oficial" usada em fichas, placares e chips. */
  base: string;
  design: KitDesign;
  /** Cor do número da camisa; ausente = automática (contraste com a cor base). */
  numberColor?: string;
}

export const KIT_PATTERNS: { id: KitPatternId; label: string }[] = [
  { id: 'vstripes', label: 'Listras verticais' },
  { id: 'hoops', label: 'Listras horizontais' },
  { id: 'pinstripes', label: 'Listras finas' },
  { id: 'sash', label: 'Faixa diagonal' },
  { id: 'diagstripes', label: 'Listras diagonais' },
  { id: 'halves', label: 'Metades' },
  { id: 'quarters', label: 'Quartos' },
  { id: 'checkers', label: 'Xadrez' },
  { id: 'chevron', label: 'Chevron (V)' },
  { id: 'sleeves', label: 'Mangas' },
  { id: 'band', label: 'Faixa no peito' },
  { id: 'gradient', label: 'Degradê' },
];

export const MAX_KITS = 3;

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** Cor do número da camisa: a escolhida no editor ou, se não houver, preto/branco pelo contraste com a base. */
export function kitNumberColor(kit: Kit): string {
  if (kit.numberColor && HEX6.test(kit.numberColor)) return kit.numberColor;
  const m = /^#?([0-9a-f]{6})$/i.exec(kit.base.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#111111' : '#ffffff';
}

/** Contorno que mantém o número legível sobre qualquer desenho (claro sobre número escuro e vice-versa). */
export function numberOutline(numberColor: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(numberColor.trim());
  if (!m) return 'rgba(0,0,0,0.75)';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.55 ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.85)';
}

/** Uniforme de uma partida: mandante/neutro usa o 1º, visitante o 2º. */
export function kitForLocation(kits: Kit[], location: 'home' | 'away' | 'neutral' | undefined): Kit {
  return location === 'away' ? kits[1] ?? kits[0] : kits[0];
}

function newKitId(): string {
  return `kit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createSolidKit(base: string): Kit {
  return { id: newKitId(), base, design: { type: 'solid' } };
}

/** Uniformes padrão de um clube sem uniformes editados: 1 = cor primária, 2 = cor secundária. */
export function defaultKits(primary: string, secondary: string): Kit[] {
  return [
    { id: 'kit-1', base: primary, design: { type: 'solid' } },
    { id: 'kit-2', base: secondary, design: { type: 'solid' } },
  ];
}

interface KitSource {
  kits?: Kit[];
  primaryColor?: string;
  secondaryColor?: string;
}

/** Lista final de uniformes (sempre com pelo menos 2): usa os editados e completa com os padrão. */
export function resolveKits(team: KitSource | null | undefined, fallbackPrimary = '#7c3aed', fallbackSecondary = '#e2e8f0'): Kit[] {
  const defaults = defaultKits(team?.primaryColor ?? fallbackPrimary, team?.secondaryColor ?? fallbackSecondary);
  const saved = (team?.kits ?? []).filter(k => k && k.base).slice(0, MAX_KITS);
  if (saved.length >= 2) return saved;
  if (saved.length === 1) return [saved[0], defaults[1]];
  return defaults;
}

/** Cor de destaque do uniforme (a secundária do modelo pronto; a base nos demais). */
export function kitAccent(kit: Kit): string {
  return kit.design.type === 'preset' ? kit.design.color2 : kit.base;
}
