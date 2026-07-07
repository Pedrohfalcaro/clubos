import { useMemo } from 'react';
import { useGame } from '../../../context/GameContext';
import { getPlayerMatchClubName } from '../../../utils/playerMatch';
import styles from '../../Dashboard/Dashboard.module.css';
import extra from './PlayerHistory.module.css';

export default function PlayerHistory() {
  const { state } = useGame();
  const player = state.careerPlayer;

  const highlights = useMemo(() => {
    return state.matches
      .filter(m => m.status === 'completed' && m.playerPerformance)
      .filter(m => {
        const p = m.playerPerformance!;
        return (p.rating != null && p.rating >= 8) || p.goals >= 3;
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
  }, [state.matches]);

  if (!player) return null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Histórico</h1>
        <p className={styles.sub}>Clubes e melhores momentos da carreira</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Clubes</h2>
        {player.careerHistory.length === 0 ? (
          <div className={styles.empty}>Nenhum histórico registrado.</div>
        ) : (
          <div className={extra.timeline}>
            {player.careerHistory.map(entry => (
              <div key={`${entry.clubName}-${entry.seasonStart}`} className={extra.timelineItem}>
                <div className={extra.timelineDot} />
                <div className={extra.timelineContent}>
                  <h3 className={extra.clubName}>{entry.clubName}</h3>
                  <p className={extra.clubMeta}>
                    {entry.league} · {entry.country}
                  </p>
                  <p className={extra.clubSeason}>
                    {entry.seasonStart}
                    {entry.seasonEnd ? ` – ${entry.seasonEnd}` : ' – atual'}
                  </p>
                  <p className={extra.clubStats}>
                    {entry.stats.matches}J · {entry.stats.goals}G · {entry.stats.assists}A
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Melhores momentos</h2>
        {highlights.length === 0 ? (
          <div className={styles.empty}>
            Partidas com nota 8+ ou hat-trick aparecerão aqui.
          </div>
        ) : (
          <div className={extra.highlightList}>
            {highlights.map(m => {
              const p = m.playerPerformance!;
              const label = p.goals >= 3
                ? `Hat-trick (${p.goals} gols)`
                : `Nota ${p.rating?.toFixed(1)}`;
              return (
                <div key={m.id} className={extra.highlightItem}>
                  <span className={extra.highlightBadge}>{label}</span>
                  <div>
                    <strong>{getPlayerMatchClubName(m, player.currentClub.name)} × {m.opponent}</strong>
                    <span className={extra.highlightMeta}>
                      {new Date(m.date).toLocaleDateString('pt-BR')} · {m.competition}
                      {p.goals > 0 && ` · ${p.goals}G`}
                      {p.assists > 0 && ` · ${p.assists}A`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
