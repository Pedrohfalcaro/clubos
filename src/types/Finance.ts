export type LedgerEntryType =
  | 'wage'
  | 'prize'
  | 'transfer_fee'
  | 'loan_fee'
  | 'loan_credit'
  | 'loan_repay'
  | 'debt_repay'
  | 'sponsor'
  | 'other_in'
  | 'other_out'
  | 'adjustment'
  | 'ticket'
  | 'travel'
  | 'stadium_ops';

export type ClubDebtSource = 'manual' | 'wage_overdraft';

export type SponsorTier = 'master' | 'sleeve';

export type SponsorBonusKind = 'league_position' | 'title' | 'club_top_scorer';

export interface SponsorBonusClause {
  id: string;
  kind: SponsorBonusKind;
  amount: number;
  /** league_position: posição máxima (ex.: 4 = G4). club_top_scorer: gols mínimos. */
  threshold?: number;
  /** title: nome da competição (opcional = qualquer título). */
  competition?: string;
}

/** Contrato de patrocínio Master / Manga. */
export interface ClubSponsor {
  id: string;
  brand: string;
  tier: SponsorTier;
  monthlyFee: number;
  seasonsTotal: number;
  seasonsRemaining: number;
  startSeason: number;
  /** Dia do mês (1–28) em que a cota cai. */
  paymentDay: number;
  /** Posição máxima na liga para não rescindir (ex.: 14). */
  minLeaguePosition?: number;
  terminationFee: number;
  bonuses: SponsorBonusClause[];
  status: 'active' | 'expired' | 'terminated';
  /** Último mês `YYYY-MM` em que a cota mensal foi creditada. */
  lastPaidMonth?: string;
}

/** Dívida do clube (abertura, sobreaviso de folha, etc.). */
export interface ClubDebt {
  id: string;
  label: string;
  principal: number;
  remaining: number;
  /** Parcela mensal obrigatória. */
  monthlyInstallment: number;
  /** Dia do mês (1–28) da parcela. */
  paymentDay: number;
  /** Último mês `YYYY-MM` em que a parcela foi paga ou ignorada. */
  lastInstallmentMonth?: string;
  /** Juros acumulados por parcelas ignoradas. */
  accruedInterest?: number;
  createdAt: string;
  source: ClubDebtSource;
  status: 'active' | 'paid';
}

/** Empréstimo bancário do clube. */
export interface ClubLoan {
  id: string;
  principal: number;
  /** Juros totais em % sobre o principal (ex.: 12 = 12%). Sempre > 0. */
  interestRate: number;
  totalToRepay: number;
  installmentCount: number;
  createdAt: string;
  firstPaymentDate: string;
  status: 'active' | 'paid';
  notes?: string;
}

export interface ClubLoanPayment {
  id: string;
  loanId: string;
  dueDate: string;
  amount: number;
  label: string;
  status: 'pending' | 'paid';
  installmentIndex: number;
  installmentTotal: number;
  ledgerEntryId?: string;
}

export interface FinanceLedgerEntry {
  id: string;
  date: string; // ISO date string
  season: number;
  type: LedgerEntryType;
  /** Positive = income, negative = expense */
  amount: number;
  label: string;
  relatedPlayerId?: string;
  relatedTransferId?: string;
  matchId?: string;
}

export type Currency = 'BRL' | 'EUR' | 'GBP' | 'USD';

export const CURRENCIES: { code: Currency; symbol: string; label: string }[] = [
  { code: 'BRL', symbol: 'R$', label: 'Real (R$)' },
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'GBP', symbol: '£', label: 'Libra (£)' },
  { code: 'USD', symbol: '$', label: 'Dólar (US$)' },
];

export function currencySymbol(currency: Currency): string {
  return CURRENCIES.find(c => c.code === currency)?.symbol ?? 'R$';
}

export function currencyLabel(currency: Currency): string {
  return CURRENCIES.find(c => c.code === currency)?.label ?? currency;
}

