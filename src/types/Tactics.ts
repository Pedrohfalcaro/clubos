export interface FormationSlot {
  playerId: string;
  x: number;
  y: number;
}

export interface SavedTactics {
  formation: FormationSlot[];
  bench: string[];
}
