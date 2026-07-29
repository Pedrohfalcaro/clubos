export type PlayerStatus = 'Titular' | 'Reserva' | 'Promessa' | 'Transferível' | 'Emprestado';

export type PlayerAvailability = 'disponivel' | 'lesionado' | 'indisponivel';

export type PlayerPosition =
  | 'GK'
  | 'CB'
  | 'RB'
  | 'LB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'RW'
  | 'LW'
  | 'ST'
  | 'CF';

export interface PlayerStats {
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  position: PlayerPosition;
  number: number | null;
  age: number;
  overall: number;
  potential: number;
  morale: number;
  salary: number;
  marketValue: number;
  status: PlayerStatus;
  /** Current season stats */
  stats: PlayerStats;
  /** Career totals (accumulated across closed seasons) */
  careerStats?: PlayerStats;
  /** Pulse fields */
  personality?: string;
  fatigue?: number;
  availability?: PlayerAvailability;
}

export const PLAYER_POSITIONS: PlayerPosition[] = [
  'GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'ST', 'CF',
];

export function emptyPlayerStats(): PlayerStats {
  return { matches: 0, minutes: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
}
