import { useMemo, useState } from 'react';
import type { Player } from '../../types/Player';
import type { PlayerMatchRating, SubstitutionEvent, TeamCardEntry } from '../../types/Match';
import { POSITION_ORDER, POSITION_LABELS, RATING_OPTIONS, ratingColor } from '../../utils/matchEvents';
import { getExpelledPlayerIds } from '../../utils/matchPlayHelpers';
import styles from './MatchSummaryStep.module.css';

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

interface PlayerRowProps {
  player: Player;
  interactive: boolean;
  rating: number | null;
  ratingPicker: string | null;
  nameMenu: string | null;
  motmPlayerId: string | null;
  worstPlayerId: string | null;
  expelled: Set<string>;
  onRatingPicker: (id: string | null) => void;
  onNameMenu: (id: string | null) => void;
  onSetRating: (playerId: string, rating: number | null) => void;
  onToggleMotm: (id: string) => void;
  onToggleWorst: (id: string) => void;
}

function PlayerRow({
  player,
  interactive,
  rating,
  ratingPicker,
  nameMenu,
  motmPlayerId,
  worstPlayerId,
  expelled,
  onRatingPicker,
  onNameMenu,
  onSetRating,
  onToggleMotm,
  onToggleWorst,
}: PlayerRowProps) {
  function nameClass(id: string): string {
    if (!interactive) return styles.nameInactive;
    if (motmPlayerId === id) return styles.nameMotm;
    if (worstPlayerId === id) return styles.nameWorst;
    if (expelled.has(id)) return styles.nameExpelled;
    return styles.nameActive;
  }

  return (
    <div className={styles.tableRow}>
      <span className={styles.colNum}>{player.number ?? '—'}</span>
      <span className={styles.colName}>
        {interactive ? (
          <>
            <button
              type="button"
              className={`${styles.nameBtn} ${nameClass(player.id)}`}
              onClick={() => onNameMenu(nameMenu === player.id ? null : player.id)}
            >
              {player.name}
              {motmPlayerId === player.id && <span className={styles.motmStar}> ★</span>}
            </button>
            {nameMenu === player.id && (
              <div className={styles.nameMenu}>
                <button type="button" onClick={() => onToggleMotm(player.id)}>Man of the Match</button>
                <button type="button" onClick={() => onToggleWorst(player.id)}>Worst Player</button>
              </div>
            )}
          </>
        ) : (
          <span className={styles.nameInactive}>{player.name}</span>
        )}
      </span>
      <span className={styles.colPos}>{POSITION_LABELS[player.position] ?? player.position}</span>
      <div className={styles.ratingCell}>
        {interactive ? (
          <>
            <button
              type="button"
              className={styles.ratingBox}
              style={{ background: ratingColor(rating) }}
              onClick={() => onRatingPicker(ratingPicker === player.id ? null : player.id)}
            >
              {rating !== null ? rating.toFixed(1) : '—'}
            </button>
            {ratingPicker === player.id && (
              <div className={styles.ratingPicker}>
                <input
                  type="number"
                  step={0.1}
                  min={0.5}
                  max={10}
                  placeholder="Ex: 7.4"
                  className={styles.ratingInput}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const v = Number((e.target as HTMLInputElement).value);
                      if (v >= 0.5 && v <= 10) onSetRating(player.id, Math.round(v * 10) / 10);
                    }
                  }}
                />
                <div className={styles.ratingList}>
                  {RATING_OPTIONS.map(r => (
                    <button key={r} type="button" onClick={() => onSetRating(player.id, r)}>
                      {r.toFixed(1)}
                    </button>
                  ))}
                </div>
                <button type="button" className={styles.clearRating} onClick={() => onSetRating(player.id, null)}>
                  Limpar
                </button>
              </div>
            )}
          </>
        ) : (
          <span className={styles.ratingDisabled}>—</span>
        )}
      </div>
    </div>
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
  const [ratingPicker, setRatingPicker] = useState<string | null>(null);
  const [nameMenu, setNameMenu] = useState<string | null>(null);

  const expelled = useMemo(() => getExpelledPlayerIds(teamCards), [teamCards]);
  const subbedInSet = useMemo(() => new Set(teamSubs.map(s => s.playerInId)), [teamSubs]);

  const sortedStarters = useMemo(() => {
    return starters
      .map(id => players.find(p => p.id === id))
      .filter(Boolean)
      .sort((a, b) => {
        const pa = POSITION_ORDER.indexOf(a!.position);
        const pb = POSITION_ORDER.indexOf(b!.position);
        return pa - pb || a!.name.localeCompare(b!.name);
      }) as Player[];
  }, [starters, players]);

  const sortedBench = useMemo(() => {
    return bench
      .map(id => players.find(p => p.id === id))
      .filter(Boolean)
      .sort((a, b) => {
        const pa = POSITION_ORDER.indexOf(a!.position);
        const pb = POSITION_ORDER.indexOf(b!.position);
        return pa - pb || a!.name.localeCompare(b!.name);
      }) as Player[];
  }, [bench, players]);

  function setRating(playerId: string, rating: number | null) {
    onRatingsChange({ ...ratings, [playerId]: rating });
    setRatingPicker(null);
  }

  function toggleMotm(id: string) {
    onMotmChange(motmPlayerId === id ? null : id);
    if (worstPlayerId === id) onWorstChange(null);
    setNameMenu(null);
  }

  function toggleWorst(id: string) {
    onWorstChange(worstPlayerId === id ? null : id);
    if (motmPlayerId === id) onMotmChange(null);
    setNameMenu(null);
  }

  const rowProps = {
    ratingPicker,
    nameMenu,
    motmPlayerId,
    worstPlayerId,
    expelled,
    onRatingPicker: setRatingPicker,
    onNameMenu: setNameMenu,
    onSetRating: setRating,
    onToggleMotm: toggleMotm,
    onToggleWorst: toggleWorst,
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.ratingsSection}>
        <h3 className={styles.sectionTitle}>Titulares</h3>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>#</span>
            <span>Nome</span>
            <span>Pos</span>
            <span>Nota</span>
          </div>
          {sortedStarters.map(p => (
            <PlayerRow
              key={p.id}
              player={p}
              interactive
              rating={ratings[p.id] ?? null}
              {...rowProps}
            />
          ))}
        </div>
      </section>

      {sortedBench.length > 0 && (
        <section className={styles.ratingsSection}>
          <h3 className={styles.sectionTitle}>Banco</h3>
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span>#</span>
              <span>Nome</span>
              <span>Pos</span>
              <span>Nota</span>
            </div>
            {sortedBench.map(p => (
              <PlayerRow
                key={p.id}
                player={p}
                interactive={subbedInSet.has(p.id)}
                rating={ratings[p.id] ?? null}
                {...rowProps}
              />
            ))}
          </div>
        </section>
      )}

      <section className={styles.descSection}>
        <label className={styles.descLabel}>Descrição do jogo (opcional)</label>
        <textarea
          className={styles.textarea}
          value={description}
          onChange={e => onDescriptionChange(e.target.value)}
          placeholder="Como foi a partida? Destaques, clima, momentos importantes..."
          rows={5}
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
