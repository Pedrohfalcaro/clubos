import {
  FORMATION_GROUPS,
  NATURE_LABELS,
  getFormationPreset,
  type FormationKey,
} from '../../utils/formations';
import styles from './FormationPicker.module.css';

interface FormationPickerProps {
  value: FormationKey;
  onChange: (key: FormationKey) => void;
  showDescription?: boolean;
}

export default function FormationPicker({
  value,
  onChange,
  showDescription = true,
}: FormationPickerProps) {
  const selected = getFormationPreset(value);

  return (
    <div className={styles.picker}>
      <div className={styles.head}>
        <span className={styles.label}>Formação</span>
        <span className={styles.nature} data-nature={selected.nature}>
          {NATURE_LABELS[selected.nature]}
        </span>
      </div>

      {FORMATION_GROUPS.map(group => (
        <div key={group.label} className={styles.group}>
          <span className={styles.groupLabel}>{group.label}</span>
          <div className={styles.btns}>
            {group.presets.map(preset => (
              <button
                key={preset.key}
                type="button"
                className={`${styles.btn} ${value === preset.key ? styles.btnActive : ''}`}
                onClick={() => onChange(preset.key)}
                title={preset.description}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {showDescription && <p className={styles.desc}>{selected.description}</p>}
    </div>
  );
}
