import { FORMATION_PRESETS, type FormationKey } from '../../utils/formations';
import styles from './FormationPicker.module.css';

interface FormationPickerProps {
  value: FormationKey;
  onChange: (key: FormationKey) => void;
}

export default function FormationPicker({ value, onChange }: FormationPickerProps) {
  return (
    <div className={styles.picker}>
      <span className={styles.label}>Formação</span>
      <div className={styles.btns}>
        {FORMATION_PRESETS.map(p => (
          <button
            key={p.key}
            type="button"
            className={`${styles.btn} ${value === p.key ? styles.btnActive : ''}`}
            onClick={() => onChange(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
