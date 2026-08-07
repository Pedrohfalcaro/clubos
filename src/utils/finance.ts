import type {
  ClubFinance,
  FinanceLedgerEntry,
  LedgerEntryType,
  Currency,
  StadiumConfig,
} from '../types/Finance';
import { currencySymbol, createDefaultStadiumConfig } from '../types/Finance';
import type { Player } from '../types/Player';
import type { Match } from '../types/Match';
import type { Team } from '../types/Team';

export function formatMoney(value: number, currency: Currency = 'BRL'): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  const symbol = currencySymbol(currency);

  // Lançamentos manuais não têm teto — sem faixas acima de B, um valor de
  // trilhões aparecia como "120000000,0B" em vez de abreviado corretamente.
  if (abs >= 1_000_000_000_000_000) {
    return `${sign}${symbol} ${(abs / 1_000_000_000_000_000).toFixed(1).replace('.', ',')}Qa`;
  }
  if (abs >= 1_000_000_000_000) {
    return `${sign}${symbol} ${(abs / 1_000_000_000_000).toFixed(1).replace('.', ',')}T`;
  }
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
 * Constantes de bilheteria (base do jogo — não configuráveis no estádio).
 * Documentadas em `docs/INSTRUCOES_LIVELIFE_V1_2.md`.
 */
export const GATE_RULES = {
  /** Capacidade padrão assumida do estádio adversário. */
  awayStadiumCapacity: 40_000,
  /** Capacidade padrão de campo neutro (maior que a média). */
  neutralStadiumCapacity: 60_000,
  /** Fração do estádio casa reservada à torcida mandante. */
  homeSpaceShare: 0.9,
  /** Fração do estádio adversário = cota visitante. */
  awayQuotaShare: 0.1,
  /** Fração do estádio neutro disponível ao clube. */
  neutralQuotaShare: 0.5,
} as const;

/** Confiança da torcida (0–100) → fator de lotação [0.05, 1]. */
export function supporterFillRate(supporterConfidence?: number | null): number {
  return Math.min(1, Math.max(0.05, (supporterConfidence ?? 50) / 100));
}

/** Casa: até 90% da capacidade do estádio. */
export function homeQuotaCap(homeCapacity: number): number {
  return Math.max(0, Math.floor(homeCapacity * GATE_RULES.homeSpaceShare));
}

/** Cota máxima de visitante: 10% do estádio adversário padrão. */
export function awayQuotaCap(): number {
  return Math.max(0, Math.floor(GATE_RULES.awayStadiumCapacity * GATE_RULES.awayQuotaShare));
}

/** Teto em campo neutro: 50% da capacidade neutra padrão. */
export function neutralQuotaCap(): number {
  return Math.max(0, Math.floor(GATE_RULES.neutralStadiumCapacity * GATE_RULES.neutralQuotaShare));
}

/**
 * Público a partir da cota e da moral.
 * `jitter` false = determinístico (migração de saves).
 */
export function calcQuotaAttendance(
  quotaCap: number,
  supporterConfidence: number | null | undefined,
  jitter = true,
): number {
  if (quotaCap <= 0) return 0;
  const fill = supporterFillRate(supporterConfidence);
  const variance = jitter ? randBetween(0.92, 1.05) : 1;
  return Math.min(quotaCap, Math.max(0, Math.round(quotaCap * fill * variance)));
}

/**
 * Bilheteria pós-jogo. Sem `stadiumConfig`, retorna [].
 * Casa: até 90% da capacidade, lotação pela moral.
 * Visitante: 10% de 40.000 (base), lotação pela moral; preço cota + viagem.
 * Neutro: 50% de 60.000 (base), lotação pela moral; preço casa + viagem.
 */
