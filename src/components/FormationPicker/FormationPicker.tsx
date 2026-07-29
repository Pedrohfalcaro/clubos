import {
  FORMATION_FAMILIES,
  getFormationFamily,
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
  const family = getFormationFamily(value);
  const hasVariants = family.variants.length > 1;

  return (
    <div className={styles.picker}>
      <div className={styles.head}>
        <span className={styles.label}>Formação</span>
        <span className={styles.current}>
          {family.label}
          {hasVariants ? ` · ${selected.variantLabel}` : ''}
        </span>
      </div>

      {([4, 3, 5] as const).map(defenders => {
        const families = FORMATION_FAMILIES.filter(f => f.defenders === defenders);
        if (!families.length) return null;
        return (
          <div key={defenders} className={styles.group}>
            <span className={styles.groupLabel}>{defenders} defensores</span>
            <div className={styles.btns}>
              {families.map(f => {
                const active = family.id === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    className={`${styles.btn} ${active ? styles.btnActive : ''}`}
                    onClick={() => {
                      if (active) return;
                      const keepVariant = f.variants.find(v => v.variantLabel === selected.variantLabel);
                      onChange((keepVariant ?? f.variants[0]).key);
                    }}
                    title={f.variants[0].description}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {hasVariants && (
        <div className={styles.variants}>
          <span className={styles.variantsLabel}>Variante</span>
          <div className={styles.variantBtns}>
            {family.variants.map(variant => (
              <button
                key={variant.key}
                type="button"
                className={`${styles.variantBtn} ${value === variant.key ? styles.variantActive : ''}`}
                onClick={() => onChange(variant.key)}
                title={variant.description}
              >
                {variant.variantLabel}
              </button>
            ))}
          </div>
        </div>
      )}

      {showDescription && <p className={styles.desc}>{selected.description}</p>}
    </div>
  );
}
