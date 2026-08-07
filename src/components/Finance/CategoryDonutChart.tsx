import type { Currency } from '../../types/Finance';
import { formatMoney } from '../../utils/finance';
import type { CategoryBreakdownEntry } from '../../utils/financeAnalytics';
import { CATEGORY_META, CATEGORY_ORDER } from './categoryMeta';
import styles from '../../pages/Finance/Finance.module.css';
import chartStyles from './CategoryDonutChart.module.css';

interface CategoryDonutChartProps {
  groups: CategoryBreakdownEntry[];
  total: number;
  currency: Currency;
}

const SIZE = 140;
const CENTER = SIZE / 2;
const RADIUS = 52;
const STROKE = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function CategoryDonutChart({ groups, total, currency }: CategoryDonutChartProps) {
  if (total <= 0) {
    return <div className={styles.emptyState}>Nenhuma despesa no período selecionado.</div>;
  }

  const ordered = CATEGORY_ORDER.map(
    group => groups.find(g => g.group === group) ?? { group, total: 0 },
  ).filter(g => g.total > 0);

  // Sem variável acumuladora mutável (fração anterior recalculada por item —
  // `ordered` tem no máximo 5 elementos, custo irrelevante).
  const segments = ordered.map((g, i) => {
    const fraction = g.total / total;
    const priorFraction = ordered.slice(0, i).reduce((sum, x) => sum + x.total, 0) / total;
    return {
      ...g,
      fraction,
      dash: fraction * CIRCUMFERENCE,
      offset: -priorFraction * CIRCUMFERENCE,
    };
  });

  return (
    <div className={chartStyles.wrap}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={chartStyles.svg} role="img" aria-label="Despesas por categoria">
        <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="var(--border)"
            strokeWidth={STROKE}
          />
          {segments.map(s => (
            <circle
              key={s.group}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={CATEGORY_META[s.group].color}
              strokeWidth={STROKE}
              strokeDasharray={`${s.dash} ${CIRCUMFERENCE - s.dash}`}
              strokeDashoffset={s.offset}
            >
              <title>
                {CATEGORY_META[s.group].label}: {formatMoney(s.total, currency)} ({(s.fraction * 100).toFixed(0)}%)
              </title>
            </circle>
          ))}
        </g>
        <text x={CENTER} y={CENTER - 4} textAnchor="middle" className={chartStyles.centerValue}>
          {formatMoney(total, currency)}
        </text>
        <text x={CENTER} y={CENTER + 14} textAnchor="middle" className={chartStyles.centerLabel}>
          total
        </text>
      </svg>

      <ul className={chartStyles.legend}>
        {segments.map(s => (
          <li key={s.group} className={chartStyles.legendItem}>
            <span className={chartStyles.dot} style={{ background: CATEGORY_META[s.group].color }} />
            <span className={chartStyles.legendLabel}>{CATEGORY_META[s.group].label}</span>
            <span className={chartStyles.legendValue}>{(s.fraction * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
