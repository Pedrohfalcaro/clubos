import type { MatchMinute } from '../../types/Match';
import { formatMinute, minuteSortValue } from '../../utils/matchEvents';
import styles from './MatchTimeline.module.css';

export type TimelineEvent =
  | { id: string; side: 'home' | 'away'; kind: 'goal'; minute: MatchMinute; scorer: string; assist?: string }
  | { id: string; side: 'home' | 'away'; kind: 'own_goal'; minute: MatchMinute; scorer: string }
  | { id: string; side: 'home' | 'away'; kind: 'yellow'; minute: MatchMinute; player: string }
  | { id: string; side: 'home' | 'away'; kind: 'red'; minute: MatchMinute; player: string }
  | { id: string; side: 'home' | 'away'; kind: 'sub'; minute: MatchMinute; playerIn: string; playerOut: string };

interface MatchTimelineProps {
  events: TimelineEvent[];
  align?: 'left' | 'right';
}

export default function MatchTimeline({ events, align = 'left' }: MatchTimelineProps) {
  const sorted = [...events].sort((a, b) => minuteSortValue(a.minute) - minuteSortValue(b.minute));

  if (sorted.length === 0) return null;

  return (
    <ul className={`${styles.list} ${align === 'right' ? styles.listRight : ''}`}>
      {sorted.map(ev => (
        <li key={ev.id} className={styles.item}>
          <span className={styles.minute}>{formatMinute(ev.minute)}</span>
          {ev.kind === 'goal' && (
            <span className={styles.content}>
              <span className={styles.icon}>⚽</span>
              <span className={styles.nameWhite}>{ev.scorer}</span>
              {ev.assist && <span className={styles.nameGray}> ({ev.assist})</span>}
            </span>
          )}
          {ev.kind === 'own_goal' && (
            <span className={styles.content}>
              <span className={styles.iconRed}>🔴</span>
              <span className={styles.nameRed}>{ev.scorer}</span>
            </span>
          )}
          {ev.kind === 'yellow' && (
            <span className={styles.content}>
              <span className={styles.icon}>🟨</span>
              <span className={styles.nameYellow}>{ev.player}</span>
            </span>
          )}
          {ev.kind === 'red' && (
            <span className={styles.content}>
              <span className={styles.icon}>🟥</span>
              <span className={styles.nameRed}>{ev.player}</span>
            </span>
          )}
          {ev.kind === 'sub' && (
            <span className={styles.content}>
              <span className={styles.icon}>🔼</span>
              <span className={styles.nameWhiteStrong}>{ev.playerIn}</span>
              <span className={styles.icon}>🔽</span>
              <span className={styles.nameGray}>{ev.playerOut}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
