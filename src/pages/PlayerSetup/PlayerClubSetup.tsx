import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import type { CareerPlayerStatus } from '../../types/CareerPlayer';
import styles from '../Setup/Setup.module.css';
import extra from './PlayerSetup.module.css';

const STATUSES: CareerPlayerStatus[] = ['Titular', 'Reserva', 'Promessa', 'Em recuperação'];

export default function PlayerClubSetup() {
  const { state, finishPlayerSetup } = useGame();
  const navigate = useNavigate();
  const playerName = state.pendingCareerPlayer?.name;

  const [clubName, setClubName] = useState('');
  const [league, setLeague] = useState('');
  const [mainCompetition, setMainCompetition] = useState('');
  const [country, setCountry] = useState('Brasil');
  const [status, setStatus] = useState<CareerPlayerStatus>('Reserva');
  const [salary, setSalary] = useState(0);
  const [contractYears, setContractYears] = useState(2);

  if (state.careerMode !== 'player' || !playerName) {
    navigate('/new/player');
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clubName.trim() || !league.trim() || !mainCompetition.trim() || !country.trim()) return;
    finishPlayerSetup({
      club: { name: clubName.trim(), league: league.trim(), country: country.trim() },
      status,
      salary,
      contractYearsLeft: contractYears,
      mainCompetition: mainCompetition.trim(),
    });
    navigate('/player/dashboard');
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.step}>Passo 2 de 2</p>
        <h1 className={styles.title}>Clube Atual</h1>
        <p className={styles.sub}>
          Informe o clube de <strong>{playerName}</strong> — digite como aparece no jogo
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Nome do clube</label>
            <input value={clubName} onChange={e => setClubName(e.target.value)} placeholder="Ex: Flamengo" required />
          </div>

          <div className={styles.field}>
            <label>Liga</label>
            <input value={league} onChange={e => setLeague(e.target.value)} placeholder="Ex: Brasileirão Série A" required />
          </div>

          <div className={styles.field}>
            <label>Competição principal</label>
            <input
              value={mainCompetition}
              onChange={e => setMainCompetition(e.target.value)}
              placeholder="Ex: Campeonato Brasileiro"
              required
            />
          </div>

          <div className={extra.fieldRow}>
            <div className={styles.field}>
              <label>País do clube</label>
              <input
                value={country}
                onChange={e => setCountry(e.target.value)}
                placeholder="Ex: Brasil"
                required
              />
            </div>
            <div className={`${styles.field} ${extra.field}`}>
              <label>Status no time</label>
              <select value={status} onChange={e => setStatus(e.target.value as CareerPlayerStatus)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className={extra.fieldRow}>
            <div className={styles.field}>
              <label>Salário mensal (R$)</label>
              <input type="number" min={0} value={salary} onChange={e => setSalary(Number(e.target.value))} />
            </div>
            <div className={`${styles.field} ${extra.field}`}>
              <label>Duração do contrato</label>
              <select value={contractYears} onChange={e => setContractYears(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>{y} {y === 1 ? 'ano' : 'anos'}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.backBtn} onClick={() => navigate('/new/player')}>Voltar</button>
            <button type="submit" className={styles.nextBtn}>Iniciar Carreira</button>
          </div>
        </form>
      </div>
    </div>
  );
}
