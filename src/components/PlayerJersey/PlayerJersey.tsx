import type { Player } from '../../types/Player';
import styles from './PlayerJersey.module.css';
import { contrastText, gkShirtColor } from '../../utils/clubColors';

interface PlayerJerseyProps {
  player: Player;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onClick?: () => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  selected?: boolean;
  hideName?: boolean;
  /** Club kit color for outfield players */
  kitColor?: string;
  /** Club colors — used so GK avoids yellow when either is yellowish */
  primaryColor?: string;
  secondaryColor?: string;
}

export default function PlayerJersey({
  player,
  draggable = false,
  onDragStart,
  onClick,
  size = 'md',
  selected,
  hideName = false,
  kitColor,
  primaryColor,
  secondaryColor,
}: PlayerJerseyProps) {
  const isGk = player.position === 'GK';

  const shirtHex = isGk
    ? gkShirtColor(primaryColor ?? kitColor, secondaryColor)
    : kitColor;

  const shirtStyle = shirtHex
    ? {
        background: shirtHex,
        borderColor: shirtHex,
        color: contrastText(shirtHex),
      }
    : undefined;

  return (
    <div
      className={`${styles.jersey} ${styles[size]} ${isGk ? styles.gk : ''} ${selected ? styles.selected : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      title={player.name}
    >
      <div className={styles.shirt} style={shirtStyle}>
        <span className={styles.number} style={shirtStyle ? { color: 'inherit' } : undefined}>
          {player.number ?? '—'}
        </span>
      </div>
      {!hideName && <span className={styles.name}>{player.name}</span>}
    </div>
  );
}
