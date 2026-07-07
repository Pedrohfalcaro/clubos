import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import styles from './CareerModeSelect.module.css';

export default function CareerModeSelect() {
  const { selectCareerMode } = useGame();
  const navigate = useNavigate();

  function chooseCoach() {
    selectCareerMode('coach');
    navigate('/new/country');
  }

  function choosePlayer() {
    selectCareerMode('player');
    navigate('/new/player');
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Escolha sua carreira</h1>
        <p className={styles.sub}>Como você quer viver sua jornada no futebol?</p>

        <div className={styles.modes}>
          <button type="button" className={styles.modeBtn} onClick={chooseCoach}>
            <span className={styles.modeIcon}>📋</span>
            <span className={styles.modeTitle}>Treinador</span>
            <span className={styles.modeDesc}>Gerencie o clube, elenco, táticas e resultados</span>
          </button>
          <button type="button" className={styles.modeBtn} onClick={choosePlayer}>
            <span className={styles.modeIcon}>⚽</span>
            <span className={styles.modeTitle}>Jogador</span>
            <span className={styles.modeDesc}>Viva sua carreira como atleta, registre seu desempenho</span>
          </button>
        </div>

        <button type="button" className={styles.backBtn} onClick={() => navigate('/menu')}>
          Voltar
        </button>
      </div>
    </div>
  );
}
