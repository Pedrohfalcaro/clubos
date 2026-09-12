import type { Player, PlayerStats } from '../types/Player';
import type { Team } from '../types/Team';
import type { Match } from '../types/Match';
import { calcPlayerAverageRating } from './matchStats';

export interface SquadExportPlayer {
  name: string;
  position: Player['position'];
  number: number | null;
  age: number;
  nationality?: string;
  overall: number;
  potential: number;
  personality?: string;
  status: Player['status'];
  morale: number;
  salary: number;
  marketValue: number;
  contractYearsLeft?: number;
  seasonStats: PlayerStats & { averageRating: number | null };
  careerStats?: PlayerStats;
}

export interface SquadExportJson {
  _docs: string;
  club: { name: string; country: string };
  season: number;
  exportedAt: string;
  players: SquadExportPlayer[];
}

/** Snapshot completo do elenco da temporada — nome/atributos/contrato + stats e nota média do momento. */
export function buildSquadExport(
  team: Team,
  players: Player[],
  matches: Match[],
  season: number,
  currentDate: string | null,
): SquadExportJson {
  const seasonMatches = matches.filter(
    m => m.status === 'completed' && (m.season ?? season) === season,
  );

  const exportedPlayers: SquadExportPlayer[] = players.map(p => ({
    name: p.name,
    position: p.position,
    number: p.number,
    age: p.age,
    nationality: p.nationality,
    overall: p.overall,
    potential: p.potential,
    personality: p.personality,
    status: p.status,
    morale: p.morale,
    salary: p.salary,
    marketValue: p.marketValue,
    contractYearsLeft: p.contractYearsLeft,
    seasonStats: {
      ...p.stats,
      averageRating: calcPlayerAverageRating(p.id, seasonMatches),
    },
    careerStats: p.careerStats,
  }));

  return {
    _docs: 'Snapshot do elenco gerado pelo ClubOS — seasonStats/averageRating são só da temporada atual; careerStats é o total acumulado da carreira até aqui.',
    club: { name: team.name, country: team.country },
    season,
    exportedAt: currentDate ?? new Date().toISOString().slice(0, 10),
    players: exportedPlayers,
  };
}

export function downloadSquadExport(data: SquadExportJson) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clubos-elenco-temporada-${data.season}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
