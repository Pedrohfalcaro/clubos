import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import { hasSave } from '../../services/storage';
import Tutorial from '../../components/Tutorial/Tutorial';
import { WELCOME_TUTORIAL, hasSeenWelcome, markWelcomeSeen } from '../../utils/tutorials';
import styles from './MainMenu.module.css';

export default function MainMenu() {
  const navigate = useNavigate();
  const { loadSavedGame } = useGame();
  const canLoad = hasSave();
  const [showWelcome, setShowWelcome] = useState(() => !hasSeenWelcome());

  function handleLoad() {
    if (!canLoad) return;
    loadSavedGame();
    navigate('/dashboard');
  }

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.logo}>⬡</div>
        <h1 className={styles.title}>ClubOS</h1>

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => navigate('/new/country')}>
            Começar
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={handleLoad}
            disabled={!canLoad}
          >
            Carregar
          </button>
        </div>

        {!canLoad && (
          <p className={styles.hint}>Nenhum save encontrado. Inicie uma nova carreira.</p>
        )}
      </div>

      {showWelcome && (
        <Tutorial
          steps={WELCOME_TUTORIAL}
          onComplete={() => {
            markWelcomeSeen();
            setShowWelcome(false);
          }}
        />
      )}
    </div>
  );
}
