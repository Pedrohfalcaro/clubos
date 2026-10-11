import { formatGameDate } from '../../livelife';
import type { TrainingPlayerStats, TrainingSession, TrainingTeamKey } from '../../types/Training';
import KitPreview from '../../components/KitEditor/KitPreview';
import { createSolidKit } from '../../types/Kit';
import styles from './TrainingPit.module.css';

const TEAM_KEYS: TrainingTeamKey[] = ['a', 'b'];

function moraleOf(session: TrainingSession, id: string): string {
  const d = session.moraleDelta[id];
  return d ? ` ${d > 0 ? '▲' : '▼'}${Math.abs(d)}` : '';
}

function injuryOf(session: TrainingSession, id: string): string {
  const inj = session.injuries.find(i => i.playerId === id);
  return inj ? ` · lesão (${inj.days} dias)` : '';
}

function clock(t: number): string {
  const m = Math.floor(t / 60);
  const sec = Math.floor(t % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function statsLabel(stats: TrainingPlayerStats): string {
  const parts: string[] = [];
  if (stats.goals > 0) parts.push(`${stats.goals} gol${stats.goals > 1 ? 's' : ''}`);
  if (stats.assists > 0) parts.push(`${stats.assists} ass.`);
  if (stats.saves) parts.push(`${stats.saves} defesa${stats.saves > 1 ? 's' : ''}`);
  if (stats.clearances) parts.push(`${stats.clearances} corte${stats.clearances > 1 ? 's' : ''}`);
  if (stats.fouls) parts.push(`${stats.fouls} falta${stats.fouls > 1 ? 's' : ''}`);
  if (stats.dribblesWon) parts.push(`${stats.dribblesWon} drible${stats.dribblesWon > 1 ? 's' : ''}`);
  if (stats.offsides) parts.push(`${stats.offsides} impedimento${stats.offsides > 1 ? 's' : ''}`);
  if (stats.yellows) parts.push(stats.yellows > 1 ? '2 amarelos' : 'amarelo');
  if (stats.reds) parts.push('expulso');
  if (stats.cleanSheet) parts.push('sem sofrer gol');
  return parts.length ? ` · ${parts.join(', ')}` : '';
}

export default function SummaryModal({
  session,
  onClose,
  nameOf,
}: {
  session: TrainingSession;
  onClose: () => void;
  nameOf: (id: string) => string;
}) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalWide}`} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>
          {session.teams.a.name} {session.score.a} x {session.score.b} {session.teams.b.name}
        </h2>
        <p className={styles.modalText}>{formatGameDate(session.date)} · notas dos jogadores</p>
        {session.goals && session.goals.length > 0 && (
          <ul className={styles.goalList}>
            {session.goals.map((g, i) => (
              <li key={i}>
                <span className={styles.goalTime}>{clock(g.t)}</span>
                <span>
                  {g.ownGoal ? 'Gol contra' : 'Gol'} · {nameOf(g.playerId ?? '')}
                  {g.assistId ? ` (ass. ${nameOf(g.assistId)})` : ''}
                </span>
                <span className={styles.goalTeam}>{session.teams[g.team].name}</span>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.summaryCols}>
          {TEAM_KEYS.map(key => (
            <div key={key}>
              <p className={styles.summaryTeam}>
                <KitPreview kit={session.teams[key].kitDesign ?? createSolidKit(session.teams[key].kit)} size={24} />
                {session.teams[key].name}
              </p>
              <ul className={styles.summaryList}>
                {[
                  ...session.teams[key].lineup.map(l => ({ playerId: l.playerId, sub: false })),
                  ...(session.teams[key].substitutes ?? []).map(id => ({ playerId: id, sub: true })),
                ].map(({ playerId, sub }) => {
                  const rating = session.ratings[playerId];
                  const stats = session.playerStats[playerId];
                  return (
                    <li key={playerId}>
                      <span>
                        {sub ? '↑ ' : ''}
                        {nameOf(playerId)}
                        {session.mvpId === playerId ? ' ★' : ''}
                        {stats ? statsLabel(stats) : ''}
                        {injuryOf(session, playerId)}
                      </span>
                      <strong>
                        {rating !== undefined ? rating.toFixed(1) : '—'}
                        <small className={styles.moraleDelta}>{moraleOf(session, playerId)}</small>
                      </strong>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.ghostBtn} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
