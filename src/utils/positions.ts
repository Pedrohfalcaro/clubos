import type { AltPosition, PlayerPosition } from '../types/Player';
import type { SlotRole } from '../types/Tactics';

/** Um jogador pode ter até 3 subposições (posições alternativas em que não perde nada). */
export const MAX_ALT_POSITIONS = 3;

type Sector = 'gk' | 'def' | 'mid' | 'att';

/** Posição(ões) do elenco que ocupam exatamente a função do slot. */
const ROLE_EXACT: Record<SlotRole, AltPosition[]> = {
  GOL: ['GK'],
  ZAG: ['CB'],
  LE: ['LB'],
  LD: ['RB'],
  ALE: ['LWB'],
  ALD: ['RWB'],
  VOL: ['CDM'],
  MC: ['CM'],
  MEI: ['CAM'],
  ME: ['LM'],
  MD: ['RM'],
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

const POSITION_SECTOR: Record<AltPosition, Sector> = {
  GK: 'gk',
  CB: 'def',
  LB: 'def',
  RB: 'def',
  LWB: 'def',
  RWB: 'def',
  LM: 'mid',
  RM: 'mid',
  CDM: 'mid',
  CM: 'mid',
  CAM: 'mid',
  LW: 'att',
  RW: 'att',
  CF: 'att',
  ST: 'att',
};

export const POSITION_LABELS: Record<AltPosition, string> = {
  GK: 'Goleiro',
  CB: 'Zagueiro',
  LB: 'Lateral esquerdo',
  RB: 'Lateral direito',
  LWB: 'Ala esquerdo',
  RWB: 'Ala direito',
  LM: 'Meia esquerda',
  RM: 'Meia direita',
  CDM: 'Volante',
  CM: 'Meia',
  CAM: 'Meia-atacante',
  LW: 'Ponta esquerda',
  RW: 'Ponta direita',
  CF: 'Segundo atacante',
  ST: 'Atacante',
};

/** Siglas em português (as posições internas continuam com o código em inglês). */
const POSITION_ABBR: Record<AltPosition, string> = {
  GK: 'GOL',
  CB: 'ZAG',
  LB: 'LE',
  RB: 'LD',
  LWB: 'ALE',
  RWB: 'ALD',
  CDM: 'VOL',
  CM: 'MC',
  CAM: 'MEI',
  LM: 'ME',
  RM: 'MD',
  LW: 'PE',
  RW: 'PD',
  CF: 'SA',
  ST: 'ATA',
};

/** Sigla em português (ex.: CDM → VOL). */
export const posAbbr = (p: AltPosition | string): string => POSITION_ABBR[p as AltPosition] ?? p;

/** Nome por extenso em português (ex.: CDM → Volante). */
export const posName = (p: AltPosition | string): string => POSITION_LABELS[p as AltPosition] ?? p;

/** Posição do elenco equivalente, para calcular o encaixe de subposições extras. */
export const BASE_POSITION: Record<AltPosition, PlayerPosition> = {
  GK: 'GK', CB: 'CB', LB: 'LB', RB: 'RB', CDM: 'CDM', CM: 'CM', CAM: 'CAM', LW: 'LW', RW: 'RW', CF: 'CF', ST: 'ST',
  LWB: 'LB', RWB: 'RB', LM: 'LW', RM: 'RW',
};

/**
 * - `exact`: a posição do jogador (ou uma subposição) é a da função — não perde nada;
 * - `sector`: nenhuma é a exata, mas alguma é do mesmo setor — perde pouco (anel laranja);
 * - `off`: fora do setor — perde bastante (anel vermelho).
 */
export type PositionMatch = 'exact' | 'sector' | 'off';

export function positionMatch(
  player: { position: PlayerPosition; altPositions?: AltPosition[] },
  role: SlotRole,
): PositionMatch {
  const positions: AltPosition[] = [player.position, ...(player.altPositions ?? [])];
  if (positions.some(p => ROLE_EXACT[role].includes(p))) return 'exact';
  if (positions.some(p => POSITION_SECTOR[p] === ROLE_SECTOR[role])) return 'sector';
  return 'off';
}

/** Anel de aviso na escalação: laranja (mesmo setor), vermelho (fora do setor) ou nenhum. */
export function ringOf(
  player: { position: PlayerPosition; altPositions?: AltPosition[] },
  role: SlotRole,
): 'sector' | 'off' | undefined {
  const m = positionMatch(player, role);
  return m === 'exact' ? undefined : m;
}
