import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame, allTeams } from '../../context/GameContext';
import { AVAILABLE_COMPETITIONS } from '../../utils/formations';
import styles from './Setup.module.css';

export default function CompetitionsSetup() {
  const { state, startCareer } = useGame();
  const navigate = useNavigate();
  const team = allTeams.find(t => t.id === state.pendingTeamId);

  const [selected, setSelected] = useState<string[]>(['Campeonato Brasileiro']);

  if (!state.pendingTeamId || !state.manager || !team) {
    navigate('/');
    return null;
  }

  function toggle(comp: string) {
    setSelected(prev =>
      prev.includes(comp) ? prev.filter(c => c !== comp) : [...prev, comp],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0) return;
    startCareer(selected);
    navigate('/dashboard');
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.step}>Passo 3 de 3</p>
        <h1 className={styles.title}>Competições da Temporada</h1>
        <p className={styles.sub}>
          Selecione as competições que o <strong>{team.name}</strong> disputará em {state.season}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.compGrid}>
            {AVAILABLE_COMPETITIONS.map(comp => (
              <button
                key={comp}
                type="button"
                className={`${styles.compBtn} ${selected.includes(comp) ? styles.compBtnActive : ''}`}
                onClick={() => toggle(comp)}
              >
                {comp}
              </button>
            ))}
          </div>

          {selected.length === 0 && (
            <p className={styles.error}>Selecione ao menos uma competição</p>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.backBtn} onClick={() => navigate('/setup/manager')}>
              Voltar
            </button>
            <button type="submit" className={styles.nextBtn} disabled={selected.length === 0}>
              Iniciar Carreira
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
