import { generatePulse } from './generator';
import { playerToPulseAthlete } from './athletes';
import type {
  PulseAthlete,
  PulseClub,
  PulseGenerateOutput,
  PulseHistoryEntry,
  PulseState,
} from './types';
import type { Player } from '../types/Player';
import type { Team } from '../types/Team';
import type { Match, MatchResult } from '../types/Match';

export interface RollDailyPulseInput {
  team: Team;
  players: Player[];
  pulseState: PulseState;
  season: number;
  matches?: Match[];
}

function recentResultsFromMatches(matches: Match[] | undefined): MatchResult[] {
  if (!matches?.length) return [];
  return matches
    .filter(m => m.status === 'completed' && m.result)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map(m => m.result!) ;
}

/**
 * Pulse de dia sem jogo. Filtra `match_only`.
 * Retorna null se nada aconteceu (não abre modal).
 */
export function rollDailyPulse(input: RollDailyPulseInput): {
  output: PulseGenerateOutput;
  entry: PulseHistoryEntry;
} | null {
  const club: PulseClub = {
    id: input.team.id,
    nome: input.team.name,
    temporadaAtual: input.season,
    boardConfidence: input.team.boardConfidence,
    supporterConfidence: input.team.supporterConfidence,
    mediaConfidence: input.team.mediaConfidence ?? 50,
  };
  const athletes: PulseAthlete[] = input.players.map(playerToPulseAthlete);

  const output = generatePulse({
    club,
    athletes,
    pulseState: input.pulseState,
    mode: 'daily',
    recentResults: recentResultsFromMatches(input.matches),
  });

  if (output.resultado.tipo !== 'evento') return null;
  return { output, entry: output.historyEntry };
}
