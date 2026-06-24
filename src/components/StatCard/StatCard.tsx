import styles from './StatCard.module.css';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  color?: 'default' | 'green' | 'red' | 'yellow';
}

export default function StatCard({ label, value, sub, accent, color = 'default' }: StatCardProps) {
  return (
    <div className={`${styles.card} ${accent ? styles.cardAccent : ''} ${styles[`color_${color}`]}`}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {sub && <p className={styles.sub}>{sub}</p>}
    </div>
  );
}