export function calcGateRevenue(
  match: Pick<Match, 'id' | 'location' | 'opponent'>,
  team: Pick<Team, 'supporterConfidence' | 'name'>,
  finance: ClubFinance,
  season: number,
  gameDate?: string | null,
  options?: { jitter?: boolean },
): FinanceLedgerEntry[] {
  if (!isStadiumConfigured(finance.stadiumConfig)) return [];
  const cfg = normalizeStadiumConfig(finance.stadiumConfig, finance.currency);

  const date = gameDate ?? undefined;
  const extras = { matchId: match.id };
  const jitter = options?.jitter !== false;

  if (match.location === 'home') {
    const quota = homeQuotaCap(cfg.capacity);
    const attendance = calcQuotaAttendance(quota, team.supporterConfidence, jitter);
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
    const quota = awayQuotaCap();
    const attendance = calcQuotaAttendance(quota, team.supporterConfidence, jitter);
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

  if (match.location === 'neutral') {
    const quota = neutralQuotaCap();
    const attendance = calcQuotaAttendance(quota, team.supporterConfidence, jitter);
    const gross = Math.round(attendance * cfg.ticketPriceHome);
    const travel = Math.round(cfg.travelCostAverage);
    const entries: FinanceLedgerEntry[] = [];
    if (gross > 0) {
      entries.push(
        newLedgerEntry(
          'ticket',
          gross,
          `Bilheteria (neutro) × ${match.opponent} (${attendance.toLocaleString('pt-BR')} pagantes)`,
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

/** Mantém só campos configuráveis do estádio (remove capacidades base legadas do save). */
export function normalizeStadiumConfig(
  cfg: StadiumConfig,
  currency: Currency = 'BRL',
): StadiumConfig {
  const defaults = createDefaultStadiumConfig(currency);
  return {
    capacity: cfg.capacity > 0 ? cfg.capacity : defaults.capacity,
    ticketPriceHome: cfg.ticketPriceHome ?? defaults.ticketPriceHome,
    ticketPriceAway: cfg.ticketPriceAway ?? defaults.ticketPriceAway,
    maintenanceCostPerMatch: cfg.maintenanceCostPerMatch ?? defaults.maintenanceCostPerMatch,
    travelCostAverage: cfg.travelCostAverage ?? defaults.travelCostAverage,
  };
}

const PAGANTES_RE = /\((\d[\d.]*)\s*pagantes\)/;

function parsePagantesFromLabel(label: string): number | null {
  const m = label.match(PAGANTES_RE);
  if (!m) return null;
  const n = parseInt(m[1].replace(/\./g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Corrige bilheterias visitante/neutro geradas pela fórmula antiga (fans/2 sem teto).
 * Ajusta o saldo pela diferença dos lançamentos `ticket` recalculados.
 */
export function migrateAbsurdGateRevenue(
  finance: ClubFinance,
  matches: Array<Pick<Match, 'id' | 'location' | 'opponent'>>,
  team: Pick<Team, 'supporterConfidence'> | null | undefined,
): ClubFinance {
  if (!isStadiumConfigured(finance.stadiumConfig) || !finance.ledger?.length) return finance;
  const cfg = normalizeStadiumConfig(finance.stadiumConfig, finance.currency);

  const byId = new Map(matches.map(m => [m.id, m]));
  const awayMax = awayQuotaCap();
  const neutralMax = neutralQuotaCap();
  /** Acima disso (com folga), consideramos fórmula antiga. */
  const absurdAway = Math.max(awayMax * 2, 8_000);
  const absurdNeutral = Math.max(neutralMax * 2, 20_000);

  let balanceDelta = 0;
  const ledger = finance.ledger.map(entry => {
    if (entry.type !== 'ticket') return entry;

    const match = entry.matchId ? byId.get(entry.matchId) : undefined;
    const isAwayLabel = entry.label.startsWith('Cota visitante');
    const isNeutralLabel =
      entry.label.startsWith('Bilheteria (neutro)') ||
      (entry.label.startsWith('Bilheteria') && match?.location === 'neutral');

    const location: 'away' | 'neutral' | null = match
      ? match.location === 'away' || match.location === 'neutral'
        ? match.location
        : null
      : isAwayLabel
        ? 'away'
        : isNeutralLabel
          ? 'neutral'
          : null;

    if (!location) return entry;

    const pagantes = parsePagantesFromLabel(entry.label);
    const cap = location === 'away' ? awayMax : neutralMax;
    const absurdThreshold = location === 'away' ? absurdAway : absurdNeutral;
    const looksAbsurd =
      (pagantes !== null && pagantes > absurdThreshold) ||
      entry.amount > Math.round(cap * Math.max(cfg.ticketPriceAway, cfg.ticketPriceHome) * 2);

    if (!looksAbsurd) return entry;

    const opponent =
      match?.opponent ??
      (entry.label
        .replace(/^(Cota visitante|Bilheteria \(neutro\)|Bilheteria) ×\s*/, '')
        .replace(/\s*\(.*$/, '') || 'Adversário');
    const attendance = calcQuotaAttendance(cap, team?.supporterConfidence, false);
    const price = location === 'away' ? cfg.ticketPriceAway : cfg.ticketPriceHome;
    const gross = Math.round(attendance * price);
    const prefix = location === 'away' ? 'Cota visitante' : 'Bilheteria (neutro)';
    const label = `${prefix} × ${opponent} (${attendance.toLocaleString('pt-BR')} pagantes)`;

    balanceDelta += gross - entry.amount;
    return {
      ...entry,
      amount: gross,
      label,
    };
  });

  if (balanceDelta === 0) return finance;

  return {
    ...finance,
    balance: finance.balance + balanceDelta,
    ledger,
  };
}
