import { useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { getNationalPlayerMatchHistory } from '../../utils/nationalStats';
import { getHomeAway } from '../../utils/matchStats';
import { ratingColor } from '../../utils/matchEvents';
// Reaproveita o CSS do histórico de partidas do elenco — mesmo visual.
import styles from '../PlayerHistoryModal/PlayerHistoryModal.module.css';

interface NationalPlayerHistoryModalProps {
  nationalPlayerId: string;
  playerName: string;
  onClose: () => void;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatRating(rating: number | null): string {
  if (rating == null) return '—';
  return rating.toFixed(1);
}

export default function NationalPlayerHistoryModal({
  nationalPlayerId,
  playerName,
  onClose,
}: NationalPlayerHistoryModalProps) {
  const { state } = useGame();
  const nationalTeam = state.nationalTeam;

  const history = useMemo(
    () => (nationalTeam ? getNationalPlayerMatchHistory(nationalPlayerId, nationalTeam) : []),
    [nationalPlayerId, nationalTeam],
  );
  const teamName = nationalTeam?.name ?? 'Seleção';

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.headerTop}>
          <div>
            <h2 className={styles.title}>{playerName}</h2>
            <p className={styles.subtitle}>
              Histórico pela Seleção · {history.length} jogo{history.length === 1 ? '' : 's'} disputado
              {history.length === 1 ? '' : 's'}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        {history.length === 0 ? (
          <p className={styles.empty}>Nenhuma partida disputada pela Seleção ainda.</p>
        ) : (
          <div className={styles.table}>
            {history.map(entry => {
              const ha = getHomeAway(teamName, entry);
              const homeWon = entry.result === (entry.location === 'away' ? 'loss' : 'win');
              const awayWon = entry.result === (entry.location === 'away' ? 'win' : 'loss');
              const isDraw = entry.result === 'draw';
              return (
                <div key={entry.gameId} className={styles.row}>
                  <span
                    className={styles.compBar}
                    style={{ background: 'var(--accent)' }}
                    title={entry.windowLabel}
                  />
                  <span className={styles.date}>{formatDate(entry.date)}</span>
                  <span className={styles.teams}>
                    <span className={styles.teamLine}>
                      <span
                        className={`${styles.teamName} ${homeWon || isDraw ? styles.teamWon : styles.teamLost}`}
                      >
                        {ha.homeTeam}
                      </span>
                      <span className={styles.teamGoals}>{ha.homeGoals}</span>
                    </span>
                    <span className={styles.teamLine}>
                      <span
                        className={`${styles.teamName} ${awayWon || isDraw ? styles.teamWon : styles.teamLost}`}
                      >
                        {ha.awayTeam}
                      </span>
                      <span className={styles.teamGoals}>{ha.awayGoals}</span>
                    </span>
                  </span>
                  <span className={styles.production}>
                    {!entry.played ? (
                      <span className={styles.prodIcon} style={{ opacity: 0.6 }}>
                        Não jogou
                      </span>
                    ) : (
                      <>
                        {entry.goals > 0 && <span className={styles.prodIcon}>⚽ {entry.goals}</span>}
                        {entry.assists > 0 && <span className={styles.prodIcon}>👟 {entry.assists}</span>}
                        {entry.yellowCard && (
                          <span className={styles.prodIcon} title="Cartão amarelo">
                            🟨
                          </span>
                        )}
                        {entry.redCard && (
                          <span className={styles.prodIcon} title="Cartão vermelho">
                            🟥
                          </span>
                        )}
                      </>
                    )}
                  </span>
                  <span
                    className={styles.notaBadge}
                    style={{
                      background: entry.rating != null ? ratingColor(entry.rating) : 'transparent',
                      color: entry.rating != null ? '#fff' : 'var(--text)',
                      border: entry.rating == null ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    {formatRating(entry.rating)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
