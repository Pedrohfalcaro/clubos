export interface StandingsEntry {
  teamName: string;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface Competition {
  id: string;
  name: string;
  season: string;
}
