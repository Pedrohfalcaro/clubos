import type { PlayerPosition, PlayerStats } from './Player';

export type CareerPlayerStatus = 'Titular' | 'Reserva' | 'Promessa' | 'Em recuperação';
export type PreferredFoot = 'Direito' | 'Esquerdo' | 'Ambidestro';

export interface ClubInfo {
  name: string;
  league: string;
  country: string;
}

export interface ClubHistoryEntry {
  clubName: string;
  league: string;
  country: string;
  seasonStart: number;
  seasonEnd: number | null;
  stats: PlayerStats;
}

export interface OverallHistoryEntry {
  season: number;
  overall: number;
}

export interface InjuryEntry {
  id: string;
  type: string;
  startDate: string;
  returnDate?: string;
  notes?: string;
}

export interface CareerPlayer {
  id: string;
  name: string;
  nationality: string;
  age: number;
  position: PlayerPosition;
  number: number | null;
  height?: string;
  preferredFoot?: PreferredFoot;

  overall: number;
  potential: number;

  currentClub: ClubInfo;
  status: CareerPlayerStatus;
  salary: number;
  contractYearsLeft: number;
  coachConfidence: number;
  fanReputation: number;

  marketValue: number;
  morale: number;

  stats: PlayerStats;
  seasonStats: PlayerStats;

  careerHistory: ClubHistoryEntry[];
  overallHistory: OverallHistoryEntry[];
  injuries: InjuryEntry[];
}

export function emptyPlayerStats(): PlayerStats {
  return { matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
}

export function createDefaultCareerPlayer(
  partial: Pick<CareerPlayer, 'name' | 'nationality' | 'age' | 'position' | 'overall' | 'potential'> &
    Partial<Pick<CareerPlayer, 'number' | 'height' | 'preferredFoot'>>,
): CareerPlayer {
  return {
    id: `player-${Date.now()}`,
    number: partial.number ?? null,
    height: partial.height,
    preferredFoot: partial.preferredFoot,
    name: partial.name,
    nationality: partial.nationality,
    age: partial.age,
    position: partial.position,
    overall: partial.overall,
    potential: partial.potential,
    currentClub: { name: '', league: '', country: '' },
    status: 'Reserva',
    salary: 0,
    contractYearsLeft: 0,
    coachConfidence: 50,
    fanReputation: 50,
    marketValue: partial.overall * 100_000,
    morale: 70,
    stats: emptyPlayerStats(),
    seasonStats: emptyPlayerStats(),
    careerHistory: [],
    overallHistory: [{ season: 2025, overall: partial.overall }],
    injuries: [],
  };
}
