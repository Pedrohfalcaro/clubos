import type { Match, SubstitutionEvent } from '../types/Match';
import type { Player } from '../types/Player';
import { getMatchPlayingTime } from './playingTime';

const MORALE = {
  starter: 3,
  unusedBench: -3,
  cameOn: 2,
  subbedOff: -1,
  winOnField: 4,
  lossOnField: -4,
} as const;

function clampMorale(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function teamSubs(match: Pick<Match, 'substitutions'>): SubstitutionEvent[] {
  return (match.substitutions ?? []).filter(s => s.side === 'team' && s.playerInId);
}

/**
 * Ajusta a moral do elenco após uma partida concluída.
 * Vitória/derrota só contam para quem esteve em campo.
 */
export function applyMatchMoraleToPlayers(
  players: Player[],
  match: Pick<Match, 'lineup' | 'substitutions' | 'result' | 'playerMatches' | 'injuries' | 'goalsAgainst'>,
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

  return players.map(p => {
    if (!involved.has(p.id)) return p;

    let delta = 0;
    const played = onField.has(p.id);
    const isStarter = starters.has(p.id);
    const entered = cameOn.has(p.id) && !isStarter;
    const unusedReserve = bench.has(p.id) && !played && !isStarter;

    if (isStarter) delta += MORALE.starter;
    if (unusedReserve) delta += MORALE.unusedBench;
    if (entered) delta += MORALE.cameOn;
    if (subbedOff.has(p.id) && played) delta += MORALE.subbedOff;

    if (played) {
      if (result === 'win') delta += MORALE.winOnField;
      else if (result === 'loss') delta += MORALE.lossOnField;
    }

    if (delta === 0) return p;
    return { ...p, morale: clampMorale((p.morale ?? 70) + delta) };
  });
}
