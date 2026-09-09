import type { Player } from '../types/Player';
import { emptyPlayerStats } from '../types/Player';
import type { CareerPlayer } from '../types/CareerPlayer';
import type { Teammate } from '../types/Teammate';

/**
 * Pseudo-elenco pra reaproveitar os helpers genéricos do motor de partida do treinador
 * (`buildGoalEvents`/`buildCardEvents`/`buildAssistEvents`, que só leem `.id`/`.name` de
 * `Player[]`) sem duplicar essas funções — mesma técnica de `nationalPlayerToPseudoPlayer`
 * (v1.4). Nunca escrito de volta em `state.players`; existe só durante a montagem da partida.
 */
export function careerPlayerToPseudoPlayer(player: CareerPlayer): Player {
  return {
    id: player.id,
    teamId: 'self',
    name: player.name,
    position: player.position,
    number: player.number,
    age: player.age,
    overall: player.overall,
    potential: player.potential,
    morale: player.morale,
    salary: 0,
    marketValue: 0,
    status: 'Titular',
    stats: emptyPlayerStats(),
  };
}

export function teammateToPseudoPlayer(teammate: Teammate): Player {
  return {
    id: teammate.id,
    teamId: 'self',
    name: teammate.name,
    position: teammate.position,
    number: teammate.number,
    age: teammate.age,
    overall: 70,
    potential: 70,
    morale: teammate.moraleTowardsPlayer,
    salary: 0,
    marketValue: 0,
    status: 'Titular',
    stats: emptyPlayerStats(),
  };
}

export function buildPseudoSquad(player: CareerPlayer): Player[] {
  return [careerPlayerToPseudoPlayer(player), ...player.teammates.map(teammateToPseudoPlayer)];
}
