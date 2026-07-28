import styles from './steps.module.css';

interface ScoreStepProps {
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  onHomeGoalsChange: (v: number) => void;
  onAwayGoalsChange: (v: number) => void;
}

export default function ScoreStep({
  homeTeam,
  awayTeam,
  homeGoals,
  awayGoals,
  onHomeGoalsChange,
  onAwayGoalsChange,
}: ScoreStepProps) {
  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>Informe o placar final da partida.</p>
      <div className={styles.scoreBoard}>
        <div className={styles.teamCol}>
          <p className={styles.teamLabel}>Casa</p>
          <p className={styles.teamName}>{homeTeam}</p>
        </div>
        <div className={styles.scoreCenter}>
          <input
            className={styles.scoreInput}
            type="number"
            min={0}
            max={30}
            value={homeGoals}
            onChange={e => onHomeGoalsChange(Math.max(0, Number(e.target.value) || 0))}
            aria-label={`Gols ${homeTeam}`}
          />
          <span className={styles.scoreSep}>–</span>
          <input
            className={styles.scoreInput}
            type="number"
            min={0}
            max={30}
            value={awayGoals}
            onChange={e => onAwayGoalsChange(Math.max(0, Number(e.target.value) || 0))}
            aria-label={`Gols ${awayTeam}`}
          />
        </div>
        <div className={styles.teamCol}>
          <p className={styles.teamLabel}>Visitante</p>
          <p className={styles.teamName}>{awayTeam}</p>
        </div>
      </div>
    </div>
  );
}
