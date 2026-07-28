import type { OpponentGoalEntry } from '../../../types/Match';
import MinuteInput from '../../../components/MinuteInput/MinuteInput';
import styles from './steps.module.css';

interface OpponentGoalsStepProps {
  opponentName: string;
  goals: OpponentGoalEntry[];
  onChange: (g: OpponentGoalEntry[]) => void;
}

export default function OpponentGoalsStep({
  opponentName,
  goals,
  onChange,
}: OpponentGoalsStepProps) {
  function update(index: number, patch: Partial<OpponentGoalEntry>) {
    onChange(goals.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        Gols de <strong>{opponentName}</strong>. Digite o nome e o minuto.
      </p>
      <div className={styles.goalList}>
        {goals.map((g, index) => (
          <div key={g.id} className={styles.goalCard}>
            <div className={styles.goalHead}>
              <span className={styles.goalIndex}>Gol {index + 1}</span>
            </div>
            <div className={`${styles.fields} ${styles.fieldsWide}`}>
              <div className={styles.field}>
                <label>Autor</label>
                <input
                  className={styles.input}
                  value={g.scorerName}
                  onChange={e => update(index, { scorerName: e.target.value })}
                  placeholder="Nome do jogador"
                />
              </div>
              <div className={styles.field}>
                <label>Assistência</label>
                <input
                  className={styles.input}
                  value={g.assistName ?? ''}
                  onChange={e => update(index, { assistName: e.target.value || undefined })}
                  placeholder="Opcional"
                />
              </div>
              <div className={styles.field}>
                <label>Minuto</label>
                <MinuteInput value={g.minute} onChange={m => update(index, { minute: m })} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
