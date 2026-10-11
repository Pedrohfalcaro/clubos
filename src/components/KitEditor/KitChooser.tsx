import type { Kit } from '../../types/Kit';
import KitPreview from './KitPreview';
import styles from './KitChooser.module.css';

interface KitChooserProps {
  kits: Kit[];
  /** id do uniforme escolhido */
  value: string;
  onChange: (kitId: string) => void;
  label?: string;
  size?: number;
}

/** Escolha de qual uniforme (1º, 2º ou 3º) usar — substitui a regra fixa de casa/fora. */
export default function KitChooser({ kits, value, onChange, label = 'Uniforme', size = 34 }: KitChooserProps) {
  return (
    <div className={styles.chooser} role="group" aria-label={label}>
      <span className={styles.label}>{label}</span>
      <div className={styles.options}>
        {kits.map((kit, i) => (
          <button
            key={kit.id}
            type="button"
            className={`${styles.option} ${kit.id === value ? styles.optionOn : ''}`}
            onClick={() => onChange(kit.id)}
            title={`Uniforme ${i + 1}`}
            aria-pressed={kit.id === value}
          >
            <KitPreview kit={kit} size={size} />
            <span>{i + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
