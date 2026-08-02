import type {
  ClubFinance,
  FinanceLedgerEntry,
  LedgerEntryType,
  Currency,
  StadiumConfig,
} from '../types/Finance';
import { currencySymbol } from '../types/Finance';
import type { Player } from '../types/Player';
import type { Match } from '../types/Match';
import type { Team } from '../types/Team';

export function formatMoney(value: number, currency: Currency = 'BRL'): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  const symbol = currencySymbol(currency);

  if (abs >= 1_000_000_000) {
    return `${sign}${symbol} ${(abs / 1_000_000_000).toFixed(1).replace('.', ',')}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${symbol} ${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${symbol} ${(abs / 1_000).toFixed(0)}K`;
  }
  return `${sign}${symbol} ${abs.toLocaleString('pt-BR')}`;
}

export function formatMoneyFull(value: number, currency: Currency = 'BRL'): string {
  const symbol = currencySymbol(currency);
  return `${symbol} ${Math.abs(value).toLocaleString('pt-BR')}`;
}

export function wageBill(players: Player[]): number {
  return players.reduce((sum, p) => sum + (p.salary ?? 0), 0);
}

export function runwayMonths(finance: ClubFinance, players: Player[]): number {
  const bill = wageBill(players);
  if (bill <= 0) return Infinity;
  return Math.floor(finance.balance / bill);
}

export function newLedgerEntry(
  type: LedgerEntryType,
  amount: number,
  label: string,
  season: number,
  extras?: Partial<Pick<FinanceLedgerEntry, 'relatedPlayerId' | 'relatedTransferId' | 'matchId'>>,
  gameDate?: string,
): FinanceLedgerEntry {
  return {
    id: `ledger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: (gameDate ?? new Date().toISOString()).slice(0, 10),
    season,
    type,
    amount,
    label,
    ...extras,
  };
}

export function ledgerEntryTypeLabel(type: LedgerEntryType): string {
  switch (type) {
    case 'wage': return 'Folha salarial';
    case 'prize': return 'Premiação';
    case 'transfer_fee': return 'Taxa de transferência';
    case 'loan_fee': return 'Taxa de empréstimo (atleta)';
    case 'loan_credit': return 'Empréstimo (crédito)';
    case 'loan_repay': return 'Parcela de empréstimo';
    case 'debt_repay': return 'Pagamento de dívida';
    case 'sponsor': return 'Patrocínio';
    case 'other_in': return 'Receita';
    case 'other_out': return 'Despesa';
    case 'adjustment': return 'Ajuste';
    case 'ticket': return 'Bilheteria';
    case 'travel': return 'Viagem';
    case 'stadium_ops': return 'Operação do estádio';
  }
}

export function isIncome(type: LedgerEntryType): boolean {
  return ['prize', 'transfer_fee', 'loan_fee', 'loan_credit', 'sponsor', 'other_in', 'ticket'].includes(type);
}

export function balanceFromLedger(initialBalance: number, ledger: FinanceLedgerEntry[]): number {
  return ledger.reduce((sum, e) => sum + e.amount, initialBalance);
}

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Bilheteria pós-jogo. Sem `stadiumConfig`, retorna [].
 * Casa: público limitado pela capacidade; visitante: metade da torcida × fator.
 */
export function calcGateRevenue(
  match: Pick<Match, 'id' | 'location' | 'opponent'>,
  team: Pick<Team, 'fans' | 'supporterConfidence' | 'name'>,
  finance: ClubFinance,
  season: number,
  gameDate?: string | null,
): FinanceLedgerEntry[] {
  const cfg = finance.stadiumConfig;
  if (!isStadiumConfigured(cfg)) return [];

  const date = gameDate ?? undefined;
  const fans = Math.max(0, team.fans ?? 0);
  const conf = Math.min(1, Math.max(0.05, (team.supporterConfidence ?? 50) / 100));
  const extras = { matchId: match.id };

  if (match.location === 'home') {
    const factor = randBetween(0.6, 1.0);
    const attendance = Math.min(
      cfg.capacity,
      Math.round(fans * conf * factor),
    );
    const gross = Math.round(attendance * cfg.ticketPriceHome);
    const ops = Math.round(cfg.maintenanceCostPerMatch);
    const entries: FinanceLedgerEntry[] = [];
    if (gross > 0) {
      entries.push(
        newLedgerEntry(
          'ticket',
          gross,
          `Bilheteria × ${match.opponent} (${attendance.toLocaleString('pt-BR')} pagantes)`,
          season,
          extras,
          date ?? undefined,
        ),
      );
    }
    if (ops > 0) {
      entries.push(
        newLedgerEntry(
          'stadium_ops',
          -ops,
          `Operação do estádio × ${match.opponent}`,
          season,
          extras,
          date ?? undefined,
        ),
      );
    }
    return entries;
  }

  if (match.location === 'away') {
    const factor = randBetween(0.3, 0.7);
    const attendance = Math.round((fans / 2) * factor);
    const gross = Math.round(attendance * cfg.ticketPriceAway);
    const travel = Math.round(cfg.travelCostAverage);
    const entries: FinanceLedgerEntry[] = [];
    if (gross > 0) {
      entries.push(
        newLedgerEntry(
          'ticket',
          gross,
          `Cota visitante × ${match.opponent} (${attendance.toLocaleString('pt-BR')} pagantes)`,
          season,
          extras,
          date ?? undefined,
        ),
      );
    }
    if (travel > 0) {
      entries.push(
        newLedgerEntry(
          'travel',
          -travel,
          `Custos de viagem × ${match.opponent}`,
          season,
          extras,
          date ?? undefined,
        ),
      );
    }
    return entries;
  }

  return [];
}

/** Premiação automática por resultado, se configurada na prizeTable. */
export function applyMatchPrize(
  match: Pick<Match, 'id' | 'competition' | 'result' | 'opponent'>,
  finance: ClubFinance,
  season: number,
  gameDate?: string | null,
): FinanceLedgerEntry | null {
  if (!match.result || match.result === 'loss') return null;
  const prize = finance.prizeTable[match.competition];
  if (!prize) return null;

  const amount = match.result === 'win' ? prize.win : prize.draw;
  if (!amount || amount <= 0) return null;

  const label =
    match.result === 'win'
      ? `Premiação vitória · ${match.competition} × ${match.opponent}`
      : `Premiação empate · ${match.competition} × ${match.opponent}`;

  return newLedgerEntry(
    'prize',
    amount,
    label,
    season,
    { matchId: match.id },
    gameDate ?? undefined,
  );
}

export function isStadiumConfigured(cfg: StadiumConfig | undefined): cfg is StadiumConfig {
  return !!cfg && cfg.capacity > 0 && (cfg.ticketPriceHome > 0 || cfg.ticketPriceAway > 0);
}
