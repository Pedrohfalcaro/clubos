import type { Match } from '../types/Match';
import type { PlayerMatchPerformance } from '../types/PlayerMatchPerformance';

export interface PlayerHeadline {
  content: string;
  body: string;
}

function resultWord(match: Match): string {
  if (match.result === 'win') return 'na vitória';
  if (match.result === 'loss') return 'na derrota';
  if (match.result === 'draw') return 'no empate';
  return 'na partida';
}

/**
 * Manchete pessoal gerada a partir do desempenho registrado — mesmo espírito
 * de `socialHeadlines.ts` do clube (prioriza o fato mais marcante), mas bem
 * menor: aqui só existe 1 atleta pra narrar.
 */
export function buildPlayerMatchHeadline(input: {
  playerName: string;
  clubName: string;
  match: Match;
  performance: PlayerMatchPerformance;
}): PlayerHeadline {
  const { playerName, clubName, match, performance: p } = input;
  const vs = `${clubName} ${match.goalsFor}×${match.goalsAgainst} ${match.opponent}`;

  if (p.role === 'notCalled') {
    return {
      content: `${playerName} fica fora dos relacionados diante do ${match.opponent}`,
      body: `Não relacionado para o duelo contra o ${match.opponent}. ${vs}.`,
    };
  }

  if (p.goals >= 3) {
    return {
      content: `Hat-trick! ${playerName} balança as redes 3 vezes ${resultWord(match)}`,
      body: `Atuação de gala de ${playerName}, com 3 gols ${resultWord(match)} contra o ${match.opponent}. ${vs}.`,
    };
  }

  if (p.redCards > 0) {
    return {
      content: `${playerName} vê o vermelho diante do ${match.opponent}`,
      body: `Expulsão em campo ${resultWord(match)} contra o ${match.opponent}. ${vs}.`,
    };
  }

  if (p.goals === 2) {
    return {
      content: `${playerName} marca duas vezes ${resultWord(match)}`,
      body: `Dois gols de ${playerName} ${resultWord(match)} contra o ${match.opponent}. ${vs}.`,
    };
  }

  if (p.rating != null && p.rating >= 8.5) {
    return {
      content: `Atuação de gala: ${playerName} é destaque ${resultWord(match)}`,
      body: `Nota ${p.rating.toFixed(1)} ${resultWord(match)} contra o ${match.opponent}. ${vs}.`,
    };
  }

  if (p.goals === 1 && p.assists >= 1) {
    return {
      content: `${playerName} participa de gol e dá assistência ${resultWord(match)}`,
      body: `Gol e assistência de ${playerName} ${resultWord(match)} contra o ${match.opponent}. ${vs}.`,
    };
  }

  if (p.goals === 1) {
    return {
      content: `${playerName} marca ${resultWord(match)} contra o ${match.opponent}`,
      body: `Gol de ${playerName} ${resultWord(match)}. ${vs}.`,
    };
  }

  if (p.assists >= 1) {
    return {
      content: `${playerName} distribui assistência ${resultWord(match)}`,
      body: `Assistência de ${playerName} ${resultWord(match)} contra o ${match.opponent}. ${vs}.`,
    };
  }

  if (p.rating != null && p.rating < 5) {
    return {
      content: `Dia difícil: ${playerName} tem atuação abaixo ${resultWord(match)}`,
      body: `Nota ${p.rating.toFixed(1)} ${resultWord(match)} contra o ${match.opponent}. ${vs}.`,
    };
  }

  if (p.role === 'substitute') {
    return {
      content: `${playerName} entra no decorrer do jogo ${resultWord(match)}`,
      body: `Minutos como reserva ${resultWord(match)} contra o ${match.opponent}. ${vs}.`,
    };
  }

  return {
    content: `${playerName} atua ${resultWord(match)} contra o ${match.opponent}`,
    body: `${p.minutesPlayed} minutos em campo ${resultWord(match)}. ${vs}.`,
  };
}
