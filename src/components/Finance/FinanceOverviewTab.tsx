import { useMemo } from 'react';
import type { useGame } from '../../context/GameContext';
import type { Currency, LedgerEntryType } from '../../types/Finance';
import type { FinanceLedgerEntry } from '../../types/Finance';
import { CURRENCIES } from '../../types/Finance';
import type { Player } from '../../types/Player';
import { formatMoney, isStadiumConfigured, ledgerEntryTypeLabel } from '../../utils/finance';
import {
  addMonths,
  getCashFlowProjection,
  getMonthlyCashFlow,
  latestLedgerMonthKey,
  monthKeyFromDate,
  percentChange,
  sumExpensesByCategory,
} from '../../utils/financeAnalytics';
import KpiCard from './KpiCard';
import CashFlowChart, { type MonthTooltipInfo } from './CashFlowChart';
import IncomeExpenseBarChart from './IncomeExpenseBarChart';
import CategoryDonutChart from './CategoryDonutChart';
import MonthlyBudgetCard from './MonthlyBudgetCard';
import TopEntriesList from './TopEntriesList';
import type { Period } from './FinanceHeader';
import styles from '../../pages/Finance/Finance.module.css';

type GameFinance = ReturnType<typeof useGame>['state']['finance'];

interface PeriodTotals {
  income: number;
  expense: number;
}

function sumLedger(entries: FinanceLedgerEntry[]): PeriodTotals {
  return entries.reduce<PeriodTotals>(
    (acc, e) =>
      e.amount >= 0
        ? { income: acc.income + e.amount, expense: acc.expense }
        : { income: acc.income, expense: acc.expense + Math.abs(e.amount) },
    { income: 0, expense: 0 },
  );
}

/** Meses cobertos por cada período (para o recorte de entradas do ledger). */
const PERIOD_SPAN_MONTHS: Record<Exclude<Period, 'season' | 'all'>, number> = {
  month: 1,
  '6months': 6,
};

function entriesInMonthRange(
  ledger: FinanceLedgerEntry[],
  startMonth: string,
  endMonth: string,
): FinanceLedgerEntry[] {
  return ledger.filter(e => {
    const m = monthKeyFromDate(e.date);
    return m >= startMonth && m <= endMonth;
  });
}

/**
 * Lançamentos do período selecionado + do período de comparação imediatamente
 * anterior. Fonte única para os KPIs, o breakdown de categorias, o donut e o
 * ranking de maiores lançamentos — evita recalcular o mesmo recorte 4 vezes.
 */
// Nomes evitam `current`/`previous` de propósito: o React Compiler trata `.current`
// como acesso de ref (`ref.current`) e recusa memoizar o hook por causa disso.
function usePeriodEntries(
  ledger: FinanceLedgerEntry[],
  currentDate: string | null,
  season: number,
  period: Period,
): { inPeriod: FinanceLedgerEntry[]; previousPeriod: FinanceLedgerEntry[] } {
  return useMemo(() => {
    if (period === 'season') {
      return {
        inPeriod: ledger.filter(e => e.season === season),
        previousPeriod: ledger.filter(e => e.season === season - 1),
      };
    }
    if (period === 'all') {
      return { inPeriod: ledger, previousPeriod: [] };
    }
    const anchorMonth = currentDate ? monthKeyFromDate(currentDate) : latestLedgerMonthKey(ledger);
    if (!anchorMonth) return { inPeriod: [], previousPeriod: [] };
    const span = PERIOD_SPAN_MONTHS[period];
    const currentStart = addMonths(anchorMonth, -(span - 1));
    const previousAnchor = addMonths(anchorMonth, -span);
    const previousStart = addMonths(previousAnchor, -(span - 1));
    return {
      inPeriod: entriesInMonthRange(ledger, currentStart, anchorMonth),
      previousPeriod: entriesInMonthRange(ledger, previousStart, previousAnchor),
    };
  }, [ledger, currentDate, season, period]);
}

const PERIOD_LABEL: Record<Period, string> = {
  month: 'vs. mês anterior',
  '6months': 'vs. 6 meses anteriores',
  season: 'vs. temporada anterior',
  all: '',
};

const PERIOD_TITLE: Record<Period, string> = {
  month: 'Mês atual',
  '6months': 'Últimos 6 meses',
  season: 'Temporada atual',
  all: 'Histórico acumulado',
};

