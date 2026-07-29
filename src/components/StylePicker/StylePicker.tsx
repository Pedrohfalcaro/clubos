import type { FormationKey, TacticalStyleKey } from '../../types/Tactics';
import {
  TACTICAL_STYLES,
  TRAIT_LABELS,
  getTacticalStyle,
  styleFitsFormation,
} from '../../utils/tacticalStyles';
import { formationLabel } from '../../utils/formations';
import styles from './StylePicker.module.css';

interface StylePickerProps {
  value: TacticalStyleKey;
  onChange: (key: TacticalStyleKey) => void;
  formationKey: FormationKey;
  /** Esconde o detalhamento do estilo — para telas com muito conteúdo */
  compact?: boolean;
}

export default function StylePicker({
  value,
  onChange,
  formationKey,
  compact = false,
}: StylePickerProps) {
  const selected = getTacticalStyle(value);
  const fits = styleFitsFormation(value, formationKey);

  return (
    <div className={styles.picker}>
      <div className={styles.head}>
        <span className={styles.label}>Estilo de jogo</span>
        <span className={styles.hint}>
          {fits
            ? `Combina com o ${formationLabel(formationKey)}`
            : `Pouco usual no ${formationLabel(formationKey)}`}
        </span>
      </div>

      <div className={styles.grid}>
        {TACTICAL_STYLES.map(style => {
          const recommended = style.bestWith.includes(formationKey);
          return (
            <button
              key={style.key}
              type="button"
              className={`${styles.card} ${value === style.key ? styles.cardActive : ''}`}
              onClick={() => onChange(style.key)}
            >
              <span className={styles.cardTop}>
                <span className={styles.cardTitle}>{style.label}</span>
                {recommended && <span className={styles.badge}>combina</span>}
              </span>
              <span className={styles.cardTagline}>{style.tagline}</span>
            </button>
          );
        })}
      </div>

      {compact ? (
        <p className={styles.compactText}>{selected.description}</p>
      ) : (
        <div className={styles.details}>
          <p className={styles.detailsText}>{selected.description}</p>

          <div className={styles.traits}>
            {TRAIT_LABELS.map(trait => (
              <div key={trait.key} className={styles.trait}>
                <span className={styles.traitLabel}>{trait.label}</span>
                <span className={styles.traitBar} aria-hidden>
                  {[1, 2, 3, 4, 5].map(step => (
                    <span
                      key={step}
                      className={`${styles.traitStep} ${
                        step <= selected.traits[trait.key] ? styles.traitStepOn : ''
                      }`}
                    />
                  ))}
                </span>
                <span className={styles.traitValue}>{selected.traits[trait.key]}/5</span>
              </div>
            ))}
          </div>

          <ul className={styles.instructions}>
            {selected.instructions.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
