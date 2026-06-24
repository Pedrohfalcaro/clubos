import type { Player } from '../../types/Player';
import styles from './PlayerJersey.module.css';

interface PlayerJerseyProps {
  player: Player;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onClick?: () => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  selected?: boolean;
  hideName?: boolean;
}

export default function PlayerJersey({
  player,
  draggable = false,
  onDragStart,
  onClick,
  size = 'md',
  selected,
  hideName = false,
}: PlayerJerseyProps) {
  const isGk = player.position === 'GK';

  return (
    <div
      className={`${styles.jersey} ${styles[size]} ${isGk ? styles.gk : ''} ${selected ? styles.selected : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      title={player.name}
    >
      <div className={styles.shirt}>
        <span className={styles.number}>{player.number ?? '—'}</span>
      </div>
      {!hideName && <span className={styles.name}>{player.name}</span>}
    </div>
  );
}