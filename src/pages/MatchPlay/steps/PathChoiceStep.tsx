import styles from './steps.module.css';

interface PathChoiceStepProps {
  opponentName: string;
  onOpponent: () => void;
  onEvents: () => void;
}

export default function PathChoiceStep({
  opponentName,
  onOpponent,
  onEvents,
}: PathChoiceStepProps) {
  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>O que deseja registrar agora?</p>
      <div className={styles.pathGrid}>
        <button type="button" className={styles.pathCard} onClick={onOpponent}>
          <span className={styles.pathIcon}>⚽</span>
          <h3 className={styles.pathTitle}>Gols de {opponentName}</h3>
          <p className={styles.pathDesc}>
            Informe quem marcou e, se quiser, a assistência do adversário.
          </p>
        </button>
        <button type="button" className={styles.pathCard} onClick={onEvents}>
          <span className={styles.pathIcon}>📋</span>
          <h3 className={styles.pathTitle}>Incidências</h3>
          <p className={styles.pathDesc}>
            Cartões, lesões e substituições do seu time.
          </p>
        </button>
      </div>
    </div>
  );
}
