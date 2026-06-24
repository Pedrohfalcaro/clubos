export type PlayerStatus = 'Titular' | 'Reserva' | 'Promessa' | 'Transferível';

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
  stats: PlayerStats;
}
