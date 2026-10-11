import { useEffect, useState } from 'react';
import type { Player } from '../../types/Player';
import { kitNumberColor, numberOutline, type Kit } from '../../types/Kit';
import { getKitSpriteUrl, onKitImagesLoaded } from '../../utils/kitRender';
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
  /** Uniforme completo (cor + desenho + cor do número); sobrepõe `kitColor` nos jogadores de linha. */
  kit?: Kit;
  /** Escalado fora da posição: laranja (mesmo setor) ou vermelho (outro setor). */
  ring?: 'sector' | 'off';
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
  kit,
  ring,
  primaryColor,
  secondaryColor,
}: PlayerJerseyProps) {
  const isGk = player.position === 'GK';
  const [, setTick] = useState(0);
  useEffect(() => onKitImagesLoaded(() => setTick(t => t + 1)), []);
  const outfieldKit = !isGk ? kit : undefined;

  const shirtHex = isGk
    ? gkShirtColor(primaryColor ?? kitColor, secondaryColor)
    : (outfieldKit?.base ?? kitColor);

  let shirtStyle: React.CSSProperties | undefined = shirtHex
    ? {
        background: shirtHex,
        borderColor: shirtHex,
        color: contrastText(shirtHex),
      }
    : undefined;

  // Uniforme com desenho: o padrão preenche a camisa e o número ganha contorno para ler bem
  let numberStyle: React.CSSProperties | undefined = shirtStyle ? { color: 'inherit' } : undefined;
  if (outfieldKit) {
    const numColor = kitNumberColor(outfieldKit);
    const outline = numberOutline(numColor);
    const patterned = outfieldKit.design.type !== 'solid';
    shirtStyle = {
      ...shirtStyle,
      ...(patterned
        ? { backgroundImage: `url(${getKitSpriteUrl(outfieldKit)})`, backgroundSize: '100% 100%' }
        : {}),
    };
    numberStyle = {
      color: numColor,
      ...(patterned
        ? { textShadow: `-1px -1px 0 ${outline}, 1px -1px 0 ${outline}, -1px 1px 0 ${outline}, 1px 1px 0 ${outline}` }
        : {}),
    };
  }

  return (
    <div
      className={`${styles.jersey} ${styles[size]} ${isGk ? styles.gk : ''} ${selected ? styles.selected : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      title={player.name}
    >
      <div
        className={`${styles.shirt} ${ring === 'sector' ? styles.ringSector : ring === 'off' ? styles.ringOff : ''}`}
        style={shirtStyle}
        title={ring === 'sector' ? 'Fora da posição exata (mesmo setor)' : ring === 'off' ? 'Fora da posição e do setor' : undefined}
      >
        <span className={styles.number} style={numberStyle}>
          {player.number ?? '—'}
        </span>
      </div>
      {!hideName && <span className={styles.name}>{player.name}</span>}
    </div>
  );
}
