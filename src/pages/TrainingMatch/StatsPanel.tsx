import type { Team, TeamStats } from '../../training/engine';
import styles from './TrainingMatch.module.css';

interface StatsPanelProps {
  stats: Record<Team, TeamStats>;
  kit: Record<Team, string>;
  teamName: Record<Team, string>;
}

function Row({
  label,
  a,
  b,
  share,
}: {
  label: string;
  a: string;
  b: string;
  /** parte (0–1) do time A, para a barra proporcional */
  share: number;
}) {
  return (
    <div className={styles.statRow}>
      <div className={styles.statVals}>
        <b>{a}</b>
        <span>{label}</span>
        <b>{b}</b>
      </div>
      <div className={styles.statBar}>
        <i style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
    </div>
  );
}

const frac = (a: number, b: number) => (a + b === 0 ? 0.5 : a / (a + b));

/** Bloco de estatísticas no canto da tela — liga e desliga pelo botão do topo. */
export default function StatsPanel({ stats, kit, teamName }: StatsPanelProps) {
  const { a, b } = stats;
  return (
    <aside className={styles.stats} aria-label="Estatísticas da partida">
      <div className={styles.statHead}>
        <span>
          <i className={styles.chip} style={{ background: kit.a }} />
          {teamName.a}
        </span>
        <span>
          {teamName.b}
          <i className={styles.chip} style={{ background: kit.b }} />
        </span>
      </div>
      <Row label="Finalizações (no alvo)" a={`${a.shots} (${a.shotsOn})`} b={`${b.shots} (${b.shotsOn})`} share={frac(a.shots, b.shots)} />
      <Row label="Posse de bola" a={`${a.possession}%`} b={`${b.possession}%`} share={a.possession / 100} />
      <Row label="Passes (certos)" a={`${a.passes} (${a.passesOk})`} b={`${b.passes} (${b.passesOk})`} share={frac(a.passes, b.passes)} />
      <Row label="Escanteios" a={String(a.corners)} b={String(b.corners)} share={frac(a.corners, b.corners)} />
      <Row label="Faltas" a={String(a.fouls)} b={String(b.fouls)} share={frac(a.fouls, b.fouls)} />
      <Row label="Impedimentos" a={String(a.offsides)} b={String(b.offsides)} share={frac(a.offsides, b.offsides)} />
      <Row
        label="Cartões (amarelo / vermelho)"
        a={`${a.yellows} / ${a.reds}`}
        b={`${b.yellows} / ${b.reds}`}
        share={frac(a.yellows + a.reds * 2, b.yellows + b.reds * 2)}
      />
    </aside>
  );
}
