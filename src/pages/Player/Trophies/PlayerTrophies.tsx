import { useMemo, useState } from 'react';
import { useGame } from '../../../context/GameContext';
import type { PlayerAwardType } from '../../../types/CareerPlayer';
import { computePlayerMilestones, nextPlayerMilestones } from '../../../utils/playerMilestones';
import styles from '../../Dashboard/Dashboard.module.css';
import extra from './PlayerTrophies.module.css';

const TYPE_LABELS: Record<PlayerAwardType, string> = {
  title: 'Título de clube',
  individual: 'Prêmio individual',
};

export default function PlayerTrophies() {
  const { state, addPlayerAward, removePlayerAward } = useGame();
  const player = state.careerPlayer;

  const [title, setTitle] = useState('');
  const [type, setType] = useState<PlayerAwardType>('title');
  const [season, setSeason] = useState(state.season);
  const [clubName, setClubName] = useState(player?.currentClub.name ?? '');

  const milestones = useMemo(
    () => (player ? computePlayerMilestones(player.stats) : []),
    [player],
  );
  const achieved = milestones.filter(m => m.achieved);
  const upcoming = useMemo(() => nextPlayerMilestones(milestones), [milestones]);

  if (!player) return null;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    addPlayerAward({
      type,
      title: title.trim(),
      season,
      clubName: clubName.trim() || undefined,
    });
    setTitle('');
  }

  const sortedAwards = [...player.awards].sort((a, b) => b.season - a.season);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Sala de Troféus</h1>
          <p className={styles.sub}>Títulos, prêmios e marcos da carreira</p>
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Marcos de carreira</h2>
        <div className={extra.milestoneGrid}>
          {achieved.map(m => (
            <div key={m.id} className={`${extra.milestoneBadge} ${extra.milestoneBadgeAchieved}`}>
              <span className={extra.milestoneIcon}>🏅</span>
              <span className={extra.milestoneLabel}>{m.label}</span>
            </div>
          ))}
          {upcoming.map(m => (
            <div key={m.id} className={extra.milestoneBadge}>
              <span className={extra.milestoneIcon}>🔒</span>
              <span className={extra.milestoneLabel}>{m.label}</span>
              <span className={extra.milestoneProgress}>{m.current}/{m.target}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Títulos e prêmios</h2>
        {sortedAwards.length > 0 && (
          <div className={extra.awardList}>
            {sortedAwards.map(a => (
              <div key={a.id} className={extra.awardItem}>
                <div>
                  <span className={extra.awardBadge}>{TYPE_LABELS[a.type]}</span>
                  <strong>{a.title}</strong>
                  <span className={extra.awardMeta}>
                    {a.season}
                    {a.clubName ? ` · ${a.clubName}` : ''}
                  </span>
                </div>
                <button type="button" className={extra.removeBtn} onClick={() => removePlayerAward(a.id)}>×</button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleAdd} className={extra.awardForm}>
          <div className={extra.fieldRow}>
            <div className={extra.field}>
              <label>Tipo</label>
              <select value={type} onChange={e => setType(e.target.value as PlayerAwardType)}>
                <option value="title">Título de clube</option>
                <option value="individual">Prêmio individual</option>
              </select>
            </div>
            <div className={extra.field}>
              <label>Temporada</label>
              <input type="number" value={season} onChange={e => setSeason(Number(e.target.value))} />
            </div>
          </div>
          <div className={extra.field}>
            <label>Título / prêmio</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={type === 'title' ? 'Ex: Campeonato Brasileiro' : 'Ex: Bola de Ouro do campeonato'}
              required
            />
          </div>
          <div className={extra.field}>
            <label>Clube (opcional)</label>
            <input value={clubName} onChange={e => setClubName(e.target.value)} placeholder="Ex: Flamengo" />
          </div>
          <button type="submit" className={extra.addBtn}>Registrar</button>
        </form>
      </section>
    </div>
  );
}
