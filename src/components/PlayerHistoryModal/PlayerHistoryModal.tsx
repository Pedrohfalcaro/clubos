import { useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { getPlayerMatchHistory } from '../../utils/matchStats';
import { ratingColor } from '../../utils/matchEvents';
import styles from './PlayerHistoryModal.module.css';

interface PlayerHistoryModalProps {
  playerId: string;
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

export default function PlayerHistoryModal({
  playerId,
  playerName,
  onClose,
}: PlayerHistoryModalProps) {
  const { state } = useGame();

  const history = useMemo(
    () =>
      getPlayerMatchHistory(
        playerId,
        state.matches,
        state.team?.name ?? 'Nosso time',
        state.seasonCompetitions,
        state.transfers.history,
      ),
    [playerId, state.matches, state.team?.name, state.seasonCompetitions, state.transfers.history],
  );

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.headerTop}>
          <div>
            <h2 className={styles.title}>{playerName}</h2>
            <p className={styles.subtitle}>
              Histórico de partidas · {history.length} jogo{history.length === 1 ? '' : 's'} do clube
              desde a contratação
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        {history.length === 0 ? (
          <p className={styles.empty}>Nenhuma partida registrada ainda.</p>
        ) : (
          <div className={styles.table}>
            {history.map(entry => {
              const homeWon = entry.winner === 'home';
              const awayWon = entry.winner === 'away';
              return (
                <div key={entry.matchId} className={styles.row}>
                  <span
                    className={styles.compBar}
                    style={{ background: entry.competitionColor }}
                    title={entry.competition}
                  />
                  <span className={styles.date}>{formatDate(entry.date)}</span>
                  <span className={styles.teams}>
                    <span className={styles.teamLine}>
                      <span
                        className={`${styles.teamName} ${homeWon || entry.winner === 'draw' ? styles.teamWon : styles.teamLost}`}
                      >
                        {entry.homeTeam}
                      </span>
                      <span className={styles.teamGoals}>{entry.homeGoals}</span>
                    </span>
                    <span className={styles.teamLine}>
                      <span
                        className={`${styles.teamName} ${awayWon || entry.winner === 'draw' ? styles.teamWon : styles.teamLost}`}
                      >
                        {entry.awayTeam}
                      </span>
                      <span className={styles.teamGoals}>{entry.awayGoals}</span>
                    </span>
                  </span>
                  <span className={styles.production}>
                    {entry.goals > 0 && <span className={styles.prodIcon}>⚽ {entry.goals}</span>}
                    {entry.assists > 0 && <span className={styles.prodIcon}>👟 {entry.assists}</span>}
                    {entry.yellowCards > 0 && (
                      <span className={styles.prodIcon} title="Cartão amarelo">
                        🟨 {entry.yellowCards}
                      </span>
                    )}
                    {entry.redCards > 0 && (
                      <span className={styles.prodIcon} title="Cartão vermelho">
                        🟥 {entry.redCards}
                      </span>
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
