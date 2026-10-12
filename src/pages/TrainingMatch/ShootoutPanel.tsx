import { useEffect, useState } from 'react';
import type { ShootoutResult } from '../../training/engine';
import base from './TrainingMatch.module.css';
import styles from './ShootoutPanel.module.css';

interface Props {
  result: ShootoutResult;
  nameA: string;
  nameB: string;
  nameOf: (playerId: string) => string;
  onDone: () => void;
}

const STEP_MS = 1300;

/** Decisão por pênaltis: as cobranças aparecem uma a uma, intercaladas, até sair o vencedor. */
export default function ShootoutPanel({ result, nameA, nameB, nameOf, onDone }: Props) {
  const total = result.kicks.length;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (shown >= total) return;
    const id = window.setTimeout(() => setShown(n => n + 1), STEP_MS);
    return () => window.clearTimeout(id);
  }, [shown, total]);

  const visible = result.kicks.slice(0, shown);
  const score = { a: 0, b: 0 };
  for (const k of visible) if (k.scored) score[k.team] += 1;
  const over = shown >= total;
  const last = visible[visible.length - 1];

  return (
    <div className={base.overlay}>
      <div className={`${base.card} ${styles.panel}`}>
        <h2>Pênaltis</h2>
        <p className={base.final}>
          {nameA} <b>{score.a}</b> x <b>{score.b}</b> {nameB}
        </p>

        <div className={styles.columns}>
          {(['a', 'b'] as const).map(team => (
            <ol key={team} className={styles.list}>
              <li className={styles.head}>{team === 'a' ? nameA : nameB}</li>
              {visible
                .filter(k => k.team === team)
                .map((k, i) => (
                  <li key={i} className={k.scored ? styles.goal : styles.miss}>
                    <span className={styles.mark}>{k.scored ? '⚽' : '✕'}</span>
                    <span className={styles.who}>{nameOf(k.playerId)}</span>
                    <em>{k.rating.toFixed(1)}</em>
                  </li>
                ))}
            </ol>
          ))}
        </div>

        <p className={styles.status}>
          {over
            ? `Vitória de ${result.winner === 'a' ? nameA : nameB} nos pênaltis (${result.score.a} x ${result.score.b})`
            : last
              ? `${nameOf(last.playerId)} ${last.scored ? 'converteu' : 'perdeu'}${last.sudden ? ' · cobranças alternadas' : ''}`
              : 'Primeira cobrança…'}
        </p>

        <div className={base.row}>
          {!over && (
            <button type="button" className={base.ghostBtn} onClick={() => setShown(total)}>
              Pular
            </button>
          )}
          {over && (
            <button type="button" className={base.primaryBtn} onClick={onDone}>
              Continuar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
