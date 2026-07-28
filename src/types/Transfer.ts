export type TransferType = 'buy' | 'sell' | 'loan_out' | 'loan_in' | 'free';

export interface WatchlistPlayer {
  id: string;
  name: string;
  position: string;
  age?: number;
  overall?: number;
  clubName: string;
  marketValue?: number;
  notes?: string;
  /** Prepared for future API integration */
  externalRef?: { provider: string; id: string };
}

export interface TransferPlayerSnapshot {
  name: string;
  position: string;
  age?: number;
  overall?: number;
  number?: number | null;
}

export interface TransferRecord {
  id: string;
  date: string;
  season: number;
  type: TransferType;
  /** null when signing a free agent created from scratch */
  playerId?: string;
  playerSnapshot: TransferPlayerSnapshot;
  fromClub: string;
  toClub: string;
  fee: number;
  wage: number;
  loanDurationMonths?: number;
  ledgerEntryIds: string[];
}

export interface TransferState {
  watchlist: WatchlistPlayer[];
  history: TransferRecord[];
}

export function createDefaultTransferState(): TransferState {
  return { watchlist: [], history: [] };
}
