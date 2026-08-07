import { getCategoryBreakdown, latestLedgerMonthKey, monthKeyFromDate } from '../../utils/financeAnalytics';
import type { useGame } from '../../context/GameContext';
import { formatMoney } from '../../utils/finance';
import { CATEGORY_META, CATEGORY_ORDER } from './categoryMeta';
import styles from '../../pages/Finance/Finance.module.css';
import cardStyles from './MonthlyBudgetCard.module.css';

type GameFinance = ReturnType<typeof useGame>['state']['finance'];

interface MonthlyBudgetCardProps {
  finance: GameFinance;
  currentDate: string | null;
}

function progressTone(percent: number): 'good' | 'warn' | 'bad' {
  if (percent >= 100) return 'bad';
  if (percent >= 80) return 'warn';
  return 'good';
}

export default function MonthlyBudgetCard({ finance, currentDate }: MonthlyBudgetCardProps) {
  const monthKey = currentDate ? monthKeyFromDate(currentDate) : latestLedgerMonthKey(finance.ledger);

  if (!monthKey) {
    return null;
  }

  const breakdown = getCategoryBreakdown(finance.ledger, monthKey);
  const budget = finance.monthlyBudget;
  const percent = budget && budget.targetExpenseLimit > 0
    ? (breakdown.total / budget.targetExpenseLimit) * 100
    : null;
  const tone = percent != null ? progressTone(percent) : undefined;

  const maxCategory = Math.max(1, ...CATEGORY_ORDER.map(g => breakdown.groups.find(x => x.group === g)?.total ?? 0));

  return (
    <div className={styles.heroCard}>
      <div className={cardStyles.head}>
        <p className={styles.heroLabel}>Orçamento do mês</p>
        <span className={cardStyles.total}>{formatMoney(breakdown.total, finance.currency)}</span>
      </div>

      {budget ? (
        <>
          <div className={cardStyles.progressTrack}>
            <div
              className={`${cardStyles.progressFill} ${cardStyles[`tone-${tone}`]}`}
              style={{ width: `${Math.min(100, percent ?? 0)}%` }}
            />
          </div>
          <p className={cardStyles.progressLabel}>
            {(percent ?? 0).toFixed(0)}% consumido de {formatMoney(budget.targetExpenseLimit, finance.currency)}
            {percent != null && percent >= 100 && (
              <span className={cardStyles.overLabel}> · teto estourado</span>
            )}
          </p>
        </>
      ) : (
        <p className={cardStyles.noBudgetHint}>
          Nenhum teto definido — use "Definir teto de gastos" no topo da página para acompanhar o consumo mensal.
        </p>
      )}

      <div className={cardStyles.categoryList}>
        {CATEGORY_ORDER.map(group => {
          const entry = breakdown.groups.find(g => g.group === group);
          const total = entry?.total ?? 0;
          const meta = CATEGORY_META[group];
          const widthPct = breakdown.total > 0 ? (total / maxCategory) * 100 : 0;
          return (
            <div key={group} className={cardStyles.categoryRow}>
              <span className={cardStyles.categoryLabel}>
                <span className={cardStyles.dot} style={{ background: meta.color }} />
                {meta.label}
              </span>
              <div className={cardStyles.categoryBarTrack}>
                <div
                  className={cardStyles.categoryBarFill}
                  style={{ width: `${widthPct}%`, background: meta.color }}
                />
              </div>
              <span className={cardStyles.categoryValue}>{formatMoney(total, finance.currency)}</span>
            </div>
          );
        })}
        {breakdown.total === 0 && (
          <p className={styles.emptyState}>Nenhuma despesa registrada neste mês ainda.</p>
        )}
      </div>
    </div>
  );
}
