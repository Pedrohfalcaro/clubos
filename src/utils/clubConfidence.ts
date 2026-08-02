import type { MatchLocation, MatchResult, MatchSignificance } from '../types/Match';

/** Deltas base (ainda usados como referência / testes). */
export const BOARD_RESULT_DELTA: Record<MatchResult, number> = {
  win: 3,
  draw: 0,
  loss: -4,
};

export const SUPPORTER_RESULT_DELTA: Record<MatchResult, number> = {
  win: 4,
  draw: -1,
  loss: -5,
};

export function clampConfidence(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function resultConfidenceReason(result: MatchResult): string {
  if (result === 'win') return 'Vitória';
  if (result === 'draw') return 'Empate';
  return 'Derrota';
}

export interface MatchClimateInput {
  result: MatchResult;
  goalsFor: number;
  goalsAgainst: number;
  location: MatchLocation;
  significance?: MatchSignificance | null;
  /** Resultados anteriores, mais recente primeiro (sem o jogo atual). */
  recentResults?: MatchResult[];
  boardConfidence: number;
  supporterConfidence: number;
}

export interface MatchClimateDelta {
  board: number;
  supporter: number;
  reason: string;
}

/** Suaviza extremos: perto de 0/100 os deltas encolhem. */
export function softScaleDelta(current: number, delta: number): number {
  if (delta === 0) return 0;
  if (delta > 0) {
    if (current >= 90) return Math.max(1, Math.round(delta * 0.35));
    if (current >= 80) return Math.max(1, Math.round(delta * 0.55));
    if (current >= 70) return Math.round(delta * 0.8);
    return delta;
  }
  if (current <= 10) return Math.min(-1, Math.round(delta * 0.35));
  if (current <= 20) return Math.min(-1, Math.round(delta * 0.55));
  if (current <= 35) return Math.round(delta * 0.8);
  return delta;
}

function significanceFactor(sig?: MatchSignificance | null): { board: number; fans: number } {
  switch (sig) {
    case 'derby':
    case 'rivalry':
      return { board: 1.25, fans: 1.45 };
    case 'title':
    case 'cup_final':
      return { board: 1.55, fans: 1.5 };
    case 'decisive':
      return { board: 1.4, fans: 1.35 };
    case 'relegation':
      return { board: 1.5, fans: 1.55 };
    case 'revenge':
      return { board: 1.2, fans: 1.35 };
    case 'debut':
      return { board: 1.15, fans: 1.2 };
    default:
      return { board: 1, fans: 1 };
  }
}

/**
 * Deltas dinâmicos de diretoria/torcida pós-partida.
 * Considera placar, mando, importância e sequência recente.
 */
export function calcMatchClimateDeltas(input: MatchClimateInput): MatchClimateDelta {
  const {
    result,
    goalsFor,
    goalsAgainst,
    location,
    significance,
    recentResults = [],
    boardConfidence,
    supporterConfidence,
  } = input;

  let board = BOARD_RESULT_DELTA[result];
  let supporter = SUPPORTER_RESULT_DELTA[result];
  const margin = Math.abs(goalsFor - goalsAgainst);
  const bits: string[] = [resultConfidenceReason(result)];

  // Margem
  if (result === 'win' && margin >= 3) {
    board += 2;
    supporter += 3;
    bits.push('goleada');
  } else if (result === 'loss' && margin >= 3) {
    board -= 3;
    supporter -= 4;
    bits.push('humilhação');
  } else if (result === 'win' && margin === 1) {
    // Vitória apertada: torcida vibra, diretoria fica só ok
    supporter += 1;
  }

  if (result === 'win' && goalsAgainst === 0) {
    board += 1;
    supporter += 1;
    bits.push('clean sheet');
  }

  // Mando de campo
  if (location === 'home') {
    if (result === 'win') supporter += 1;
    if (result === 'loss') {
      supporter -= 2;
      board -= 1;
      bits.push('em casa');
    }
    if (result === 'draw') supporter -= 1;
  } else if (location === 'away') {
    if (result === 'win') {
      board += 1;
      supporter += 2;
      bits.push('fora');
    }
    if (result === 'loss') board -= 1;
  }

  // Sequência
  const prev = recentResults.slice(0, 3);
  const prevLosses = prev.filter(r => r === 'loss').length;
  const prevWins = prev.filter(r => r === 'win').length;

  if (result === 'win' && prevLosses >= 2) {
    board += 2;
    supporter += 3;
    bits.push('alívio após crise');
  } else if (result === 'win' && prevWins >= 2) {
    supporter += 1;
    bits.push('sequência');
  } else if (result === 'loss' && prevLosses >= 2) {
    board -= 2;
    supporter -= 2;
    bits.push('crise');
  } else if (result === 'loss' && prevWins >= 2) {
    supporter -= 2;
    bits.push('quebra de sequência');
  } else if (result === 'draw' && prevLosses >= 2) {
    board += 1;
    bits.push('ponto na crise');
  }

  // Importância da partida
  const sig = significanceFactor(significance);
  board = Math.round(board * sig.board);
  supporter = Math.round(supporter * sig.fans);
  if (significance && significance !== 'normal') {
    bits.push('jogo importante');
  }

  board = softScaleDelta(boardConfidence, board);
  supporter = softScaleDelta(supporterConfidence, supporter);

  return {
    board,
    supporter,
    reason: bits.join(' · '),
  };
}

/** Drift diário leve da confiança do clube (dias sem jogo). */
export function dailyClimateDrift(input: {
  boardConfidence: number;
  supporterConfidence: number;
  mediaConfidence?: number;
}): { board: number; supporter: number; media: number; reason: string | null } {
  let board = 0;
  let supporter = 0;
  let media = 0;

  // Regressão suave ao centro
  if (input.boardConfidence >= 78 && Math.random() < 0.28) board = -1;
  else if (input.boardConfidence <= 28 && Math.random() < 0.32) board = 1;

  if (input.supporterConfidence >= 80 && Math.random() < 0.3) supporter = -1;
  else if (input.supporterConfidence <= 25 && Math.random() < 0.35) supporter = 1;

  const m = input.mediaConfidence ?? 50;
  // Mídia raramente sobe sozinha; às vezes esfria relação boa
  if (m >= 65 && Math.random() < 0.35) media = -1;
  else if (m <= 20 && Math.random() < 0.2) media = 1;

  if (!board && !supporter && !media) {
    return { board: 0, supporter: 0, media: 0, reason: null };
  }
  return {
    board,
    supporter,
    media,
    reason: 'Oscilação natural do clima',
  };
}
