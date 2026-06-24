import type { MatchMinute } from '../../types/Match';
import { STOPPAGE_BASES } from '../../utils/matchEvents';
import styles from './MinuteInput.module.css';

interface MinuteInputProps {
  value: MatchMinute;
  onChange: (value: MatchMinute) => void;
}

export default function MinuteInput({ value, onChange }: MinuteInputProps) {
  const showStoppage = STOPPAGE_BASES.includes(value.base as typeof STOPPAGE_BASES[number]);

  return (
    <div className={styles.row}>
      <input
        type="number"
        className={styles.minute}
        min={1}
        max={120}
        value={value.base}
        onChange={e => {
          const base = Math.min(120, Math.max(1, Number(e.target.value) || 1));
          onChange({
            base,
            stoppage: STOPPAGE_BASES.includes(base as typeof STOPPAGE_BASES[number]) ? value.stoppage : undefined,
          });
        }}
        title="Minuto"
      />
      <span className={styles.tick}>'</span>
      {showStoppage && (
        <div className={styles.stoppage}>
          <span className={styles.plus}>+</span>
          <input
            type="number"
            className={styles.stoppageInput}
            min={0}
            max={15}
            value={value.stoppage ?? ''}
            placeholder="0"
            onChange={e => {
              const v = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value));
              onChange({ ...value, stoppage: v });
            }}
          />
        </div>
      )}
    </div>
  );
}