function runwayTone(runway: number): { tone: 'good' | 'warn' | 'bad'; label: string } {
  if (runway === Infinity || runway >= 6) return { tone: 'good', label: 'Saudável' };
  if (runway > 3) return { tone: 'warn', label: 'Atenção' };
  return { tone: 'bad', label: 'Crítico' };
}

function marginTone(margin: number | null): { tone: 'good' | 'warn' | 'bad' | undefined; label: string } {
  if (margin == null) return { tone: undefined, label: '—' };
  if (margin < 0) return { tone: 'bad', label: 'Deficitário' };
  if (margin < 20) return { tone: 'warn', label: 'Alerta' };
  return { tone: 'good', label: 'Excelente' };
}

/** Maior receita e maior despesa (por tipo de lançamento) de cada mês do histórico. */
function useMonthTooltips(
  ledger: FinanceLedgerEntry[],
  historyPoints: { month: string }[],
): Record<string, MonthTooltipInfo> {
  return useMemo(() => {
    const result: Record<string, MonthTooltipInfo> = {};
    for (const { month } of historyPoints) {
      const byType = new Map<LedgerEntryType, number>();
      for (const e of ledger) {
        if (monthKeyFromDate(e.date) !== month) continue;
        byType.set(e.type, (byType.get(e.type) ?? 0) + e.amount);
      }
      let topIncome: MonthTooltipInfo['topIncome'];
      let topExpense: MonthTooltipInfo['topExpense'];
      for (const [type, amount] of byType) {
        if (amount > 0 && (!topIncome || amount > topIncome.amount)) {
          topIncome = { label: ledgerEntryTypeLabel(type), amount };
        }
        if (amount < 0 && (!topExpense || Math.abs(amount) > topExpense.amount)) {
          topExpense = { label: ledgerEntryTypeLabel(type), amount: Math.abs(amount) };
        }
      }
      result[month] = { topIncome, topExpense };
    }
    return result;
  }, [ledger, historyPoints]);
}

interface FinanceOverviewTabProps {
  finance: GameFinance;
  players: Player[];
  bill: number;
  runway: number;
  debtTotal: number;
  season: number;
  currentDate: string | null;
  period: Period;
  onAddEntry: () => void;
  onCurrencyChange: (currency: Currency) => void;
}

