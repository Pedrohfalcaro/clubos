import type { MatchLocation } from '../types/Match';

export type CompetitionCategory = 'national' | 'national_cup' | 'continental' | 'state' | 'friendly';

export const COMPETITION_COLORS: Record<CompetitionCategory, string> = {
  national: '#3b82f6',
  national_cup: '#22c55e',
  continental: '#f97316',
  state: '#a855f7',
  friendly: '#9ca3af',
};

export const COMPETITION_LABELS: Record<CompetitionCategory, string> = {
  national: 'Campeonato Nacional',
  national_cup: 'Copa Nacional',
  continental: 'Copa Continental',
  state: 'Campeonato Estadual',
  friendly: 'Amistoso',
};

export function getCompetitionCategory(competition: string): CompetitionCategory {
  const n = competition.toLowerCase();

  if (n.includes('amistoso')) return 'friendly';
  if (n.includes('paulista') || n.includes('estadual') || n.includes('mineiro') || n.includes('carioca') || n.includes('gaúcho')) {
    return 'state';
  }
  if (n.includes('copa do brasil') || (n.includes('copa') && !n.includes('libertadores') && !n.includes('sul-americana'))) {
    return 'national_cup';
  }
  if (n.includes('libertadores') || n.includes('sul-americana') || n.includes('continental') || n.includes('champions')) {
    return 'continental';
  }
  if (n.includes('brasileiro') || n.includes('campeonato nacional')) return 'national';
  if (n.includes('campeonato')) return 'national';

  return 'national';
}

export function getCompetitionColor(competition: string): string {
  return COMPETITION_COLORS[getCompetitionCategory(competition)];
}

export function locationIcon(location: MatchLocation): string {
  if (location === 'home') return '🏠';
  if (location === 'away') return '✈️';
  return '—';
}
