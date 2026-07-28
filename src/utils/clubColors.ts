/** Club kit / theme color helpers */

export const DEFAULT_PRIMARY = '#7c3aed';
export const DEFAULT_SECONDARY = '#e2e8f0';

/** Classic GK yellow — avoided when club kits are yellowish */
export const GK_DEFAULT = '#facc15';
const GK_FALLBACKS = ['#16a34a', '#ea580c', '#38bdf8', '#a855f7'] as const;

export function normalizeHex(hex: string, fallback: string): string {
  const h = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`.toLowerCase();
  }
  return fallback;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = normalizeHex(hex, '');
  if (!h) return null;
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(170, 59, 255, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function contrastText(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 160 ? '#111118' : '#ffffff';
}

/** Detect yellow / gold kits that clash with the default GK shirt */
export function isYellowish(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const { r, g, b } = rgb;
  const brightness = (r + g + b) / 3;
  if (brightness < 100) return false;
  return r >= 150 && g >= 120 && b <= 130 && (r + g) / 2 - b >= 50;
}

function colorDistance(a: string, b: string): number {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  if (!A || !B) return 999;
  const dr = A.r - B.r;
  const dg = A.g - B.g;
  const db = A.b - B.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * GK shirt color: yellow by default, but never yellow (or too close)
 * when primary and/or secondary club colors are yellowish.
 */
export function gkShirtColor(
  primary?: string,
  secondary?: string,
): string {
  const colors = [primary, secondary]
    .filter(Boolean)
    .map(c => normalizeHex(c!, c!));

  const yellowConflict = colors.some(isYellowish);
  if (!yellowConflict) return GK_DEFAULT;

  for (const candidate of GK_FALLBACKS) {
    const clashes = colors.some(c => colorDistance(candidate, c) < 95);
    if (!clashes) return candidate;
  }
  return GK_FALLBACKS[0];
}

export function clubThemeVars(primary: string, secondary: string): Record<string, string> {
  const p = normalizeHex(primary, DEFAULT_PRIMARY);
  const s = normalizeHex(secondary, DEFAULT_SECONDARY);
  return {
    '--accent': p,
    '--accent-bg': hexToRgba(p, 0.12),
    '--accent-border': hexToRgba(p, 0.45),
    '--accent-contrast': contrastText(p),
    '--club-primary': p,
    '--club-secondary': s,
    '--club-secondary-contrast': contrastText(s),
  };
}

/** Kit color for pitch tokens: home/neutral = primary, away = secondary */
export function kitColorForLocation(
  location: 'home' | 'away' | 'neutral',
  primary?: string,
  secondary?: string,
): string {
  const p = normalizeHex(primary ?? DEFAULT_PRIMARY, DEFAULT_PRIMARY);
  const s = normalizeHex(secondary ?? DEFAULT_SECONDARY, DEFAULT_SECONDARY);
  return location === 'away' ? s : p;
}
