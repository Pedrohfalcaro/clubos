import type { Currency } from '../../types/Finance';
import { formatMoney } from '../../utils/finance';
import type { MonthlyCashFlowPoint } from '../../utils/financeAnalytics';
import styles from './CashFlowChart.module.css';
import barStyles from './IncomeExpenseBarChart.module.css';

interface IncomeExpenseBarChartProps {
  /** Mesmos pontos históricos já computados para o gráfico de linha (Fase 6) — sem refetch. */
  points: MonthlyCashFlowPoint[];
  currency: Currency;
}

const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const abbr = MONTH_ABBR[(month - 1 + 12) % 12] ?? '?';
  return `${abbr}/${String(year).slice(2)}`;
}

const VIEW_W = 640;
const VIEW_H = 200;
const PAD_LEFT = 12;
const PAD_RIGHT = 12;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;
const PLOT_W = VIEW_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = VIEW_H - PAD_TOP - PAD_BOTTOM;

export default function IncomeExpenseBarChart({ points, currency }: IncomeExpenseBarChartProps) {
  if (points.length === 0) {
    return <div className={styles.empty}>Sem dados suficientes para o gráfico ainda.</div>;
  }

  const maxValue = Math.max(1, ...points.flatMap(p => [p.income, p.expense]));
  const groupWidth = PLOT_W / points.length;
  const barWidth = Math.min(18, groupWidth * 0.32);

  return (
    <div className={styles.wrap}>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchIncome}`} /> Receita
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchExpense}`} /> Despesa
        </span>
      </div>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={styles.svg} role="img" aria-label="Receita vs. despesa por mês">
        <line x1={PAD_LEFT} x2={VIEW_W - PAD_RIGHT} y1={PAD_TOP + PLOT_H} y2={PAD_TOP + PLOT_H} className={styles.baseline} />
        {points.map((p, i) => {
          const groupCenter = PAD_LEFT + groupWidth * (i + 0.5);
          const incomeH = (p.income / maxValue) * PLOT_H;
          const expenseH = (p.expense / maxValue) * PLOT_H;
          return (
            <g key={p.month}>
              <title>
                {formatMonthLabel(p.month)} · Receita: {formatMoney(p.income, currency)} · Despesa: {formatMoney(p.expense, currency)}
              </title>
              <rect
                x={groupCenter - barWidth - 2}
                y={PAD_TOP + PLOT_H - incomeH}
                width={barWidth}
                height={Math.max(0, incomeH)}
                className={barStyles.barIncome}
              />
              <rect
                x={groupCenter + 2}
                y={PAD_TOP + PLOT_H - expenseH}
                width={barWidth}
                height={Math.max(0, expenseH)}
                className={barStyles.barExpense}
              />
              <text x={groupCenter} y={VIEW_H - 6} textAnchor="middle" className={styles.xLabel}>
                {formatMonthLabel(p.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
