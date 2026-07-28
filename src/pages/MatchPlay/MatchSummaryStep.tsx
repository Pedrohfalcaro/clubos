import { useMemo } from 'react';
import type { Player } from '../../types/Player';
import type { PlayerMatchRating, SubstitutionEvent, TeamCardEntry } from '../../types/Match';
import { POSITION_ORDER, POSITION_LABELS, ratingColor } from '../../utils/matchEvents';
import { getExpelledPlayerIds } from '../../utils/matchPlayHelpers';
import styles from './MatchSummaryStep.module.css';

const MIN_RATING = 5;
const MAX_RATING = 10;

interface MatchSummaryStepProps {
  players: Player[];
  starters: string[];
  bench: string[];
  teamSubs: SubstitutionEvent[];
  teamCards: TeamCardEntry[];
  ratings: Record<string, number | null>;
  onRatingsChange: (r: Record<string, number | null>) => void;
  motmPlayerId: string | null;
  worstPlayerId: string | null;
  onMotmChange: (id: string | null) => void;
  onWorstChange: (id: string | null) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
}

function sortByPosition(list: Player[]): Player[] {
  return [...list].sort((a, b) => {
    const pa = POSITION_ORDER.indexOf(a.position);
    const pb = POSITION_ORDER.indexOf(b.position);
    return pa - pb || a.name.localeCompare(b.name);
  });
}

function RatingRow({
  player,
  rating,
  isMotm,
  isWorst,
  expelled,
  onSetRating,
  onToggleMotm,
  onToggleWorst,
}: {
  player: Player;
  rating: number | null;
  isMotm: boolean;
  isWorst: boolean;
  expelled: boolean;
  onSetRating: (v: number | null) => void;
  onToggleMotm: () => void;
  onToggleWorst: () => void;
}) {
  const value = rating ?? 7;

  return (
    <li
      className={`${styles.row} ${isMotm ? styles.rowMotm : ''} ${isWorst ? styles.rowWorst : ''}`}
    >
      <span className={styles.num}>{player.number ?? '—'}</span>
      <div className={styles.identity}>
        <span className={styles.name}>
          {player.name}
          {expelled && <span className={styles.exp}> EXP</span>}
        </span>
        <span className={styles.pos}>{POSITION_LABELS[player.position] ?? player.position}</span>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.nudge}
          disabled={rating == null || value <= MIN_RATING}
          onClick={() => onSetRating(Math.max(MIN_RATING, Math.round((value - 0.1) * 10) / 10))}
          aria-label="Diminuir nota"
        >
          −
        </button>
        <input
          type="range"
          className={styles.slider}
          min={MIN_RATING}
          max={MAX_RATING}
          step={0.1}
          value={value}
          onChange={e => onSetRating(Math.round(Number(e.target.value) * 10) / 10)}
          style={{
            background: `linear-gradient(90deg, ${ratingColor(rating ?? 7)} ${((value - MIN_RATING) / (MAX_RATING - MIN_RATING)) * 100}%, var(--border) 0)`,
          }}
          aria-label={`Nota de ${player.name}`}
        />
        <button
          type="button"
          className={styles.nudge}
          disabled={value >= MAX_RATING}
          onClick={() => onSetRating(Math.min(MAX_RATING, Math.round((value + 0.1) * 10) / 10))}
          aria-label="Aumentar nota"
        >
          +
        </button>
      </div>

      <span
        className={styles.score}
        style={{ background: ratingColor(rating), color: '#fff' }}
        title={rating != null ? 'Clique para limpar' : undefined}
        onClick={() => rating != null && onSetRating(null)}
        role={rating != null ? 'button' : undefined}
      >
        {rating != null ? rating.toFixed(1) : '—'}
      </span>

      <div className={styles.awards}>
        <button
          type="button"
          className={`${styles.award} ${isMotm ? styles.awardMotm : ''}`}
          onClick={onToggleMotm}
          title="Destaque"
          aria-label="Marcar destaque"
          aria-pressed={isMotm}
        >
          ★
        </button>
        <button
          type="button"
          className={`${styles.award} ${isWorst ? styles.awardWorst : ''}`}
          onClick={onToggleWorst}
          title="Pior em campo"
          aria-label="Marcar pior em campo"
          aria-pressed={isWorst}
        >
          ↓
        </button>
      </div>
    </li>
  );
}

export default function MatchSummaryStep({
  players,
  starters,
  bench,
  teamSubs,
  teamCards,
  ratings,
  onRatingsChange,
  motmPlayerId,
  worstPlayerId,
  onMotmChange,
  onWorstChange,
  description,
  onDescriptionChange,
}: MatchSummaryStepProps) {
  const expelled = useMemo(() => getExpelledPlayerIds(teamCards), [teamCards]);
  const subbedInIds = useMemo(() => new Set(teamSubs.map(s => s.playerInId)), [teamSubs]);

  const sortedStarters = useMemo(() => {
    return sortByPosition(
      starters
        .map(id => players.find(p => p.id === id))
        .filter((p): p is Player => Boolean(p)),
    );
  }, [starters, players]);

  const enteredFromBench = useMemo(() => {
    return sortByPosition(
      bench
        .filter(id => subbedInIds.has(id))
        .map(id => players.find(p => p.id === id))
        .filter((p): p is Player => Boolean(p)),
    );
  }, [bench, players, subbedInIds]);

  function setRating(playerId: string, rating: number | null) {
    onRatingsChange({ ...ratings, [playerId]: rating });
  }

  function toggleMotm(id: string) {
    onMotmChange(motmPlayerId === id ? null : id);
    if (worstPlayerId === id) onWorstChange(null);
  }

  function toggleWorst(id: string) {
    onWorstChange(worstPlayerId === id ? null : id);
    if (motmPlayerId === id) onMotmChange(null);
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>
        Arraste o controle · {MIN_RATING.toFixed(1)}–{MAX_RATING.toFixed(1)} · ★ destaque · ↓ pior
      </p>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Titulares</h3>
        <ul className={styles.list}>
          {sortedStarters.map(p => (
            <RatingRow
              key={p.id}
              player={p}
              rating={ratings[p.id] ?? null}
              isMotm={motmPlayerId === p.id}
              isWorst={worstPlayerId === p.id}
              expelled={expelled.has(p.id)}
              onSetRating={v => setRating(p.id, v)}
              onToggleMotm={() => toggleMotm(p.id)}
              onToggleWorst={() => toggleWorst(p.id)}
            />
          ))}
        </ul>
      </section>

      {enteredFromBench.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Entraram do banco</h3>
          <ul className={styles.list}>
            {enteredFromBench.map(p => (
              <RatingRow
                key={p.id}
                player={p}
                rating={ratings[p.id] ?? null}
                isMotm={motmPlayerId === p.id}
                isWorst={worstPlayerId === p.id}
                expelled={expelled.has(p.id)}
                onSetRating={v => setRating(p.id, v)}
                onToggleMotm={() => toggleMotm(p.id)}
                onToggleWorst={() => toggleWorst(p.id)}
              />
            ))}
          </ul>
        </section>
      )}

      <section className={styles.descSection}>
        <label className={styles.descLabel}>Descrição (opcional)</label>
        <textarea
          className={styles.textarea}
          value={description}
          onChange={e => onDescriptionChange(e.target.value)}
          placeholder="Como foi a partida?"
          rows={3}
        />
      </section>
    </div>
  );
}

export function buildRatingsArray(
  ratings: Record<string, number | null>,
): PlayerMatchRating[] {
  return Object.entries(ratings)
    .filter(([, v]) => v !== null)
    .map(([playerId, rating]) => ({ playerId, rating }));
}
