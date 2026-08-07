import type { Currency } from '../../types/Finance';
import { formatMoney } from '../../utils/finance';
import type { CashFlowProjectionPoint, MonthlyCashFlowPoint } from '../../utils/financeAnalytics';
import styles from './CashFlowChart.module.css';

export interface MonthTooltipInfo {
  topIncome?: { label: string; amount: number };
  topExpense?: { label: string; amount: number };
}

interface CashFlowChartProps {
  /** 6 meses, do mais antigo ao mais recente (ver `getMonthlyCashFlow`). */
  historyPoints: MonthlyCashFlowPoint[];
  /** 0–3 meses futuros; vazio quando a carreira não tem `currentDate` (LiveLife). */
  projectionPoints: CashFlowProjectionPoint[];
  currency: Currency;
  /** Maior receita/despesa por mês histórico, para o tooltip — calculado 1x pelo pai. */
  monthTooltips: Record<string, MonthTooltipInfo>;
}

const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const abbr = MONTH_ABBR[(month - 1 + 12) % 12] ?? '?';
  return `${abbr}/${String(year).slice(2)}`;
}

const VIEW_W = 640;
const VIEW_H = 220;
const PAD_LEFT = 12;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const PLOT_W = VIEW_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = VIEW_H - PAD_TOP - PAD_BOTTOM;

function buildPath(xs: number[], ys: number[], from: number, to: number): string {
  let d = '';
  for (let i = from; i <= to; i++) {
    d += `${i === from ? 'M' : 'L'}${xs[i].toFixed(1)},${ys[i].toFixed(1)} `;
  }
  return d.trim();
}

export default function CashFlowChart({
  historyPoints,
  projectionPoints,
  currency,
  monthTooltips,
}: CashFlowChartProps) {
  const historyLen = historyPoints.length;
  const points = [
    ...historyPoints.map(p => ({ month: p.month, income: p.income, expense: p.expense })),
    ...projectionPoints.map(p => ({ month: p.month, income: p.projectedIncome, expense: p.projectedExpense })),
  ];

  if (points.length === 0) {
    return <div className={styles.empty}>Sem dados suficientes para o gráfico ainda.</div>;
  }

  const maxValue = Math.max(1, ...points.flatMap(p => [p.income, p.expense]));

  const xs = points.map((_, i) =>
    points.length > 1 ? PAD_LEFT + (i * PLOT_W) / (points.length - 1) : PAD_LEFT + PLOT_W / 2,
  );
  const yFor = (v: number) => PAD_TOP + PLOT_H * (1 - v / maxValue);
  const incomeYs = points.map(p => yFor(p.income));
  const expenseYs = points.map(p => yFor(p.expense));
  const baselineY = yFor(0);

  const hasProjection = projectionPoints.length > 0;
  const lastHistoryIdx = Math.max(0, historyLen - 1);

  return (
    <div className={styles.wrap}>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchIncome}`} /> Receita
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchExpense}`} /> Despesa
        </span>
        {hasProjection && (
          <span className={styles.legendItem}>
            <span className={`${styles.swatch} ${styles.swatchProjected}`} /> Projeção
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={styles.svg} role="img" aria-label="Fluxo de caixa mensal">
        <line
          x1={PAD_LEFT}
          x2={VIEW_W - PAD_RIGHT}
          y1={baselineY}
          y2={baselineY}
          className={styles.baseline}
        />

        {historyLen > 1 && (
          <path d={buildPath(xs, incomeYs, 0, lastHistoryIdx)} className={styles.lineIncome} />
        )}
        {historyLen > 1 && (
          <path d={buildPath(xs, expenseYs, 0, lastHistoryIdx)} className={styles.lineExpense} />
        )}

        {hasProjection && points.length > historyLen && (
          <>
            <path
              d={buildPath(xs, incomeYs, lastHistoryIdx, points.length - 1)}
              className={`${styles.lineIncome} ${styles.projected}`}
            />
            <path
              d={buildPath(xs, expenseYs, lastHistoryIdx, points.length - 1)}
              className={`${styles.lineExpense} ${styles.projected}`}
            />
          </>
        )}

        {points.map((p, i) => {
          const projected = i >= historyLen;
          const info = monthTooltips[p.month];
          const titleLines = [
            formatMonthLabel(p.month) + (projected ? ' (projeção)' : ''),
            `Receita: ${formatMoney(p.income, currency)}`,
            `Despesa: ${formatMoney(p.expense, currency)}`,
          ];
          if (!projected && info?.topIncome) {
            titleLines.push(`Maior entrada: ${info.topIncome.label} (${formatMoney(info.topIncome.amount, currency)})`);
          }
          if (!projected && info?.topExpense) {
            titleLines.push(`Maior saída: ${info.topExpense.label} (${formatMoney(info.topExpense.amount, currency)})`);
          }
          return (
            <g key={p.month} className={projected ? styles.projected : undefined}>
              <title>{titleLines.join('\n')}</title>
              <circle cx={xs[i]} cy={incomeYs[i]} r={3.5} className={styles.dotIncome} />
              <circle cx={xs[i]} cy={expenseYs[i]} r={3.5} className={styles.dotExpense} />
              <text x={xs[i]} y={VIEW_H - 8} className={styles.xLabel} textAnchor="middle">
                {formatMonthLabel(p.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
