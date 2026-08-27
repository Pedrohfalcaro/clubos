import type { Match, MatchSignificance, SubstitutionEvent } from '../types/Match';
import type { Player } from '../types/Player';
import { getMatchPlayingTime } from './playingTime';

function clampMorale(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function teamSubs(match: Pick<Match, 'substitutions'>): SubstitutionEvent[] {
  return (match.substitutions ?? []).filter(s => s.side === 'team' && s.playerInId);
}

function significanceMoraleFactor(sig?: MatchSignificance | null): number {
  switch (sig) {
    case 'derby':
    case 'rivalry':
    case 'revenge':
      return 1.25;
    case 'title':
    case 'cup_final':
    case 'decisive':
    case 'relegation':
      return 1.4;
    case 'debut':
      return 1.15;
    default:
      return 1;
  }
}

/**
 * Ajusta a moral do elenco após uma partida.
 * Leva em conta papel, resultado, nota, gols, cartões e importância do jogo.
 */
export function applyMatchMoraleToPlayers(
  players: Player[],
  match: Pick<
    Match,
    | 'lineup'
    | 'substitutions'
    | 'result'
    | 'playerMatches'
    | 'injuries'
    | 'goalsAgainst'
    | 'goalsFor'
    | 'goals'
    | 'assists'
    | 'cards'
    | 'playerRatings'
    | 'motmPlayerId'
    | 'worstPlayerId'
    | 'significance'
    | 'location'
  >,
): Player[] {
  const starters = new Set(match.lineup?.formation?.map(s => s.playerId) ?? []);
  const bench = new Set(match.lineup?.bench ?? []);
  const subs = teamSubs(match);
  const cameOn = new Set(subs.map(s => s.playerInId).filter(Boolean) as string[]);
  const subbedOff = new Set(subs.map(s => s.playerOutId).filter(Boolean) as string[]);
  const playingTime = getMatchPlayingTime(match as Match);
  const onField = new Set(
    [...playingTime.entries()].filter(([, mins]) => mins > 0).map(([id]) => id),
  );

  const involved = new Set<string>([...starters, ...bench, ...cameOn, ...onField]);
  if (involved.size === 0) return players;

  const result = match.result;
  const sigF = significanceMoraleFactor(match.significance);
  const margin = Math.abs((match.goalsFor ?? 0) - (match.goalsAgainst ?? 0));
  const ratingById = new Map(
    (match.playerRatings ?? []).map(r => [r.playerId, r.rating] as const),
  );
  const goalsById = new Map<string, number>();
  for (const g of match.goals ?? []) {
    if (g.isOwnGoal || !g.playerId) continue;
    goalsById.set(g.playerId, (goalsById.get(g.playerId) ?? 0) + 1);
  }
  const assistsById = new Map<string, number>();
  for (const a of match.assists ?? []) {
    if (!a.playerId) continue;
    assistsById.set(a.playerId, (assistsById.get(a.playerId) ?? 0) + 1);
  }
  const cardsById = new Map<string, { y: number; r: number }>();
  for (const c of match.cards ?? []) {
    const prev = cardsById.get(c.playerId) ?? { y: 0, r: 0 };
    if (c.type === 'red') prev.r += 1;
    else prev.y += 1;
    cardsById.set(c.playerId, prev);
  }

  const attackPos = new Set(['ST', 'CF', 'LW', 'RW']);

  return players.map(p => {
    if (!involved.has(p.id)) return p;

    let delta = 0;
    const mins = playingTime.get(p.id) ?? 0;
    const played = mins > 0;
    const isStarter = starters.has(p.id);
    const entered = cameOn.has(p.id) && !isStarter;
    const unusedReserve = bench.has(p.id) && !played && !isStarter;

    // Papel no jogo
    if (isStarter) delta += 2;
    if (unusedReserve) {
      delta += result === 'win' ? -2 : result === 'loss' ? -4 : -3;
    }
    if (entered) delta += 2;
    if (subbedOff.has(p.id) && played) delta += mins >= 60 ? -1 : 0;

    // Resultado (só quem jogou) — escala com importância e margem
    if (played) {
      let resultDelta: number;
      if (result === 'win') {
        resultDelta = 4 + (margin >= 3 ? 2 : 0);
        if (match.location === 'away') resultDelta += 1;
      } else if (result === 'loss') {
        resultDelta = -4 - (margin >= 3 ? 2 : 0);
        if (match.location === 'home') resultDelta -= 1;
      } else {
        resultDelta = mins >= 70 ? -1 : 0;
      }
      delta += Math.round(resultDelta * sigF);
    }

    // Desempenho individual
    const goals = goalsById.get(p.id) ?? 0;
    const assists = assistsById.get(p.id) ?? 0;
    delta += goals * 3;
    delta += assists * 2;
    if (goals >= 3) delta += 4; // hat-trick bonus
    else if (goals === 2) delta += 2;

    const rating = ratingById.get(p.id);
    if (rating != null && played) {
      delta += Math.round((rating - 6.5) * 2.2);
    }

    if (match.motmPlayerId === p.id) delta += 5;
    if (match.worstPlayerId === p.id) delta -= 5;

    const cards = cardsById.get(p.id);
    if (cards) {
      delta -= cards.y * 1;
      delta -= cards.r * 8;
    }

    // Atacante jogou bastante sem marcar em derrota/empate
    if (
      played &&
      mins >= 60 &&
      attackPos.has(p.position) &&
      goals === 0 &&
      (result === 'loss' || result === 'draw')
    ) {
      delta -= 3;
    }

    if (delta === 0) return p;
    return { ...p, morale: clampMorale((p.morale ?? 70) + delta) };
  });
}

/** Drift diário de moral do elenco (lesão, regressão/recuperação). */
export function applyDailySquadMoraleDrift(players: Player[]): Player[] {
  return players.map(p => {
    const m = p.morale ?? 70;
    let delta = 0;
    const avail = p.availability ?? 'disponivel';

    if (avail === 'lesionado') {
      delta = Math.random() < 0.55 ? -1 : 0;
    } else if (avail === 'indisponivel' || avail === 'suspenso') {
      delta = Math.random() < 0.35 ? -1 : 0;
    } else if (m >= 82 && Math.random() < 0.3) {
      delta = -1; // euforia esfria
    } else if (m <= 32 && Math.random() < 0.4) {
      delta = 1; // recuperação natural
    } else if (m <= 22 && Math.random() < 0.25) {
      delta = 1;
    }

    if (!delta) return p;
    return { ...p, morale: clampMorale(m + delta) };
  });
}
