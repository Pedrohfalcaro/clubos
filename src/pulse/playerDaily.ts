import { recentResultsFromMatches } from './daily';
import { generatePlayerPulse, type PlayerPulseGenerateOutput } from './playerGenerator';
import { careerPlayerToPulseAthlete, careerPlayerToPulseClub } from './playerBridge';
import type { PulseHistoryEntry, PulseState } from './types';
import type { CareerPlayer } from '../types/CareerPlayer';
import type { Match } from '../types/Match';

export interface RollDailyPlayerPulseInput {
  player: CareerPlayer;
  currentDate: string;
  season: number;
  pulseState: PulseState;
  matches?: Match[];
}

/**
 * Pulse pessoal de dia sem jogo. Retorna `null` se nada aconteceu
 * (não abre o card no Dashboard).
 */
export function rollDailyPlayerPulse(input: RollDailyPlayerPulseInput): {
  output: PlayerPulseGenerateOutput;
  entry: PulseHistoryEntry;
} | null {
  const club = careerPlayerToPulseClub(input.player, input.season);
  const athlete = careerPlayerToPulseAthlete(input.player, input.currentDate);

  const output = generatePlayerPulse({
    club,
    athlete,
    pulseState: input.pulseState,
    recentResults: recentResultsFromMatches(input.matches),
  });

  if (output.resultado.tipo !== 'evento') return null;
  return { output, entry: output.historyEntry };
}
