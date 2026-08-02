export interface ManagerAward {
  id: string;
  /** Ex.: Melhor Técnico */
  title: string;
  season: number;
  competition?: string;
  date?: string;
}

export interface Manager {
  name: string;
  nationality: string;
  age: number;
  bio?: string;
  tacticalNotes?: string;
  agentContacts?: string;
  /** Prêmios individuais do técnico */
  awards?: ManagerAward[];
}
