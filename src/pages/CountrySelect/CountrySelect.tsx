import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import styles from '../Setup/Setup.module.css';

export default function CountrySelect() {
  const navigate = useNavigate();
  const { setCoachCountry } = useGame();
  const [country, setCountry] = useState('Brasil');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!country.trim()) return;
    setCoachCountry(country.trim());
    navigate('/new/team');
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.step}>Treinador</p>
        <h1 className={styles.title}>País da carreira</h1>
        <p className={styles.sub}>Digite o país onde deseja iniciar sua carreira</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>País</label>
            <input
              value={country}
              onChange={e => setCountry(e.target.value)}
              placeholder="Ex: Brasil"
              required
            />
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.backBtn} onClick={() => navigate('/new/mode')}>
              Voltar
            </button>
            <button type="submit" className={styles.nextBtn}>Continuar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
