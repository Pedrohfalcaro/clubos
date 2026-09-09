import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../../../context/GameContext';
import { formatPlayerMoney } from '../../../utils/playerValue';
import shared from '../PlayerShared.module.css';
import styles from '../../Dashboard/Dashboard.module.css';
import extra from './PlayerContract.module.css';

export default function PlayerContract() {
  const { state, transferPlayer, updateCareerPlayer } = useGame();
  const player = state.careerPlayer;
  const [showTransfer, setShowTransfer] = useState(false);
  const [clubName, setClubName] = useState('');
  const [league, setLeague] = useState('');
  const [country, setCountry] = useState('Brasil');
  const [salary, setSalary] = useState(0);
  const [contractYears, setContractYears] = useState(2);

  const [editingExpectation, setEditingExpectation] = useState(false);
  const [goalsTarget, setGoalsTarget] = useState(player?.expectation.goalsTarget ?? 0);
  const [starterTarget, setStarterTarget] = useState(player?.expectation.starterAppearancesTarget ?? 0);

  const starterAppearances = useMemo(
    () => state.matches.filter(m => m.status === 'completed' && m.playerPerformance?.role === 'starter').length,
    [state.matches],
  );

  if (!player) return null;

  function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!clubName.trim() || !league.trim()) return;
    transferPlayer(
      { name: clubName.trim(), league: league.trim(), country },
      salary,
      contractYears,
    );
    setShowTransfer(false);
    setClubName('');
    setLeague('');
  }

  function handleSaveExpectation() {
    updateCareerPlayer({
      expectation: {
        goalsTarget: goalsTarget > 0 ? goalsTarget : undefined,
        starterAppearancesTarget: starterTarget > 0 ? starterTarget : undefined,
      },
    });
    setEditingExpectation(false);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Contrato</h1>
          <p className={styles.sub}>Clube atual e condições</p>
        </div>
        <button type="button" className={extra.transferBtn} onClick={() => setShowTransfer(!showTransfer)}>
          {showTransfer ? 'Cancelar' : '+ Transferência'}
        </button>
      </header>

      <div className={extra.contractGrid}>
        <div className={shared.contractCard}>
          <span className={shared.contractLabel}>Clube</span>
          <span className={shared.contractValue}>{player.currentClub.name}</span>
          <span className={shared.contractSub}>{player.currentClub.league} · {player.currentClub.country}</span>
        </div>
        <div className={shared.contractCard}>
          <span className={shared.contractLabel}>Salário mensal</span>
          <span className={shared.contractValue}>{formatPlayerMoney(player.salary)}</span>
        </div>
        <div className={shared.contractCard}>
          <span className={shared.contractLabel}>Anos restantes</span>
          <span className={shared.contractValue}>
            {player.contractYearsLeft > 0 ? player.contractYearsLeft : 'Expirado'}
          </span>
        </div>
        <div className={shared.contractCard}>
          <span className={shared.contractLabel}>Status no time</span>
          <span className={shared.contractValue}>{player.status}</span>
        </div>
        <div className={shared.contractCard}>
          <span className={shared.contractLabel}>Valor de mercado</span>
          <span className={shared.contractValue}>{formatPlayerMoney(player.marketValue)}</span>
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Relacionamentos</h2>
        <p className={styles.sub} style={{ margin: '0 0 12px' }}>
          Atualizados automaticamente com base nos resultados e no seu desempenho.{' '}
          <Link to="/player/relations">Ver histórico completo →</Link>
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div className={shared.confidenceBar}>
            <p className={shared.confidenceLabel}>Confiança do técnico</p>
            <div className={shared.confidenceTrack}>
              <div className={shared.confidenceFill} style={{ width: `${player.coachConfidence}%` }} />
            </div>
            <p className={shared.confidenceValue}>{player.coachConfidence}%</p>
          </div>
          <div className={shared.confidenceBar}>
            <p className={shared.confidenceLabel}>Reputação com a torcida</p>
            <div className={shared.confidenceTrack}>
              <div className={shared.confidenceFill} style={{ width: `${player.fanReputation}%` }} />
            </div>
            <p className={shared.confidenceValue}>{player.fanReputation}%</p>
          </div>
          <div className={shared.confidenceBar}>
            <p className={shared.confidenceLabel}>Moral</p>
            <div className={shared.confidenceTrack}>
              <div className={shared.confidenceFill} style={{ width: `${player.morale}%` }} />
            </div>
            <p className={shared.confidenceValue}>{player.morale}%</p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className={styles.sectionTitle}>Expectativa do clube</h2>
          <button type="button" className={extra.transferBtn} onClick={() => editingExpectation ? handleSaveExpectation() : setEditingExpectation(true)}>
            {editingExpectation ? 'Salvar' : 'Editar'}
          </button>
        </header>
        {editingExpectation ? (
          <div className={extra.fieldRow}>
            <div className={extra.field}>
              <label>Meta de gols na temporada</label>
              <input type="number" min={0} value={goalsTarget} onChange={e => setGoalsTarget(Number(e.target.value))} />
            </div>
            <div className={extra.field}>
              <label>Meta de jogos como titular</label>
              <input type="number" min={0} value={starterTarget} onChange={e => setStarterTarget(Number(e.target.value))} />
            </div>
          </div>
        ) : (
          <div className={styles.statsGrid}>
            {player.expectation.goalsTarget ? (
              <div className={shared.contractCard}>
                <span className={shared.contractLabel}>Gols na temporada</span>
                <span className={shared.contractValue}>{player.seasonStats.goals} / {player.expectation.goalsTarget}</span>
              </div>
            ) : null}
            {player.expectation.starterAppearancesTarget ? (
              <div className={shared.contractCard}>
                <span className={shared.contractLabel}>Jogos como titular</span>
                <span className={shared.contractValue}>{starterAppearances} / {player.expectation.starterAppearancesTarget}</span>
              </div>
            ) : null}
            {!player.expectation.goalsTarget && !player.expectation.starterAppearancesTarget && (
              <p className={styles.sub}>Nenhuma meta definida pelo clube ainda.</p>
            )}
          </div>
        )}
      </section>

      {showTransfer && (
        <form onSubmit={handleTransfer} className={extra.transferForm}>
          <h2 className={styles.sectionTitle}>Registrar transferência</h2>
          <div className={extra.field}>
            <label>Novo clube</label>
            <input value={clubName} onChange={e => setClubName(e.target.value)} placeholder="Nome do clube" required />
          </div>
          <div className={extra.fieldRow}>
            <div className={extra.field}>
              <label>Liga</label>
              <input value={league} onChange={e => setLeague(e.target.value)} required />
            </div>
            <div className={extra.field}>
              <label>País</label>
              <input value={country} onChange={e => setCountry(e.target.value)} />
            </div>
          </div>
          <div className={extra.fieldRow}>
            <div className={extra.field}>
              <label>Salário (R$)</label>
              <input type="number" min={0} value={salary} onChange={e => setSalary(Number(e.target.value))} />
            </div>
            <div className={extra.field}>
              <label>Contrato (anos)</label>
              <select value={contractYears} onChange={e => setContractYears(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className={extra.submitBtn}>Confirmar transferência</button>
        </form>
      )}
    </div>
  );
}
