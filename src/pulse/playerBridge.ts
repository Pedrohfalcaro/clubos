import type { CareerPlayer } from '../types/CareerPlayer';
import { isInjuryActive } from '../utils/playerClock';
import { toPulsePosition } from './athletes';
import type { PulseAthlete, PulseClub } from './types';

/** Converte o `CareerPlayer` num "atleta" de Pulse — pool de exatamente 1. */
export function careerPlayerToPulseAthlete(player: CareerPlayer, currentDate: string): PulseAthlete {
  const injured = player.injuries.some(i => isInjuryActive(i, currentDate));
  return {
    id: player.id,
    nome: player.name,
    posicao: toPulsePosition(player.position),
    idade: player.age,
    personalidade: 'Disciplinado',
    moral: player.morale,
    fadiga: 0,
    status: injured ? 'lesionado' : 'disponivel',
    matches: player.seasonStats.matches,
    goals: player.seasonStats.goals,
    assists: player.seasonStats.assists,
  };
}

/**
 * "Clube" de mentirinha para reaproveitar o motor de Pulse: `boardConfidence`
 * espelha a confiança do técnico e `supporterConfidence` a reputação com a
 * torcida. Sem `mediaConfidence` — o jogador ainda não tem um eixo de mídia.
 */
export function careerPlayerToPulseClub(player: CareerPlayer, season: number): PulseClub {
  return {
    id: player.id,
    nome: player.currentClub.name || 'seu clube',
    temporadaAtual: season,
    boardConfidence: player.coachConfidence,
    supporterConfidence: player.fanReputation,
  };
}
