export interface TeamStatistics {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface Team {
  id: string;
  name: string;
  nickname: string;
  country: string;
  budget: number;
  fans: number;
  boardConfidence: number;
  supporterConfidence: number;
  statistics: TeamStatistics;
  description?: string;
  history?: string;
  achievements?: string[];
  currentMoment?: string;
}
