import styles from './KpiCard.module.css';

export type KpiTone = 'good' | 'warn' | 'bad';

interface KpiCardProps {
  label: string;
  value: string;
  /** Variação percentual vs. período/marco anterior. `null`/`undefined` = sem base de comparação. */
  deltaPercent?: number | null;
  /** Texto curto ao lado da variação, ex.: "vs. mês anterior". */
  deltaLabel?: string;
  /** Classificação de status do card (Margem, Runway). Sem status = card neutro. */
  tone?: KpiTone;
  toneLabel?: string;
  subtext?: string;
}

const DELTA_DEADZONE = 0.05;

export default function KpiCard({
  label,
  value,
  deltaPercent,
  deltaLabel,
  tone,
  toneLabel,
  subtext,
}: KpiCardProps) {
  const hasDelta = deltaPercent != null && Number.isFinite(deltaPercent);
  const direction = !hasDelta
    ? 'flat'
    : deltaPercent! > DELTA_DEADZONE
      ? 'up'
      : deltaPercent! < -DELTA_DEADZONE
        ? 'down'
        : 'flat';

  return (
    <div className={`${styles.card} ${tone ? styles[`tone-${tone}`] : ''}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      <div className={styles.footer}>
        {hasDelta ? (
          <span className={`${styles.delta} ${styles[`delta-${direction}`]}`}>
            {direction === 'up' ? '▲' : direction === 'down' ? '▼' : '＝'}{' '}
            {Math.abs(deltaPercent!).toFixed(1)}%
          </span>
        ) : (
          <span className={styles.deltaEmpty}>—</span>
        )}
        {deltaLabel && <span className={styles.deltaLabel}>{deltaLabel}</span>}
        {toneLabel && (
          <span className={`${styles.badge} ${tone ? styles[`badge-${tone}`] : ''}`}>{toneLabel}</span>
        )}
      </div>
      {subtext && <span className={styles.subtext}>{subtext}</span>}
    </div>
  );
}
