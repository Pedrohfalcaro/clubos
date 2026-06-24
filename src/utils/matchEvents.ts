import type { MatchMinute } from '../types/Match';

export const STOPPAGE_BASES = [45, 90, 105, 120] as const;

export function minuteSortValue(m: MatchMinute): number {
  return m.base * 100 + (m.stoppage ?? 0);
}

export function formatMinute(m: MatchMinute): string {
  if (m.stoppage && m.stoppage > 0) return `${m.base}+${m.stoppage}'`;
  return `${m.base}'`;
}

export function defaultMinute(): MatchMinute {
  return { base: 1 };
}

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ratingColor(rating: number | null): string {
  if (rating === null) return 'var(--border)';
  if (rating <= 5.9) return '#7f1d1d';
  if (rating <= 6.4) return '#c2410c';
  if (rating <= 6.9) return '#ca8a04';
  if (rating <= 7.9) return '#16a34a';
  if (rating <= 8.9) return '#38bdf8';
  if (rating <= 9.9) return '#1d4ed8';
  return '#ec4899';
}

export const RATING_OPTIONS: number[] = [];
for (let i = 5; i <= 100; i++) {
  RATING_OPTIONS.push(i / 10);
}

export const POSITION_ORDER = ['GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'CF', 'ST'];

export const POSITION_LABELS: Record<string, string> = {
  GK: 'GOL',
  CB: 'ZAG',
  RB: 'LD',
  LB: 'LE',
  CDM: 'VOL',
  CM: 'MC',
  CAM: 'MEI',
  RW: 'PD',
  LW: 'PE',
  CF: 'CA',
  ST: 'ATA',
};
