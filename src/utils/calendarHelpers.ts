import type { Match, MatchLocation, MatchResult } from '../types/Match';

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

/** Resultado principal do dia (prioriza jogo completo; senão o primeiro). */
export function dayPrimaryResult(dayMatches: Match[]): MatchResult | null {
  const completed = dayMatches.find(m => m.status === 'completed' && m.result);
  return completed?.result ?? null;
}

export function formatMatchDayTitle(m: Match): string {
  const base = `${m.opponent} · ${m.competition}`;
  if (m.status !== 'completed') return base;
  const score = `${m.goalsFor}×${m.goalsAgainst}`;
  const res = m.result ? RESULT_LABEL[m.result] : 'Realizada';
  return `${base} · ${score} · ${res}`;
}
