import { useState } from 'react';
import { useGame } from '../../../context/GameContext';
import StatCard from '../../../components/StatCard/StatCard';
import shared from '../PlayerShared.module.css';
import styles from '../../Dashboard/Dashboard.module.css';

const POSITION_LABELS: Record<string, string> = {
  GK: 'Goleiro', CB: 'Zagueiro', RB: 'Lateral Dir.', LB: 'Lateral Esq.',
  CDM: 'Volante', CM: 'Meia', CAM: 'Meia Atac.', RW: 'Ponta Dir.',
  LW: 'Ponta Esq.', ST: 'Atacante', CF: 'Centroavante',
};

export default function PlayerProfile() {
  const { state, updateCareerPlayer } = useGame();
  const player = state.careerPlayer;
  const [editing, setEditing] = useState(false);
  const [overall, setOverall] = useState(player?.overall ?? 65);
  const [potential, setPotential] = useState(player?.potential ?? 80);

  if (!player) return null;

  function handleSave() {
    const cappedOverall = Math.min(99, overall);
    const cappedPotential = Math.min(99, potential);
    const lastEntry = player!.overallHistory[player!.overallHistory.length - 1];
    const updates: Parameters<typeof updateCareerPlayer>[0] = {
      overall: cappedOverall,
      potential: cappedPotential,
    };
    if (lastEntry && lastEntry.season === state.season && lastEntry.overall !== cappedOverall) {
      updates.overallHistory = [
        ...player!.overallHistory.slice(0, -1),
        { season: state.season, overall: cappedOverall },
      ];
    }
    updateCareerPlayer(updates);
    setEditing(false);
  }

  const s = player.stats;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Perfil</h1>
          <p className={styles.sub}>{player.name} · {POSITION_LABELS[player.position]}</p>
        </div>
        <button
          type="button"
          style={{
            padding: '10px 20px',
            background: editing ? 'var(--success)' : 'var(--accent)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onClick={() => editing ? handleSave() : setEditing(true)}
        >
          {editing ? 'Salvar' : 'Editar OVR'}
        </button>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Dados biográficos</h2>
        <div className={styles.statsGrid}>
          <StatCard label="Nacionalidade" value={player.nationality} />
          <StatCard label="Idade" value={player.age} />
          <StatCard label="Posição" value={POSITION_LABELS[player.position] ?? player.position} />
          <StatCard label="Número" value={player.number ?? '—'} />
          {player.height && <StatCard label="Altura" value={player.height} />}
          {player.preferredFoot && <StatCard label="Pé" value={player.preferredFoot} />}
          <StatCard label="Status" value={player.status} accent />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Overall e potencial</h2>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 320 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>OVERALL</span>
              <input type="number" min={40} max={99} value={overall} onChange={e => setOverall(Math.min(99, Number(e.target.value)))}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>POTENCIAL</span>
              <input type="number" min={40} max={99} value={potential} onChange={e => setPotential(Math.min(99, Number(e.target.value)))}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)' }} />
            </label>
          </div>
        ) : (
          <div className={shared.ovrBar}>
            <div className={shared.ovrRow}>
              <span className={shared.ovrLabel}>OVR</span>
              <div className={shared.ovrTrack}>
                <div className={shared.ovrFill} style={{ width: `${player.overall}%` }} />
              </div>
              <span className={shared.ovrValue}>{player.overall}</span>
            </div>
            <div className={shared.ovrRow}>
              <span className={shared.ovrLabel}>POT</span>
              <div className={shared.ovrTrack}>
                <div className={`${shared.ovrFill} ${shared.ovrFillPot}`} style={{ width: `${player.potential}%` }} />
              </div>
              <span className={shared.ovrValue}>{player.potential}</span>
            </div>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Estatísticas da carreira (total)</h2>
        <div className={styles.statsGrid}>
          <StatCard label="Jogos" value={s.matches} accent />
          <StatCard label="Gols" value={s.goals} color="green" />
          <StatCard label="Assistências" value={s.assists} />
          <StatCard label="Cartões A" value={s.yellowCards} color="yellow" />
          <StatCard label="Cartões V" value={s.redCards} color="red" />
          <StatCard label="Conf. técnico" value={`${player.coachConfidence}%`} />
          <StatCard label="Torcida" value={`${player.fanReputation}%`} />
        </div>
      </section>
    </div>
  );
}
