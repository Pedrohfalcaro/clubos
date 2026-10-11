import { computeRatings, pickMvp } from './rating.ts';
import { stepWorld } from './step.ts';
import { TUNING } from './tuning.ts';
import { createWorld } from './world.ts';
import type { MatchResult, MatchSetup, World } from './types.ts';

export function buildResult(w: World): MatchResult {
  const ratings = computeRatings(w);
  const stats: MatchResult['stats'] = {};
  const total = w.setup.halfDurationSec * 2;
  const now = w.phase === 'ft' ? total : Math.min(total, w.time);
  const shares: MatchResult['shares'] = {};
  for (const a of [...w.agents, ...w.subbedOut]) {
    stats[a.id] = a.stats;
    const end = Math.min(now, a.leftAt ?? now);
    shares[a.id] = Math.max(0, Math.min(1, (end - a.enteredAt) / total));
  }
  return {
    score: { ...w.score },
    stats,
    ratings,
    shares,
    mvpId: pickMvp(w, ratings),
    events: w.events,
    seed: w.setup.seed,
  };
}

/** Roda a partida inteira sem desenhar nada — usado pelo "Simular rápido" e pelos testes. */
export function simulateMatch(setup: MatchSetup): MatchResult {
  const w = createWorld(setup);
  // Teto de segurança: duração total + folga para as pausas de reinício
  const maxTicks = Math.ceil(((setup.halfDurationSec * 2 + 60) / TUNING.dt) * 1.5);
  for (let i = 0; i < maxTicks && w.phase !== 'ft'; i++) stepWorld(w);
  return buildResult(w);
}
