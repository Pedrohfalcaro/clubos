import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame, allTeams } from '../../context/GameContext';
import styles from './Setup.module.css';

export default function ManagerSetup() {
  const { state, setManager } = useGame();
  const navigate = useNavigate();
  const team = allTeams.find(t => t.id === state.pendingTeamId);

  const [name, setName] = useState('');
  const [nationality, setNationality] = useState('Brasil');
  const [age, setAge] = useState(35);

  if (!state.pendingTeamId || !team) {
    navigate('/');
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setManager({ name: name.trim(), nationality: nationality.trim(), age });
    navigate('/setup/competitions');
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.step}>Passo 2 de 3</p>
        <h1 className={styles.title}>Criar Manager</h1>
        <p className={styles.sub}>
          Você assumirá o comando do <strong>{team.name}</strong>
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Nome do Manager</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Seu nome"
              required
            />
          </div>
          <div className={styles.field}>
            <label>Nacionalidade</label>
            <input
              value={nationality}
              onChange={e => setNationality(e.target.value)}
              placeholder="Ex: Brasil"
              required
            />
          </div>
          <div className={styles.field}>
            <label>Idade</label>
            <input
              type="number"
              min={25}
              max={75}
              value={age}
              onChange={e => setAge(Number(e.target.value))}
            />
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.backBtn} onClick={() => navigate('/')}>
              Voltar
            </button>
            <button type="submit" className={styles.nextBtn}>Continuar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
