import type { PlayerStats } from '../types/Player';
import type { Match } from '../types/Match';
import type { PlayerMatchPerformance } from '../types/PlayerMatchPerformance';
import { emptyPlayerStats } from '../types/CareerPlayer';

export function applyPerformanceToStats(
  stats: PlayerStats,
  perf: PlayerMatchPerformance,
): PlayerStats {
  if (perf.role === 'notCalled') return stats;
  return {
    matches: stats.matches + 1,
    minutes: (stats.minutes ?? 0) + (perf.minutesPlayed ?? 0),
    goals: stats.goals + perf.goals,
    assists: stats.assists + perf.assists,
    cleanSheets: stats.cleanSheets ?? 0,
    yellowCards: stats.yellowCards + perf.yellowCards,
    redCards: stats.redCards + perf.redCards,
  };
}

export function subtractPerformanceFromStats(
  stats: PlayerStats,
  perf: PlayerMatchPerformance,
): PlayerStats {
  if (perf.role === 'notCalled') return stats;
  return {
    matches: Math.max(0, stats.matches - 1),
    minutes: Math.max(0, (stats.minutes ?? 0) - (perf.minutesPlayed ?? 0)),
    goals: Math.max(0, stats.goals - perf.goals),
    assists: Math.max(0, stats.assists - perf.assists),
    cleanSheets: stats.cleanSheets ?? 0,
    yellowCards: Math.max(0, stats.yellowCards - perf.yellowCards),
    redCards: Math.max(0, stats.redCards - perf.redCards),
  };
}

export function calcAverageRating(matches: Match[]): number | null {
  const ratings = matches
    .filter(m => m.status === 'completed' && m.playerPerformance?.rating != null)
    .map(m => m.playerPerformance!.rating!);
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((a, b) => a + b, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

export function recalcPlayerStatsFromMatches(matches: Match[]): {
  stats: PlayerStats;
  seasonStats: PlayerStats;
} {
  const completed = matches.filter(m => m.status === 'completed' && m.playerPerformance);
  let stats = emptyPlayerStats();
  for (const m of completed) {
    stats = applyPerformanceToStats(stats, m.playerPerformance!);
  }
  return { stats, seasonStats: { ...stats } };
}
