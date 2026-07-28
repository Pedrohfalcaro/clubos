import type { Player, PlayerPosition } from '../types/Player';
import { emptyPlayerStats } from '../types/Player';
import type { Team } from '../types/Team';
import { randomPersonality } from '../pulse/athletes';
import { uid } from '../pulse/utils';
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY } from './clubColors';

const EXAMPLE_ROSTER: Array<{ name: string; position: PlayerPosition; age: number; overall: number; number: number }> = [
  { name: 'Carlos Mendes', position: 'GK', age: 31, overall: 74, number: 1 },
  { name: 'Rafael Costa', position: 'CB', age: 28, overall: 76, number: 3 },
  { name: 'Bruno Silva', position: 'CB', age: 24, overall: 72, number: 4 },
  { name: 'Diego Alves', position: 'LB', age: 22, overall: 70, number: 6 },
  { name: 'Lucas Ferreira', position: 'RB', age: 26, overall: 73, number: 2 },
  { name: 'André Souza', position: 'CDM', age: 29, overall: 75, number: 5 },
  { name: 'Pedro Nunes', position: 'CM', age: 21, overall: 71, number: 8 },
  { name: 'Thiago Rocha', position: 'CAM', age: 20, overall: 69, number: 10 },
  { name: 'Felipe Santos', position: 'CM', age: 25, overall: 72, number: 14 },
  { name: 'Gabriel Lima', position: 'LW', age: 19, overall: 68, number: 11 },
  { name: 'Matheus Oliveira', position: 'RW', age: 23, overall: 73, number: 7 },
  { name: 'João Pedro', position: 'ST', age: 27, overall: 77, number: 9 },
  { name: 'Igor Martins', position: 'ST', age: 18, overall: 65, number: 19 },
  { name: 'Henrique Dias', position: 'CDM', age: 33, overall: 74, number: 15 },
  { name: 'Caio Barbosa', position: 'CM', age: 30, overall: 73, number: 16 },
];

export function createPlayerDraft(
  teamId: string,
  data: {
    name: string;
    position: PlayerPosition;
    age: number;
    overall?: number;
    potential?: number;
    number?: number | null;
    status?: Player['status'];
    salary?: number;
    marketValue?: number;
    personality?: string;
  },
): Player {
  const overall = data.overall ?? 70;
  return {
    id: uid('atl'),
    teamId,
    name: data.name.trim(),
    position: data.position,
    number: data.number ?? null,
    age: data.age,
    overall,
    potential: data.potential ?? Math.min(99, overall + 5),
    morale: 75,
    salary: data.salary ?? Math.round(overall * 8000),
    marketValue: data.marketValue ?? Math.round(overall * 150000),
    status: data.status ?? 'Titular',
    stats: emptyPlayerStats(),
    personality: data.personality ?? randomPersonality(),
    fatigue: 0,
    availability: 'disponivel',
  };
}

export function createExampleSquad(teamId: string): Player[] {
  return EXAMPLE_ROSTER.map((p, i) =>
    createPlayerDraft(teamId, {
      ...p,
      status: i < 11 ? 'Titular' : i < 13 ? 'Reserva' : 'Promessa',
      potential: Math.min(99, p.overall + (p.age <= 21 ? 10 : 4)),
    }),
  );
}

export function createBlankTeam(
  name: string,
  country: string,
  colors?: { primaryColor?: string; secondaryColor?: string },
): Team {
  const id = uid('club');
  const trimmed = name.trim();
  return {
    id,
    name: trimmed,
    nickname: trimmed.split(' ')[0] || trimmed,
    country: country.trim() || 'Brasil',
    budget: 5_000_000,
    fans: 50_000,
    boardConfidence: 70,
    supporterConfidence: 65,
    primaryColor: colors?.primaryColor ?? DEFAULT_PRIMARY,
    secondaryColor: colors?.secondaryColor ?? DEFAULT_SECONDARY,
    statistics: {
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    },
  };
}
