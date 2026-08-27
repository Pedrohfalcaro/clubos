import { useState } from 'react';
import ClubCrest from '../ClubCrest/ClubCrest';
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY } from '../../utils/clubColors';
import styles from './NationalOnboarding.module.css';

export interface NationalOnboardingInput {
  name: string;
  primaryColor?: string;
  secondaryColor?: string;
  startingFifaRanking?: number;
}

export interface NationalOnboardingProps {
  onSubmit: (input: NationalOnboardingInput) => void;
  onCancel: () => void;
}

export default function NationalOnboarding({ onSubmit, onCancel }: NationalOnboardingProps) {
  const [name, setName] = useState('');
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY);
  const [ranking, setRanking] = useState('50');

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0;

  function submit() {
    if (!canSubmit) return;
    const parsedRanking = parseInt(ranking, 10);
    onSubmit({
      name: trimmedName,
      primaryColor,
      secondaryColor,
      startingFifaRanking: Number.isFinite(parsedRanking) && parsedRanking > 0 ? parsedRanking : undefined,
    });
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <p className={styles.title}>Assumir uma Seleção Nacional</p>
        <p className={styles.subtitle}>
          Dual Career — comande o clube e a seleção ao mesmo tempo.
        </p>

        <div className={styles.preview}>
          <ClubCrest primary={primaryColor} secondary={secondaryColor} size={48} title={trimmedName || 'Seleção'} />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Nome da seleção</label>
          <input
            className={styles.formInput}
            type="text"
            placeholder="ex.: Seleção Brasileira"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className={styles.row}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Cor primária</label>
            <input
              className={styles.formColor}
              type="color"
              value={primaryColor}
              onChange={e => setPrimaryColor(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Cor secundária</label>
            <input
              className={styles.formColor}
              type="color"
              value={secondaryColor}
              onChange={e => setSecondaryColor(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ranking FIFA inicial</label>
            <input
              className={styles.formInput}
              type="number"
              min={1}
              max={210}
              value={ranking}
              onChange={e => setRanking(e.target.value)}
            />
          </div>
        </div>
        <span className={styles.hint}>
          Ranking simplificado — só a sua seleção sobe/desce por resultado, não simula as outras.
        </span>

        <div className={styles.actions}>
          <button type="button" className={styles.btnSecondary} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={styles.btnPrimary} onClick={submit} disabled={!canSubmit}>
            Criar Seleção
          </button>
        </div>
      </div>
    </div>
  );
}
