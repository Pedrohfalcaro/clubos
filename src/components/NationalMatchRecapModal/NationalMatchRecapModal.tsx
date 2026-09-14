import { useMemo } from 'react';
import type { FifaWindowGame } from '../../types/NationalTeam';
import type { NationalPlayer } from '../../types/NationalTeam';
import { locationIcon } from '../../utils/calendarHelpers';
import { POSITION_LABELS, ratingColor } from '../../utils/matchEvents';
import { calcResult, getHomeAway, locationLabel } from '../../utils/matchStats';
import { buildMatchTimeline, formatTimelineMinute, resultLetter } from '../../utils/matchTimeline';
// Reaproveita o CSS do resumo de partida do clube — mesmo visual.
import styles from '../MatchRecapModal/MatchRecapModal.module.css';

interface NationalMatchRecapModalProps {
  open: boolean;
  game: FifaWindowGame | null;
  windowLabel: string;
  players: NationalPlayer[];
  teamName?: string;
  onClose: () => void;
  onEdit?: () => void;
}

const RESULT_LABEL = {
  win: 'Vitória',
  draw: 'Empate',
  loss: 'Derrota',
} as const;

export default function NationalMatchRecapModal({
  open,
  game,
  windowLabel,
  players,
  teamName,
  onClose,
  onEdit,
}: NationalMatchRecapModalProps) {
  const ratings = useMemo(() => {
    if (!game?.playerRatings?.length) return [];
    const byId = new Map(players.map(p => [p.id, p]));
    return [...game.playerRatings]
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
  }, [game, players]);

  const ourSide = game?.location === 'away' ? 'away' : 'home';
  const events = useMemo(() => (game ? buildMatchTimeline(game, ourSide) : []), [game, ourSide]);

  if (!open || !game) return null;

  const goalsFor = game.goalsFor ?? 0;
  const goalsAgainst = game.goalsAgainst ?? 0;
  const result = game.played ? calcResult(goalsFor, goalsAgainst) : null;
  const letter = resultLetter(result);
  const resultClass =
    result === 'win' ? styles.resWin : result === 'draw' ? styles.resDraw : result === 'loss' ? styles.resLoss : '';
  const ha = getHomeAway(teamName ?? 'Nós', { ...game, goalsFor, goalsAgainst });
  const homeLabel = ha.homeTeam;
  const awayLabel = ha.awayTeam;

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="national-match-recap-title"
      >
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <p className={styles.competition}>{windowLabel}</p>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
              ×
            </button>
          </div>
          <h2 id="national-match-recap-title" className={styles.title}>
            {teamName ? `${teamName} × ${game.opponent}` : game.opponent}
          </h2>
          <p className={styles.meta}>
            <span>{locationIcon(game.location)} {locationLabel(game.location)}</span>
            <span>·</span>
            <span>
              {new Date(game.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </p>
        </header>

        <div className={`${styles.scoreBlock} ${resultClass}`}>
          <span className={styles.score}>
            {goalsFor}
            <span className={styles.scoreSep}>×</span>
            {goalsAgainst}
          </span>
          {letter && <span className={styles.resultBadge}>{letter}</span>}
          {result && <span className={styles.resultLabel}>{RESULT_LABEL[result]}</span>}
        </div>

        {game.description?.trim() && <p className={styles.description}>{game.description.trim()}</p>}

        <section className={styles.timelineSection}>
          <h3 className={styles.sectionTitle}>Acontecimentos</h3>
          {events.length === 0 ? (
            <p className={styles.tlEmpty}>Nenhum lance registrado.</p>
          ) : (
            <div className={styles.dualTimeline}>
              <div className={styles.dualHead}>
                <span>{homeLabel}</span>
                <span />
                <span>{awayLabel}</span>
              </div>
              <ul className={styles.dualList}>
                {events.map(ev => (
                  <li key={ev.id} className={styles.dualRow}>
                    <div className={`${styles.dualCell} ${styles.dualLeft}`}>
                      {ev.pitchSide === 'home' && (
                        <div className={styles.dualEvent}>
                          <span className={styles.dualIcon}>{ev.icon}</span>
                          <div className={styles.dualText}>
                            <p className={styles.tlName}>{ev.title}</p>
                            {ev.assist && <p className={styles.tlAssist}>{ev.assist}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                    <span className={styles.dualMin}>{formatTimelineMinute(ev.minute)}</span>
                    <div className={`${styles.dualCell} ${styles.dualRight}`}>
                      {ev.pitchSide === 'away' && (
                        <div className={styles.dualEvent}>
                          <span className={styles.dualIcon}>{ev.icon}</span>
                          <div className={styles.dualText}>
                            <p className={styles.tlName}>{ev.title}</p>
                            {ev.assist && <p className={styles.tlAssist}>{ev.assist}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {ratings.length > 0 && (
          <section className={styles.ratingsSection}>
            <h3 className={styles.sectionTitle}>Notas</h3>
            <ul className={styles.ratingsList}>
              {ratings.map(r => {
                const isMotm = game.motmNationalPlayerId === r.playerId;
                const isWorst = game.worstNationalPlayerId === r.playerId;
                const nameClass = [
                  styles.ratingName,
                  isMotm ? styles.nameMotm : '',
                  isWorst ? styles.nameWorst : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <li key={r.playerId} className={styles.ratingRow}>
                    <span className={styles.ratingValue} style={{ color: ratingColor(r.rating) }}>
                      {r.rating?.toFixed(1)}
                    </span>
                    <span className={nameClass}>
                      {r.name}
                      {isMotm ? ' ★' : ''}
                      {isWorst ? ' ↓' : ''}
                    </span>
                    <span className={styles.ratingPos}>{POSITION_LABELS[r.position] ?? r.position}</span>
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
