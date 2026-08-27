import { useMemo } from 'react';
import type { Player } from '../../../types/Player';
import type {
  OpponentCardEntry,
  OpponentGoalEntry,
  OpponentSubEntry,
  SubstitutionEvent,
  TeamCardEntry,
  TeamGoalEntry,
  TeamInjuryEntry,
} from '../../../types/Match';
import { formatMinute, minuteSortValue } from '../../../utils/matchEvents';
import styles from './steps.module.css';

type PitchSide = 'home' | 'away';

interface RecapEvent {
  id: string;
  minute: { base: number; stoppage?: number };
  pitchSide: PitchSide;
  icon: string;
  title: string;
  assist?: string;
}

interface MatchRecapStepProps {
  teamName: string;
  opponentName: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  competition: string;
  /** Where our club played */
  ourPitchSide: PitchSide;
  players: Player[];
  teamGoals: TeamGoalEntry[];
  opponentGoals: OpponentGoalEntry[];
  teamCards: TeamCardEntry[];
  teamSubs: SubstitutionEvent[];
  injuries: TeamInjuryEntry[];
  opponentCards?: OpponentCardEntry[];
  opponentSubs?: OpponentSubEntry[];
}

export default function MatchRecapStep({
  teamName,
  homeTeam,
  awayTeam,
  homeGoals,
  awayGoals,
  competition,
  ourPitchSide,
  players,
  teamGoals,
  opponentGoals,
  teamCards,
  teamSubs,
  injuries,
  opponentCards = [],
  opponentSubs = [],
}: MatchRecapStepProps) {
  const theirPitchSide: PitchSide = ourPitchSide === 'home' ? 'away' : 'home';

  const events = useMemo(() => {
    const list: RecapEvent[] = [];

    for (const g of teamGoals) {
      if (g.type === 'own') {
        // Autogol do adversário a nosso favor — conta no NOSSO placar.
        list.push({
          id: g.id,
          minute: g.minute,
          pitchSide: ourPitchSide,
          icon: '🔴⚽',
          title: `${g.opponentScorerName?.trim() || 'Gol contra'} (contra)`,
        });
      } else {
        const scorer = players.find(p => p.id === g.playerId)?.name ?? '—';
        const assist = g.assistPlayerId
          ? players.find(p => p.id === g.assistPlayerId)?.name
          : undefined;
        list.push({
          id: g.id,
          minute: g.minute,
          pitchSide: ourPitchSide,
          icon: '⚽',
          title: scorer,
          assist,
        });
      }
    }

    for (const g of opponentGoals) {
      list.push({
        id: g.id,
        minute: g.minute,
        pitchSide: theirPitchSide,
        icon: '⚽',
        title: g.scorerName || '—',
        assist: g.assistName?.trim() || undefined,
      });
    }

    for (const c of teamCards) {
      list.push({
        id: c.id,
        minute: c.minute,
        pitchSide: ourPitchSide,
        icon: c.type === 'yellow' ? '🟨' : '🟥',
        title: c.playerName,
      });
    }

    for (const c of opponentCards) {
      list.push({
        id: c.id,
        minute: c.minute,
        pitchSide: theirPitchSide,
        icon: c.type === 'yellow' ? '🟨' : '🟥',
        title: c.playerName || '—',
      });
    }

    for (const s of opponentSubs) {
      list.push({
        id: s.id,
        minute: s.minute,
        pitchSide: theirPitchSide,
        icon: '⇅',
        title: `${s.playerIn || '—'} ← ${s.playerOut || '—'}`,
      });
    }

    for (const i of injuries) {
      list.push({
        id: i.id,
        minute: i.minute,
        pitchSide: ourPitchSide,
        icon: '✚',
        title: i.note ? `${i.playerName} · ${i.note}` : i.playerName,
      });
    }

    for (const s of teamSubs.filter(x => x.side === 'team')) {
      list.push({
        id: s.id,
        minute: s.minute,
        pitchSide: ourPitchSide,
        icon: '⇅',
        title: `${s.playerInName} ← ${s.playerOutName}`,
      });
    }

    return list.sort((a, b) => minuteSortValue(a.minute) - minuteSortValue(b.minute));
  }, [
    teamGoals,
    opponentGoals,
    teamCards,
    opponentCards,
    opponentSubs,
    injuries,
    teamSubs,
    players,
    ourPitchSide,
    theirPitchSide,
  ]);

  return (
    <div className={styles.wrap}>
      <div className={styles.recapScore}>
        <div className={styles.recapTeams}>
          <span className={styles.recapTeam}>{homeTeam}</span>
          <span className={styles.recapNums}>
            {homeGoals}–{awayGoals}
          </span>
          <span className={styles.recapTeam}>{awayTeam}</span>
        </div>
        <p className={styles.recapComp}>{competition}</p>
      </div>

      {events.length === 0 ? (
        <div className={styles.tlEmpty}>Nenhum lance registrado.</div>
      ) : (
        <div className={styles.dualTimeline}>
          <div className={styles.dualHead}>
            <span>{homeTeam}</span>
            <span />
            <span>{awayTeam}</span>
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
                <span className={styles.dualMin}>{formatMinute(ev.minute)}</span>
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

      <p className={styles.hint}>
        Cronologia · {teamName} {ourPitchSide === 'home' ? '(casa)' : '(fora)'}
      </p>
    </div>
  );
}
