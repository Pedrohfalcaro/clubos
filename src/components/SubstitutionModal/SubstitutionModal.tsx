import { useState } from 'react';
import type { MatchMinute } from '../../types/Match';
import MinuteInput from '../MinuteInput/MinuteInput';
import SearchableSelect from '../SearchableSelect/SearchableSelect';
import { defaultMinute } from '../../utils/matchEvents';
import styles from './SubstitutionModal.module.css';

interface PlayerOption {
  id: string;
  name: string;
}

interface SubstitutionModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: (data: { playerInId: string; playerOutId: string; minute: MatchMinute }) => void;
  playerIn: PlayerOption;
  onFieldOptions: PlayerOption[];
  required?: boolean;
}

export default function SubstitutionModal({
  open,
  title,
  onClose,
  onConfirm,
  playerIn,
  onFieldOptions,
  required,
}: SubstitutionModalProps) {
  const [playerOutId, setPlayerOutId] = useState('');
  const [minute, setMinute] = useState<MatchMinute>(defaultMinute());

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!playerOutId) return;
    onConfirm({ playerInId: playerIn.id, playerOutId, minute });
    setPlayerOutId('');
    setMinute(defaultMinute());
  }

  return (
    <div className={styles.overlay} onClick={required ? undefined : onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.sub}>
          <strong>{playerIn.name}</strong> precisa entrar em campo. Registre a substituição.
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Sai</label>
            <SearchableSelect
              options={onFieldOptions.filter(p => p.id !== playerIn.id).map(p => ({ value: p.id, label: p.name }))}
              value={playerOutId}
              onChange={setPlayerOutId}
              placeholder="Quem sai..."
            />
          </div>
          <div className={styles.field}>
            <label>Minuto</label>
            <MinuteInput value={minute} onChange={setMinute} />
          </div>
          <div className={styles.actions}>
            {!required && (
              <button type="button" className={styles.cancel} onClick={onClose}>Cancelar</button>
            )}
            <button type="submit" className={styles.confirm} disabled={!playerOutId}>
              Confirmar Substituição
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