export interface PrizeTableEntry {
  win?: number;
  draw?: number;
  knockout?: number;
  champion?: number;
}

/** Parâmetros de estádio / bilheteria (LiveLife). */
export interface StadiumConfig {
  /** Capacidade do estádio mandante (casa). */
  capacity: number;
  ticketPriceHome: number;
  ticketPriceAway: number;
  maintenanceCostPerMatch: number;
  travelCostAverage: number;
}

/** Rating bancário do clube (v1.3 — Financial Update). */
export type FinancialRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'D' | 'F';

/**
 * Teto de gastos mensal (v1.3). `currentSpent` é derivado do `ledger` em runtime
 * (ver `utils/financeAnalytics.ts`) — nunca persistido, para não dessincronizar
 * do extrato real.
 */
export interface MonthlyBudget {
  targetExpenseLimit: number;
  /** `currentDate` do jogo no momento em que o teto foi definido/alterado. */
  updatedAt: string;
}

/**
 * Saúde financeira / rating de crédito (v1.3). Cacheado em `ClubFinance.health` e
 * recalculado só em checkpoints específicos (ver `utils/financialHealth.ts`) —
 * não a cada render.
 */
export interface FinancialHealth {
  /** 0–100 */
  score: number;
  rating: FinancialRating;
  /** Teto sugerido para novos empréstimos. */
  creditLimit: number;
  /** `currentDate` do jogo no momento do cálculo. */
  computedAt: string;
}

export interface ClubFinance {
  balance: number;
  currency: Currency;
  /** keyed by competition name */
  prizeTable: Record<string, PrizeTableEntry>;
  ledger: FinanceLedgerEntry[];
  stadiumConfig?: StadiumConfig;
  /** Empréstimos ativos / quitados */
  loans?: ClubLoan[];
  /** Parcelas de empréstimo no calendário */
  loanPayments?: ClubLoanPayment[];
  /** Dívidas (abertura, saldo negativo da folha, etc.) */
  debts?: ClubDebt[];
  /** Patrocínios Master / Manga */
  sponsors?: ClubSponsor[];
  /** Teto de gastos mensal (v1.3, opt-in — undefined = não configurado). */
  monthlyBudget?: MonthlyBudget;
  /** Rating bancário cacheado (v1.3). */
  health?: FinancialHealth;
}

export function createDefaultStadiumConfig(currency: Currency = 'BRL'): StadiumConfig {
  // Import circular-safe: valores espelhados de livelifeTemplates.stadiumTemplate
  switch (currency) {
    case 'EUR':
      return {
        capacity: 35_000,
        ticketPriceHome: 25,
        ticketPriceAway: 12,
        maintenanceCostPerMatch: 45_000,
        travelCostAverage: 30_000,
      };
    case 'GBP':
      return {
        capacity: 32_000,
        ticketPriceHome: 30,
        ticketPriceAway: 15,
        maintenanceCostPerMatch: 40_000,
        travelCostAverage: 25_000,
      };
    case 'USD':
      return {
        capacity: 40_000,
        ticketPriceHome: 35,
        ticketPriceAway: 18,
        maintenanceCostPerMatch: 55_000,
        travelCostAverage: 35_000,
      };
    case 'BRL':
    default:
      return {
        capacity: 40_000,
        ticketPriceHome: 40,
        ticketPriceAway: 20,
        maintenanceCostPerMatch: 80_000,
        travelCostAverage: 50_000,
      };
  }
}

export function createDefaultFinance(
  initialBudget = 5_000_000,
  currency: Currency = 'BRL',
): ClubFinance {
  return {
    balance: initialBudget,
    currency,
    prizeTable: {},
    ledger: [],
    stadiumConfig: createDefaultStadiumConfig(currency),
    loans: [],
    loanPayments: [],
    debts: [],
    sponsors: [],
  };
}
