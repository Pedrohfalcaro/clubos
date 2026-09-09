import stepStyles from '../../../MatchPlay/steps/steps.module.css';

interface PlayerRatingStepProps {
  selfName: string;
  rating: number | '';
  onRatingChange: (rating: number | '') => void;
}

export default function PlayerRatingStep({ selfName, rating, onRatingChange }: PlayerRatingStepProps) {
  return (
    <div className={stepStyles.wrap}>
      <p className={stepStyles.hint}>Como você avalia sua atuação nesta partida?</p>
      <div className={stepStyles.field}>
        <label>Sua nota — {selfName} (1–10)</label>
        <input
          className={stepStyles.input}
          type="number"
          min={1}
          max={10}
          step={0.1}
          value={rating}
          onChange={e => onRatingChange(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="Ex: 7.5"
          style={{ maxWidth: 160 }}
        />
      </div>
    </div>
  );
}
