import type { PlayerPosition } from './Player';

/**
 * Colega de elenco do Modo Jogador — versão bem menor que `Player` (do treinador):
 * só o que aparece na tela de Elenco simplificada (nome/posição/idade/número) + moral
 * em relação a você. Sem overall/moral própria/lesão/contrato — não é jogável nem
 * escalável, existe só para dar contexto e autoria de gol/cartão nas partidas.
 */
export interface Teammate {
  id: string;
  name: string;
  position: PlayerPosition;
  age: number;
  number: number;
  /** 0–100. Sobe com gols seus, mais com assistências dadas a ele; cai com notas ruins.
   * Colegas da mesma posição que você reagem de forma mais rival (ver `utils/teammateMorale.ts`). */
  moraleTowardsPlayer: number;
}
