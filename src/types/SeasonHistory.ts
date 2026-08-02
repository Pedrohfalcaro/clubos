import type { TeamStatistics } from './Team';
import type { PlayerStats } from './Player';

export interface SeasonPlayerSnapshot {
  playerId: string;
  name: string;
  position: string;
  age: number;
  overall: number;
  stats: PlayerStats;
}

export interface SeasonArchive {
  season: number;
  closedAt: string;
  teamStats: TeamStatistics;
  boardConfidence: number;
  supporterConfidence: number;
  balance: number;
  income: number;
  expense: number;
  transferCount: number;
  players: SeasonPlayerSnapshot[];
}

export function emptyTeamStats(): TeamStatistics {
  return {
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  };
}

export function sumTeamStats(list: TeamStatistics[]): TeamStatistics {
  return list.reduce(
    (acc, s) => ({
      matches: acc.matches + s.matches,
      wins: acc.wins + s.wins,
      draws: acc.draws + s.draws,
      losses: acc.losses + s.losses,
      goalsFor: acc.goalsFor + s.goalsFor,
      goalsAgainst: acc.goalsAgainst + s.goalsAgainst,
      points: acc.points + s.points,
    }),
    emptyTeamStats(),
  );
}

export function sumPlayerStats(list: PlayerStats[]): PlayerStats {
  return list.reduce(
    (acc, s) => ({
      matches: acc.matches + (s.matches ?? 0),
      minutes: acc.minutes + (s.minutes ?? 0),
      goals: acc.goals + (s.goals ?? 0),
      assists: acc.assists + (s.assists ?? 0),
      cleanSheets: acc.cleanSheets + (s.cleanSheets ?? 0),
      goalsConceded: (acc.goalsConceded ?? 0) + (s.goalsConceded ?? 0),
      yellowCards: acc.yellowCards + (s.yellowCards ?? 0),
      redCards: acc.redCards + (s.redCards ?? 0),
    }),
    {
      matches: 0,
      minutes: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      goalsConceded: 0,
      yellowCards: 0,
      redCards: 0,
    },
  );
}
