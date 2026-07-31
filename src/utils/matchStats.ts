import type { Match } from '../types/Match';
import type { Player } from '../types/Player';
import type { Team, TeamStatistics } from '../types/Team';
import { getMatchPlayingTime } from './playingTime';

export function calcResult(goalsFor: number, goalsAgainst: number): 'win' | 'draw' | 'loss' {
  if (goalsFor > goalsAgainst) return 'win';
  if (goalsFor === goalsAgainst) return 'draw';
  return 'loss';
}

export function emptyTeamStatistics(): TeamStatistics {
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

export function recalculateFromMatches(
  team: Team,
  players: Player[],
  matches: Match[],
): { team: Team; players: Player[] } {
  const completed = matches.filter(m => m.status === 'completed');
  const statistics = emptyTeamStatistics();

  const playerStatsMap = new Map(
    players.map(p => [
      p.id,
      {
        matches: 0,
        minutes: 0,
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        yellowCards: 0,
        redCards: 0,
      },
    ]),
  );

  for (const match of completed) {
    const isWin = match.result === 'win';
    const isDraw = match.result === 'draw';
    statistics.matches += 1;
    statistics.goalsFor += match.goalsFor;
    statistics.goalsAgainst += match.goalsAgainst;
    if (isWin) {
      statistics.wins += 1;
      statistics.points += 3;
    } else if (isDraw) {
      statistics.draws += 1;
      statistics.points += 1;
    } else {
      statistics.losses += 1;
    }

    const playingTime = getMatchPlayingTime(match);
    const cleanSheet = match.goalsAgainst === 0;
    for (const [pid, mins] of playingTime) {
      const stats = playerStatsMap.get(pid);
      if (!stats) continue;
      stats.matches += 1;
      stats.minutes += mins;
      if (cleanSheet && mins > 0) stats.cleanSheets += 1;
    }

    for (const goal of match.goals.filter(g => !g.isOwnGoal && g.playerId)) {
      const stats = playerStatsMap.get(goal.playerId);
      if (stats) stats.goals += 1;
    }

    for (const assist of match.assists) {
      const stats = playerStatsMap.get(assist.playerId);
      if (stats) stats.assists += 1;
    }

    for (const card of match.cards) {
      const stats = playerStatsMap.get(card.playerId);
      if (!stats) continue;
      if (card.type === 'yellow') stats.yellowCards += 1;
      if (card.type === 'red') stats.redCards += 1;
    }
  }

  return {
    team: { ...team, statistics },
    players: players.map(p => ({
      ...p,
      stats: playerStatsMap.get(p.id) ?? {
        ...p.stats,
        minutes: p.stats.minutes ?? 0,
      },
    })),
  };
}

export function getHomeAway(
  teamName: string,
  match: Match,
): { homeTeam: string; awayTeam: string; homeGoals: number; awayGoals: number } {
  if (match.location === 'home') {
    return {
      homeTeam: teamName,
      awayTeam: match.opponent,
      homeGoals: match.goalsFor,
      awayGoals: match.goalsAgainst,
    };
  }
  if (match.location === 'away') {
    return {
      homeTeam: match.opponent,
      awayTeam: teamName,
      homeGoals: match.goalsAgainst,
      awayGoals: match.goalsFor,
    };
  }
  return {
    homeTeam: teamName,
    awayTeam: match.opponent,
    homeGoals: match.goalsFor,
    awayGoals: match.goalsAgainst,
  };
}

export function locationLabel(location: Match['location']): string {
  if (location === 'home') return 'Em Casa';
  if (location === 'away') return 'Fora';
  return 'Neutro';
}

/** Average match rating for a player across completed matches where they played. */
export function calcPlayerAverageRating(
  playerId: string,
  matches: Match[],
  competition?: string,
): number | null {
  const ratings: number[] = [];
  for (const match of matches) {
    if (match.status !== 'completed') continue;
    if (competition && match.competition !== competition) continue;
    const played = getMatchPlayingTime(match);
    if (!played.has(playerId)) continue;
    const entry = match.playerRatings?.find(r => r.playerId === playerId);
    if (entry?.rating != null) ratings.push(entry.rating);
  }
  if (ratings.length === 0) return null;
  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}
