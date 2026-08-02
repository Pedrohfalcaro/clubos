import type { Match } from '../types/Match';
import type { SeasonCompetition, StandingsEntry } from '../types/Competition';
import type { TeamAchievement } from '../types/Achievement';
import type { ManagerAward } from '../types/Manager';
import { uid } from './matchEvents';

function emptyEntry(teamName: string): StandingsEntry {
  return {
    teamName,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

function applyResult(
  entry: StandingsEntry,
  goalsFor: number,
  goalsAgainst: number,
  result: 'win' | 'draw' | 'loss',
) {
  entry.matches += 1;
  entry.goalsFor += goalsFor;
  entry.goalsAgainst += goalsAgainst;
  if (result === 'win') {
    entry.wins += 1;
    entry.points += 3;
  } else if (result === 'draw') {
    entry.draws += 1;
    entry.points += 1;
  } else {
    entry.losses += 1;
  }
  entry.goalDifference = entry.goalsFor - entry.goalsAgainst;
}

/** Classificação relativa a partir dos jogos disputados na competição. */
export function buildCompetitionStandings(
  teamName: string,
  matches: Match[],
  competitionName: string,
  season?: number,
): StandingsEntry[] {
  const relevant = matches.filter(
    m =>
      m.status === 'completed' &&
      m.competition === competitionName &&
      (season == null || m.season == null || m.season === season),
  );
  if (!relevant.length) return [];

  const map = new Map<string, StandingsEntry>();
  map.set(teamName, emptyEntry(teamName));

  for (const m of relevant) {
    const us = map.get(teamName)!;
    const oppName = m.opponent;
    if (!map.has(oppName)) map.set(oppName, emptyEntry(oppName));
    const opp = map.get(oppName)!;

    const ourResult = m.result ?? 'draw';
    applyResult(us, m.goalsFor, m.goalsAgainst, ourResult);
    const oppResult =
      ourResult === 'win' ? 'loss' : ourResult === 'loss' ? 'win' : 'draw';
    applyResult(opp, m.goalsAgainst, m.goalsFor, oppResult);
  }

  return [...map.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor,
  );
}

export function computeSeasonClosingAchievements(input: {
  teamName: string;
  season: number;
  matches: Match[];
  competitions: SeasonCompetition[];
  existing?: TeamAchievement[];
}): { achievements: TeamAchievement[]; newTitles: TeamAchievement[]; managerAwards: ManagerAward[] } {
  const awardedAt = new Date().toISOString().slice(0, 10);
  const existing = input.existing ?? [];
  const alreadyKey = new Set(
    existing.map(a => `${a.season}|${a.competition}|${a.position}`),
  );

  const fresh: TeamAchievement[] = [];
  const managerAwards: ManagerAward[] = [];

  for (const comp of input.competitions) {
    if (comp.type === 'friendly') continue;
    const table = buildCompetitionStandings(
      input.teamName,
      input.matches,
      comp.name,
      input.season,
    );
    if (!table.length) continue;
    const idx = table.findIndex(e => e.teamName === input.teamName);
    if (idx < 0) continue;
    const position = idx + 1;
    const key = `${input.season}|${comp.name}|${position}`;
    if (alreadyKey.has(key)) continue;

    const isTitle = position === 1;
    const ach: TeamAchievement = {
      id: uid(),
      competition: comp.name,
      season: input.season,
      position,
      isTitle,
      note: isTitle
        ? 'Campeão'
        : position <= 3
          ? `${position}º lugar`
          : `Classificação: ${position}º`,
      awardedAt,
    };
    fresh.push(ach);

    if (isTitle && (comp.type === 'league' || comp.type === 'state' || comp.type === 'continental')) {
      managerAwards.push({
        id: uid(),
        title: 'Melhor Técnico',
        season: input.season,
        competition: comp.name,
        date: awardedAt,
      });
    }
  }

  return {
    achievements: [...existing, ...fresh],
    newTitles: fresh.filter(a => a.isTitle),
    managerAwards,
  };
}