export default function FinanceOverviewTab({
  finance,
  players,
  bill,
  runway,
  debtTotal,
  season,
  currentDate,
  period,
  onAddEntry,
  onCurrencyChange,
}: FinanceOverviewTabProps) {
  const recentLedger = finance.ledger.slice(0, 8);
  const stadiumOk = isStadiumConfigured(finance.stadiumConfig);

  const periodEntries = usePeriodEntries(finance.ledger, currentDate, season, period);
  const current = useMemo(() => sumLedger(periodEntries.inPeriod), [periodEntries]);
  const previous = useMemo(() => sumLedger(periodEntries.previousPeriod), [periodEntries]);
  const categoryGroups = useMemo(
    () => sumExpensesByCategory(periodEntries.inPeriod),
    [periodEntries],
  );

  const historyPoints = useMemo(
    () => getMonthlyCashFlow(finance.ledger, currentDate, 6),
    [finance.ledger, currentDate],
  );
  const projectionPoints = useMemo(
    () => getCashFlowProjection({ finance, players, currentDate }, 3),
    [finance, players, currentDate],
  );
  const monthTooltips = useMonthTooltips(finance.ledger, historyPoints);

  const seasonEntries = useMemo(
    () => finance.ledger.filter(e => e.season === season),
    [finance.ledger, season],
  );
  const seasonTotals = useMemo(() => sumLedger(seasonEntries), [seasonEntries]);
  const startOfSeasonBalance = finance.balance - (seasonTotals.income - seasonTotals.expense);
  const balanceDelta = percentChange(finance.balance, startOfSeasonBalance);

  const incomeDelta = percentChange(current.income, previous.income);
  const expenseDelta = percentChange(current.expense, previous.expense);
  const margin = current.income > 0 ? ((current.income - current.expense) / current.income) * 100 : null;
  const marginInfo = marginTone(margin);
  const runwayInfo = runwayTone(runway);
  const periodDeltaLabel = PERIOD_LABEL[period];

  return (
    <>
      <div className={styles.heroCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p className={styles.heroLabel}>Caixa atual</p>
            <p className={`${styles.heroAmount} ${finance.balance < 0 ? styles.negative : ''}`}>
              {formatMoney(finance.balance, finance.currency)}
            </p>
          </div>
          <div className={styles.formGroup} style={{ minWidth: 160 }}>
            <label className={styles.formLabel}>Moeda</label>
            <select
              className={styles.formSelect}
              value={finance.currency}
              onChange={e => onCurrencyChange(e.target.value as Currency)}
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
        {!stadiumOk && (
          <p className={styles.stadiumHint}>
            Configure o estádio na aba Estádio para gerar bilheteria automática após os jogos.
          </p>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          margin: '16px 0',
        }}
      >
        <KpiCard
          label="Caixa atual"
          value={formatMoney(finance.balance, finance.currency)}
          deltaPercent={balanceDelta}
          deltaLabel="desde o início da temporada"
        />
        <KpiCard
          label="Receita do período"
          value={formatMoney(current.income, finance.currency)}
          deltaPercent={incomeDelta}
          deltaLabel={periodDeltaLabel}
        />
        <KpiCard
          label="Despesa do período"
          value={formatMoney(current.expense, finance.currency)}
          deltaPercent={expenseDelta}
          deltaLabel={periodDeltaLabel}
        />
        <KpiCard
          label="Margem"
          value={margin == null ? '—' : `${margin.toFixed(1)}%`}
          tone={marginInfo.tone}
          toneLabel={marginInfo.label}
        />
        <KpiCard
          label="Runway"
          value={runway === Infinity ? '∞' : `${runway} mês${runway !== 1 ? 'es' : ''}`}
          tone={runwayInfo.tone}
          toneLabel={runwayInfo.label}
          subtext={`Folha: ${formatMoney(bill, finance.currency)}/mês`}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <CashFlowChart
          historyPoints={historyPoints}
          projectionPoints={projectionPoints}
          currency={finance.currency}
          monthTooltips={monthTooltips}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <MonthlyBudgetCard finance={finance} currentDate={currentDate} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div className={styles.heroCard}>
          <p className={styles.heroLabel}>Despesas por categoria</p>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text)' }}>{PERIOD_TITLE[period]}</p>
          <CategoryDonutChart groups={categoryGroups} total={current.expense} currency={finance.currency} />
        </div>
        <div className={styles.heroCard}>
          <p className={styles.heroLabel}>Receita x despesa por mês</p>
          <IncomeExpenseBarChart points={historyPoints} currency={finance.currency} />
        </div>
      </div>

      <div className={styles.heroCard} style={{ marginBottom: 16 }}>
        <p className={styles.heroLabel}>Maiores lançamentos</p>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text)' }}>{PERIOD_TITLE[period]}</p>
        <TopEntriesList entries={periodEntries.inPeriod} currency={finance.currency} />
      </div>

      {debtTotal > 0 && (
        <p className={styles.heroMetaLabel} style={{ marginBottom: 12 }}>
          Dívidas em aberto:{' '}
          <span className={`${styles.heroMetaVal} ${styles.danger}`}>
            {formatMoney(debtTotal, finance.currency)}
          </span>
        </p>
      )}

      <div>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Últimos lançamentos</h3>
          <button className={styles.btnSecondary} onClick={onAddEntry}>+ Lançamento</button>
        </div>
        {recentLedger.length === 0 ? (
          <div className={styles.emptyState}>Nenhum lançamento ainda. Registre premiações, patrocínios ou despesas.</div>
        ) : (
          <ul className={styles.ledgerList} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--card-bg)' }}>
            {recentLedger.map(entry => (
              <li key={entry.id} className={styles.ledgerRow}>
                <div className={styles.ledgerMeta}>
                  <span className={styles.ledgerLabel}>{entry.label}</span>
                  <span className={styles.ledgerSub}>
                    {ledgerEntryTypeLabel(entry.type)} · {entry.date}
                  </span>
                </div>
                <span className={`${styles.ledgerAmount} ${entry.amount >= 0 ? styles.income : styles.expense}`}>
                  {entry.amount >= 0 ? '+' : ''}{formatMoney(entry.amount, finance.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
