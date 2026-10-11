import { useState } from 'react';
import { MAX_KITS, createSolidKit, type Kit } from '../../types/Kit';
import KitEditorModal from './KitEditorModal';
import KitPreview from './KitPreview';
import styles from './KitsSection.module.css';

interface KitsSectionProps {
  /** Uniformes já resolvidos (sempre 2 ou 3). */
  kits: Kit[];
  /** Chamado ao salvar/remover: recebe a lista completa. */
  onChange: (kits: Kit[]) => void;
}

const LABELS = ['Uniforme 1', 'Uniforme 2', 'Uniforme 3'];

/** "Editar uniformes": os quadrados dos uniformes e o "+" para adicionar o terceiro. */
export default function KitsSection({ kits, onChange }: KitsSectionProps) {
  const [editing, setEditing] = useState<{ index: number; draft: Kit } | null>(null);

  function save(kit: Kit) {
    if (!editing) return;
    const next = [...kits];
    next[editing.index] = kit;
    onChange(next);
    setEditing(null);
  }

  function remove() {
    if (!editing || editing.index < 2) return;
    onChange(kits.filter((_, i) => i !== editing.index));
    setEditing(null);
  }

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <p className={styles.title}>Uniformes</p>
        <p className={styles.sub}>
          Independentes das cores do clube. O 1º e o 2º uniforme aparecem nos treinos (Time A e Time B).
        </p>
      </div>
      <div className={styles.slots}>
        {kits.map((kit, i) => (
          <button
            key={kit.id}
            type="button"
            className={styles.slot}
            onClick={() => setEditing({ index: i, draft: kit })}
            title={`Editar ${LABELS[i]}`}
          >
            <KitPreview kit={kit} size={84} />
            <span>{LABELS[i]}</span>
          </button>
        ))}
        {kits.length < MAX_KITS && (
          <button
            type="button"
            className={`${styles.slot} ${styles.add}`}
            onClick={() => setEditing({ index: kits.length, draft: createSolidKit('#222222') })}
            title="Adicionar terceiro uniforme"
          >
            <span className={styles.plus}>+</span>
            <span>Adicionar</span>
          </button>
        )}
      </div>

      {editing && (
        <KitEditorModal
          // chave diferente por abertura: reinicia o estado do editor
          key={`${editing.index}-${editing.draft.id}`}
          kit={editing.draft}
          title={`Editar ${LABELS[editing.index]}`}
          onSave={save}
          onClose={() => setEditing(null)}
          onDelete={editing.index >= 2 && kits[editing.index] ? remove : undefined}
        />
      )}
    </div>
  );
}
