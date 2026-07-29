import type { Player, PlayerStats } from '../types/Player';
import { emptyPlayerStats } from '../types/Player';
import type { SeasonArchive } from '../types/SeasonHistory';
import { sumPlayerStats, sumTeamStats, emptyTeamStats } from '../types/SeasonHistory';
import type { TeamStatistics } from '../types/Team';
import type { Match } from '../types/Match';
import type { ClubFinance } from '../types/Finance';
import type { TransferRecord } from '../types/Transfer';

export type HistoryScope = 'current' | 'total' | number; // number = closed season year

export function playerCareerTotal(p: Player): PlayerStats {
  return sumPlayerStats([p.careerStats ?? emptyPlayerStats(), p.stats]);
}

export function playerStatsForScope(
  p: Player,
  scope: HistoryScope,
  seasonHistory: SeasonArchive[],
  currentSeason: number,
): PlayerStats {
  if (scope === 'current' || scope === currentSeason) return p.stats;
  if (scope === 'total') return playerCareerTotal(p);
  const arch = seasonHistory.find(s => s.season === scope);
  const snap = arch?.players.find(x => x.playerId === p.id);
  return snap?.stats ?? emptyPlayerStats();
}

export function teamStatsForScope(
  current: TeamStatistics | undefined,
  scope: HistoryScope,
  seasonHistory: SeasonArchive[],
  currentSeason: number,
): TeamStatistics {
  if (!current) return emptyTeamStats();
  if (scope === 'current' || scope === currentSeason) return current;
  if (scope === 'total') {
    return sumTeamStats([...seasonHistory.map(s => s.teamStats), current]);
  }
  return seasonHistory.find(s => s.season === scope)?.teamStats ?? emptyTeamStats();
}

export function matchesForScope(
  matches: Match[],
  scope: HistoryScope,
  currentSeason: number,
): Match[] {
  const completed = matches.filter(m => m.status === 'completed');
  if (scope === 'total') return completed;
  const season = scope === 'current' ? currentSeason : scope;
  return completed.filter(m => (m.season ?? currentSeason) === season);
}

export function financeForScope(
  finance: ClubFinance,
  scope: HistoryScope,
  seasonHistory: SeasonArchive[],
  currentSeason: number,
): { income: number; expense: number; balance?: number } {
  if (scope === 'current' || scope === currentSeason) {
    const income = finance.ledger.filter(e => e.season === currentSeason && e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const expense = finance.ledger.filter(e => e.season === currentSeason && e.amount < 0).reduce((s, e) => s + e.amount, 0);
    return { income, expense, balance: finance.balance };
  }
  if (scope === 'total') {
    const income = finance.ledger.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const expense = finance.ledger.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0);
    return { income, expense, balance: finance.balance };
  }
  const arch = seasonHistory.find(s => s.season === scope);
  return {
    income: arch?.income ?? 0,
    expense: arch?.expense ?? 0,
    balance: arch?.balance,
  };
}

export function transfersForScope(
  history: TransferRecord[],
  scope: HistoryScope,
  currentSeason: number,
): TransferRecord[] {
  if (scope === 'total') return history;
  const season = scope === 'current' ? currentSeason : scope;
  return history.filter(t => t.season === season);
}

export function ledgerForScope(
  ledger: ClubFinance['ledger'],
  scope: HistoryScope,
  currentSeason: number,
): ClubFinance['ledger'] {
  if (scope === 'total') return ledger;
  const season = scope === 'current' ? currentSeason : scope;
  return ledger.filter(e => e.season === season);
}

export function scopeOptions(
  currentSeason: number,
  seasonHistory: SeasonArchive[],
): { value: HistoryScope; label: string }[] {
  const closed = [...seasonHistory].sort((a, b) => b.season - a.season);
  return [
    { value: 'current', label: `Atual (${currentSeason})` },
    ...closed.map(s => ({ value: s.season as HistoryScope, label: `Temporada ${s.season}` })),
    { value: 'total', label: 'Total da carreira' },
  ];
}
