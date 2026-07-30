import { useMemo } from 'react';
import type { Match } from '../../types/Match';
import type { Player } from '../../types/Player';
import { locationIcon } from '../../utils/calendarHelpers';
import { POSITION_LABELS, ratingColor } from '../../utils/matchEvents';
import { locationLabel } from '../../utils/matchStats';
import styles from './MatchRecapModal.module.css';

interface MatchRecapModalProps {
  open: boolean;
  match: Match | null;
  players: Player[];
  teamName?: string;
  onClose: () => void;
  onEdit?: () => void;
}

const RESULT_LABEL = {
  win: 'Vitória',
  draw: 'Empate',
  loss: 'Derrota',
} as const;

export default function MatchRecapModal({
  open,
  match,
  players,
  teamName,
  onClose,
  onEdit,
}: MatchRecapModalProps) {
  const ratings = useMemo(() => {
    if (!match?.playerRatings?.length) return [];
    const byId = new Map(players.map(p => [p.id, p]));
    return [...match.playerRatings]
      .map(r => {
        const player = byId.get(r.playerId);
        return {
          playerId: r.playerId,
          rating: r.rating,
          name: player?.name ?? '—',
          position: player?.position ?? '',
        };
      })
      .filter(r => r.rating != null)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }, [match, players]);

  if (!open || !match) return null;

  const result = match.result;
  const resultClass =
    result === 'win' ? styles.resWin : result === 'draw' ? styles.resDraw : result === 'loss' ? styles.resLoss : '';

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-recap-title"
      >
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <p className={styles.competition}>{match.competition}</p>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
              ×
            </button>
          </div>
          <h2 id="match-recap-title" className={styles.title}>
            {teamName ? `${teamName} × ${match.opponent}` : match.opponent}
          </h2>
          <p className={styles.meta}>
            <span>{locationIcon(match.location)} {locationLabel(match.location)}</span>
            <span>·</span>
            <span>
              {new Date(match.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </p>
        </header>

        <div className={`${styles.scoreBlock} ${resultClass}`}>
          <span className={styles.score}>
            {match.goalsFor} × {match.goalsAgainst}
          </span>
          {result && <span className={styles.resultLabel}>{RESULT_LABEL[result]}</span>}
        </div>

        {match.description?.trim() && (
          <p className={styles.description}>{match.description.trim()}</p>
        )}

        {match.playerPerformance && ratings.length === 0 && (
          <section className={styles.ratingsSection}>
            <h3 className={styles.ratingsTitle}>Sua partida</h3>
            <ul className={styles.ratingsList}>
              <li className={styles.ratingRow}>
                <span
                  className={styles.ratingValue}
                  style={{ color: ratingColor(match.playerPerformance.rating ?? null) }}
                >
                  {match.playerPerformance.rating != null
                    ? match.playerPerformance.rating.toFixed(1)
                    : '—'}
                </span>
                <span className={styles.ratingName}>
                  {match.playerPerformance.minutesPlayed != null
                    ? `${match.playerPerformance.minutesPlayed}' · `
                    : ''}
                  {match.playerPerformance.goals ?? 0}G · {match.playerPerformance.assists ?? 0}A
                </span>
                <span className={styles.ratingPos}>VOCÊ</span>
              </li>
            </ul>
          </section>
        )}

        {ratings.length > 0 && (
          <section className={styles.ratingsSection}>
            <h3 className={styles.ratingsTitle}>Notas</h3>
            <ul className={styles.ratingsList}>
              {ratings.map(r => {
                const isMotm = match.motmPlayerId === r.playerId;
                const isWorst = match.worstPlayerId === r.playerId;
                const nameClass = [
                  styles.ratingName,
                  isMotm ? styles.nameMotm : '',
                  isWorst ? styles.nameWorst : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <li key={r.playerId} className={styles.ratingRow}>
                    <span
                      className={styles.ratingValue}
                      style={{ color: ratingColor(r.rating) }}
                    >
                      {r.rating?.toFixed(1)}
                    </span>
                    <span className={nameClass}>
                      {r.name}
                      {isMotm ? ' ★' : ''}
                      {isWorst ? ' ↓' : ''}
                    </span>
                    <span className={styles.ratingPos}>
                      {POSITION_LABELS[r.position] ?? r.position}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className={styles.actions}>
          {onEdit && (
            <button type="button" className={styles.editBtn} onClick={onEdit}>
              Editar partida
            </button>
          )}
          <button type="button" className={styles.closeAction} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
