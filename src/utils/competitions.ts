import type { CompetitionType, SeasonCompetition } from '../types/Competition';
import { DEFAULT_COMPETITION_COLORS } from '../types/Competition';
import { getCompetitionCategory } from './calendarHelpers';

export const AVAILABLE_COMPETITIONS = [
  'Campeonato Brasileiro',
  'Copa do Brasil',
  'Libertadores',
  'Sul-Americana',
  'Estadual',
  'Amistoso',
] as const;

export const COMPETITION_PALETTE = [
  '#3b82f6',
  '#22c55e',
  '#f97316',
  '#a855f7',
  '#ef4444',
  '#06b6d4',
  '#eab308',
  '#ec4899',
  '#64748b',
  '#14b8a6',
];

function slugId(name: string): string {
  return `comp-${name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}-${Math.random().toString(36).slice(2, 6)}`;
}

export function inferCompetitionType(name: string): CompetitionType {
  const cat = getCompetitionCategory(name);
  if (cat === 'national') return 'league';
  if (cat === 'national_cup') return 'cup';
  if (cat === 'continental') return 'continental';
  if (cat === 'state') return 'state';
  if (cat === 'friendly') return 'friendly';
  return 'other';
}

export function createSeasonCompetition(
  name: string,
  overrides?: Partial<Omit<SeasonCompetition, 'id' | 'name'>> & { id?: string },
): SeasonCompetition {
  const trimmed = name.trim();
  const type = overrides?.type ?? inferCompetitionType(trimmed);
  return {
    id: overrides?.id ?? slugId(trimmed),
    name: trimmed,
    color: overrides?.color ?? DEFAULT_COMPETITION_COLORS[type],
    shortName: overrides?.shortName,
    type,
  };
}

/** Converte saves antigos (string[]) ou mistos para SeasonCompetition[]. */
export function migrateSeasonCompetitions(
  raw: unknown,
): SeasonCompetition[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const result: SeasonCompetition[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (typeof item === 'string') {
      const name = item.trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      result.push(createSeasonCompetition(name));
      continue;
    }
    if (item && typeof item === 'object' && 'name' in item) {
      const obj = item as Partial<SeasonCompetition>;
      const name = String(obj.name ?? '').trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      const type = obj.type ?? inferCompetitionType(name);
      result.push({
        id: obj.id ?? slugId(name),
        name,
        color: obj.color ?? DEFAULT_COMPETITION_COLORS[type],
        shortName: obj.shortName,
        type,
      });
    }
  }

  return result;
}

export function competitionNames(comps: SeasonCompetition[]): string[] {
  return comps.map(c => c.name);
}

export function findCompetition(
  comps: SeasonCompetition[],
  nameOrId: string,
): SeasonCompetition | undefined {
  const key = nameOrId.trim().toLowerCase();
  return comps.find(c => c.name.toLowerCase() === key || c.id === nameOrId);
}

export function resolveCompetitionColor(
  comps: SeasonCompetition[],
  competitionName: string,
): string {
  const found = findCompetition(comps, competitionName);
  if (found) return found.color;
  const type = inferCompetitionType(competitionName);
  return DEFAULT_COMPETITION_COLORS[type];
}

export function competitionsFromNames(names: string[]): SeasonCompetition[] {
  return migrateSeasonCompetitions(names);
}
