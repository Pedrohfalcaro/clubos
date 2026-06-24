import { useEffect, useState } from 'react';
import type { MatchLocation } from '../../types/Match';
import styles from './MatchScheduleModal.module.css';

interface MatchScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    opponent: string;
    date: string;
    location: MatchLocation;
    competition: string;
  }) => void;
  competitions: string[];
  initialDate?: string;
  initialData?: {
    opponent: string;
    date: string;
    location: MatchLocation;
    competition: string;
  };
  title?: string;
}

export default function MatchScheduleModal({
  open,
  onClose,
  onSubmit,
  competitions,
  initialDate,
  initialData,
  title = 'Agendar Partida',
}: MatchScheduleModalProps) {
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState(initialDate ?? new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState<MatchLocation>('home');
  const [competition, setCompetition] = useState(competitions[0] ?? '');

  useEffect(() => {
    if (open) {
      setOpponent(initialData?.opponent ?? '');
      setDate(initialData?.date ?? initialDate ?? new Date().toISOString().split('T')[0]);
      setLocation(initialData?.location ?? 'home');
      setCompetition(initialData?.competition ?? competitions[0] ?? '');
    }
  }, [open, initialData, initialDate, competitions]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!opponent.trim() || !competition) return;
    onSubmit({ opponent: opponent.trim(), date, location, competition });
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>{title}</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Adversário</label>
            <input
              value={opponent}
              onChange={e => setOpponent(e.target.value)}
              placeholder="Nome do adversário"
              required
            />
          </div>
          <div className={styles.field}>
            <label>Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className={styles.field}>
            <label>Local</label>
            <select value={location} onChange={e => setLocation(e.target.value as MatchLocation)}>
              <option value="home">Em Casa</option>
              <option value="away">Fora de Casa</option>
              <option value="neutral">Neutro</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>Competição</label>
            <select value={competition} onChange={e => setCompetition(e.target.value)} required>
              {competitions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.submitBtn}>Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
