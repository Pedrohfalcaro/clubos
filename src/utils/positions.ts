import type { PlayerPosition } from '../types/Player';
import type { SlotRole } from '../types/Tactics';

/** Um jogador pode ter até 3 subposições (posições alternativas em que não perde nada). */
export const MAX_ALT_POSITIONS = 3;

type Sector = 'gk' | 'def' | 'mid' | 'att';

/** Posição(ões) do elenco que ocupam exatamente a função do slot. */
const ROLE_EXACT: Record<SlotRole, PlayerPosition[]> = {
  GOL: ['GK'],
  ZAG: ['CB'],
  LE: ['LB'],
  LD: ['RB'],
  ALE: ['LB'],
  ALD: ['RB'],
  VOL: ['CDM'],
  MC: ['CM'],
  MEI: ['CAM'],
  ME: ['LW'],
  MD: ['RW'],
  PE: ['LW'],
  PD: ['RW'],
  SA: ['CF'],
  ATA: ['ST'],
};

/** Setor (linha) do campo em que a função do slot joga. */
const ROLE_SECTOR: Record<SlotRole, Sector> = {
  GOL: 'gk',
  ZAG: 'def',
  LE: 'def',
  LD: 'def',
  ALE: 'def',
  ALD: 'def',
  VOL: 'mid',
  MC: 'mid',
  MEI: 'mid',
  ME: 'mid',
  MD: 'mid',
  PE: 'att',
  PD: 'att',
  SA: 'att',
  ATA: 'att',
};

const POSITION_SECTOR: Record<PlayerPosition, Sector> = {
  GK: 'gk',
  CB: 'def',
  LB: 'def',
  RB: 'def',
  CDM: 'mid',
  CM: 'mid',
  CAM: 'mid',
  LW: 'att',
  RW: 'att',
  CF: 'att',
  ST: 'att',
};

export const POSITION_LABELS: Record<PlayerPosition, string> = {
  GK: 'Goleiro',
  CB: 'Zagueiro',
  LB: 'Lateral esquerdo',
  RB: 'Lateral direito',
  CDM: 'Volante',
  CM: 'Meia',
  CAM: 'Meia-atacante',
  LW: 'Ponta esquerda',
  RW: 'Ponta direita',
  CF: 'Segundo atacante',
  ST: 'Atacante',
};

/**
 * - `exact`: a posição do jogador (ou uma subposição) é a da função — não perde nada;
 * - `sector`: nenhuma é a exata, mas alguma é do mesmo setor — perde pouco (anel laranja);
 * - `off`: fora do setor — perde bastante (anel vermelho).
 */
export type PositionMatch = 'exact' | 'sector' | 'off';

export function positionMatch(
  player: { position: PlayerPosition; altPositions?: PlayerPosition[] },
  role: SlotRole,
): PositionMatch {
  const positions = [player.position, ...(player.altPositions ?? [])];
  if (positions.some(p => ROLE_EXACT[role].includes(p))) return 'exact';
  if (positions.some(p => POSITION_SECTOR[p] === ROLE_SECTOR[role])) return 'sector';
  return 'off';
}

/** Anel de aviso na escalação: laranja (mesmo setor), vermelho (fora do setor) ou nenhum. */
export function ringOf(
  player: { position: PlayerPosition; altPositions?: PlayerPosition[] },
  role: SlotRole,
): 'sector' | 'off' | undefined {
  const m = positionMatch(player, role);
  return m === 'exact' ? undefined : m;
}
