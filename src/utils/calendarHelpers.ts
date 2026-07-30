import type { Match, MatchLocation, MatchResult } from '../types/Match';
import type { SeasonCompetition } from '../types/Competition';
import { findCompetition } from './competitions';
import { locationLabel } from './matchStats';

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

export function shortLocation(location: MatchLocation): string {
  if (location === 'home') return 'Casa';
  if (location === 'away') return 'Fora';
  return 'Neutro';
}

export function competitionLabel(
  comps: SeasonCompetition[],
  competitionName: string,
): string {
  const found = findCompetition(comps, competitionName);
  return found?.shortName || found?.name || competitionName;
}

/** Mês inicial: primeiro jogo ainda não jogado; senão, último já disputado. */
export function getInitialCalendarDate(matches: Match[]): Date {
  const scheduled = matches
    .filter(m => m.status === 'scheduled')
    .sort((a, b) => a.date.localeCompare(b.date));
  const completed = matches
    .filter(m => m.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date));

  const anchor = scheduled[0]?.date ?? completed[completed.length - 1]?.date;
  if (!anchor) return new Date();

  const [y, m] = anchor.split('-').map(Number);
  if (!y || !m) return new Date();
  return new Date(y, m - 1, 1);
}

const RESULT_LABEL: Record<MatchResult, string> = {
  win: 'Vitória',
  draw: 'Empate',
  loss: 'Derrota',
};

export function resultLabel(result: MatchResult | null | undefined): string {
  if (!result) return '';
  return RESULT_LABEL[result];
}

export function formatMatchDayTitle(m: Match): string {
  const base = `${m.opponent} · ${m.competition} · ${locationLabel(m.location)}`;
  if (m.status !== 'completed') return base;
  const score = `${m.goalsFor}×${m.goalsAgainst}`;
  const res = m.result ? RESULT_LABEL[m.result] : 'Realizada';
  return `${base} · ${score} · ${res}`;
}
