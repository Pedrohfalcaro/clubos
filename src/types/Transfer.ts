export type TransferType = 'buy' | 'sell' | 'loan_out' | 'loan_in' | 'free';

export type TransferPaymentMethod = 'cash' | 'installment';

export interface WatchlistPlayer {
  id: string;
  name: string;
  position: string;
  age?: number;
  /** ISO YYYY-MM-DD — usado para recalcular idade na temporada. */
  birthDate?: string;
  overall?: number;
  clubName: string;
  marketValue?: number;
  nationality?: string;
  photoUrl?: string;
  notes?: string;
  /** Prepared for API-Football / outros provedores */
  externalRef?: { provider: string; id: string };
}

export interface TransferPlayerSnapshot {
  name: string;
  position: string;
  age?: number;
  overall?: number;
  number?: number | null;
  nationality?: string;
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
  paymentMethod?: TransferPaymentMethod;
  /** Número de parcelas (1 = à vista). */
  installmentCount?: number;
  /** Contrato em anos (opcional). */
  contractYears?: number;
  notes?: string;
  /** Dia em que o atleta se apresenta (compra/empréstimo in). */
  presentationDate?: string;
  /** ID do jogador criado no elenco (após contratar). */
  squadPlayerId?: string;
}

/** Parcela / pagamento agendado no calendário LiveLife. */
export interface TransferPayment {
  id: string;
  transferId: string;
  dueDate: string;
  amount: number;
  label: string;
  status: 'pending' | 'paid';
  installmentIndex: number;
  installmentTotal: number;
  playerName: string;
  /** out = clube paga · in = clube recebe */
  direction: 'out' | 'in';
  ledgerEntryId?: string;
}

export interface TransferState {
  watchlist: WatchlistPlayer[];
  history: TransferRecord[];
  pendingPayments: TransferPayment[];
}

export function createDefaultTransferState(): TransferState {
  return { watchlist: [], history: [], pendingPayments: [] };
}

/** Campos obrigatórios só na hora de contratar (não na observação). */
export const WATCHLIST_REQUIRED_FOR_BUY: Array<keyof WatchlistPlayer> = [
  'name',
  'position',
  'age',
  'overall',
  'clubName',
  'marketValue',
];

export function watchlistMissingForBuy(w: WatchlistPlayer): string[] {
  const missing: string[] = [];
  if (!w.name?.trim()) missing.push('Nome');
  if (!w.position?.trim()) missing.push('Posição');
  if (w.age == null || Number.isNaN(w.age)) missing.push('Idade');
  if (w.overall == null || Number.isNaN(w.overall)) missing.push('Overall');
  if (!w.clubName?.trim()) missing.push('Clube');
  if (w.marketValue == null || Number.isNaN(w.marketValue)) missing.push('Valor de mercado');
  return missing;
}
