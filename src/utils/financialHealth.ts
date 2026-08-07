import type { ClubDebt, ClubFinance, FinancialHealth, FinancialRating } from '../types/Finance';
import type { Player } from '../types/Player';
import { totalDebtRemaining } from './clubDebts';
import { wageBill } from './finance';
import { addMonths, monthKeyFromDate } from './financeAnalytics';

export const RUNWAY_WEIGHT = 40;
export const PUNCTUALITY_WEIGHT = 35;
export const DEBT_RATIO_WEIGHT = 25;

/** Runway (em meses) que já vale a pontuação máxima de autonomia. */
export const RUNWAY_TARGET_MONTHS = 6;

/** Quantos atrasos de folha (`wage_overdraft`) na janela zeram a pontuação de adimplência. */
export const MAX_PUNCTUALITY_OVERDRAFTS = 3;

/** Janela (em meses) considerada para contar atrasos de folha recentes. */
export const WAGE_OVERDRAFT_LOOKBACK_MONTHS = 6;

const RATING_THRESHOLDS: [minScore: number, rating: FinancialRating][] = [
  [90, 'AAA'],
  [80, 'AA'],
  [70, 'A'],
  [60, 'BBB'],
  [50, 'BB'],
  [40, 'B'],
  [25, 'CCC'],
  [10, 'D'],
];

const CREDIT_LIMIT_MULTIPLIER: Record<FinancialRating, number> = {
  AAA: 2,
  AA: 2,
  A: 1.5,
  BBB: 1.5,
  BB: 1,
  B: 1,
  CCC: 0.5,
  D: 0,
  F: 0,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return n > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, n));
}

function ratingFromScore(score: number): FinancialRating {
  for (const [min, rating] of RATING_THRESHOLDS) {
    if (score >= min) return rating;
  }
  return 'F';
}

/**
 * Carreiras sem `currentDate` (LiveLife nunca ativado) não têm clock de jogo para
 * ancorar "quão recente" foi um atraso. Nunca usar `new Date()` real (invariante do
 * handoff financeiro) — cai para a data mais recente do ledger, ou uma âncora neutra
 * se nem isso existir (nesse caso todo `wage_overdraft` conta como "recente").
 */
function resolveAnchorDate(finance: ClubFinance, currentDate: string | null): string {
  if (currentDate) return currentDate;
  const latestLedgerDate = (finance.ledger ?? []).reduce<string | null>(
    (max, e) => (!max || e.date > max ? e.date : max),
    null,
  );
  return latestLedgerDate ?? '1970-01-01';
}

/** Conta dívidas de origem `wage_overdraft` criadas nos últimos `monthsBack` meses. */
export function countWageOverdrafts(
  debts: ClubDebt[] | undefined,
  anchorDate: string,
  monthsBack = WAGE_OVERDRAFT_LOOKBACK_MONTHS,
): number {
  const cutoffMonth = addMonths(monthKeyFromDate(anchorDate), -monthsBack);
  return (debts ?? []).filter(
    d => d.source === 'wage_overdraft' && monthKeyFromDate(d.createdAt) >= cutoffMonth,
  ).length;
}

/**
 * Saúde financeira / rating de crédito do clube. Barata e determinística — pensada
 * para rodar só nos checkpoints documentados em `CURSOR_MANUAL.md` (ADVANCE_DAY,
 * folha, quitação de dívida, load do save), nunca a cada render.
 */
export function computeFinancialHealth(input: {
  finance: ClubFinance;
  players: Player[];
  currentDate: string | null;
}): FinancialHealth {
  const { finance, players, currentDate } = input;
  const anchorDate = resolveAnchorDate(finance, currentDate);

  const bill = wageBill(players);
  const runwayMonths = bill > 0 ? finance.balance / bill : Infinity;
  const runwayScore =
    (runwayMonths === Infinity ? 1 : clamp01(runwayMonths / RUNWAY_TARGET_MONTHS)) * RUNWAY_WEIGHT;

  const recentOverdrafts = countWageOverdrafts(finance.debts, anchorDate);
  const punctualityScore =
    clamp01(1 - recentOverdrafts / MAX_PUNCTUALITY_OVERDRAFTS) * PUNCTUALITY_WEIGHT;

  const debtRemaining = totalDebtRemaining(finance.debts);
  const debtRatioScore =
    clamp01(1 - debtRemaining / Math.max(finance.balance, 1)) * DEBT_RATIO_WEIGHT;

  const score = Math.round(runwayScore + punctualityScore + debtRatioScore);
  const rating = ratingFromScore(score);
  const creditLimit = Math.max(0, Math.round(finance.balance * CREDIT_LIMIT_MULTIPLIER[rating]));

  return { score, rating, creditLimit, computedAt: anchorDate };
}
