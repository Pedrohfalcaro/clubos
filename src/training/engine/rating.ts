import type { Agent, Format, PlayerMatchStats, RoleGroup, World } from './types.ts';

/** Pesos por evento e grupo de função — ver GAME_DESIGN_TRAINING_PIT.md §6.2. */
interface Weights {
  goal: number;
  assist: number;
  shotOn: number;
  shotOff: number;
  passOk: number;
  passBad: number;
  keyPass: number;
  tackle: number;
  interception: number;
  clearance: number;
  loss: number;
  save: number;
  conceded: number;
  cleanSheet: number;
  foul: number;
  foulWon: number;
  yellow: number;
  red: number;
  dribbleWon: number;
  offside: number;
}

const WEIGHTS: Record<RoleGroup, Weights> = {
  GK: {
    goal: 3.5, assist: 2, shotOn: 0, shotOff: 0, passOk: 0.04, passBad: -0.2, keyPass: 0,
    tackle: 0, interception: 0, clearance: 0.3, loss: 0, save: 0.9, conceded: -0.6, cleanSheet: 1.5, foul: -0.4, foulWon: 0, yellow: -0.5, red: -2.5, dribbleWon: 0, offside: -0.15,
  },
  DEF: {
    goal: 3.5, assist: 2, shotOn: 0.3, shotOff: -0.1, passOk: 0.05, passBad: -0.2, keyPass: 0.6,
    tackle: 0.8, interception: 0.8, clearance: 0.6, loss: -0.5, save: 0, conceded: -0.5, cleanSheet: 1, foul: -0.4, foulWon: 0.1, yellow: -0.5, red: -2.5, dribbleWon: 0.2, offside: -0.15,
  },
  MID: {
    goal: 3, assist: 2, shotOn: 0.4, shotOff: -0.1, passOk: 0.08, passBad: -0.12, keyPass: 0.8,
    tackle: 0.5, interception: 0.5, clearance: 0.2, loss: -0.3, save: 0, conceded: -0.2, cleanSheet: 0.3, foul: -0.4, foulWon: 0.2, yellow: -0.5, red: -2.5, dribbleWon: 0.35, offside: -0.15,
  },
  ATT: {
    goal: 3, assist: 2, shotOn: 0.5, shotOff: -0.2, passOk: 0.05, passBad: -0.15, keyPass: 0.8,
    tackle: 0.3, interception: 0.2, clearance: 0, loss: -0.3, save: 0, conceded: 0, cleanSheet: 0, foul: -0.4, foulWon: 0.2, yellow: -0.5, red: -2.5, dribbleWon: 0.35, offside: -0.15,
  },
};

/**
 * Pontos médios de um jogador "comum" de cada função e formato — subtraídos antes da
 * suavização para que goleiro, defensor, meia e atacante tenham a mesma nota média.
 * Gerado por `scripts/trainingCalibration.ts` (linha "baseline").
 */
export const RATING_BASELINE: Record<Format, Record<RoleGroup, number>> = {
  5: { GK: 3, DEF: 3, MID: 6, ATT: 9 },
  7: { GK: 2.4, DEF: -0.5, MID: 4.3, ATT: 6.7 },
  11: { GK: 2, DEF: -0.9, MID: 1.6, ATT: 5.9 },
};

/** Suavização: com poucos lances, a nota não chega nem perto de 0 ou 10. */
/** Campos menores têm mais lances por jogador — a suavização precisa ser maior. */
export const RATING_K: Record<Format, number> = { 5: 11, 7: 12, 11: 8 };
const OWN_GOAL_PENALTY = -1.5;
const TEAM_RESULT_MOD = 0.3;

export function ratingPoints(group: RoleGroup, s: PlayerMatchStats): number {
  const w = WEIGHTS[group];
  return (
    s.goals * w.goal +
    s.assists * w.assist +
    s.shotsOn * w.shotOn +
    s.shotsOff * w.shotOff +
    s.passesOk * w.passOk +
    s.passesBad * w.passBad +
    s.keyPasses * w.keyPass +
    s.tackles * w.tackle +
    s.interceptions * w.interception +
    s.clearances * w.clearance +
    s.losses * w.loss +
    s.saves * w.save +
    s.conceded * w.conceded +
    s.fouls * w.foul +
    s.foulsWon * w.foulWon +
    s.yellows * w.yellow +
    s.reds * w.red +
    s.dribblesWon * w.dribbleWon +
    s.offsides * w.offside +
    (s.cleanSheet ? w.cleanSheet : 0)
  );
}

export function ratingFromPoints(points: number, resultMod: number, format: Format): number {
  const base = 6 + 4 * Math.tanh(points / RATING_K[format]) + resultMod;
  return Math.round(Math.max(3, Math.min(10, base)) * 10) / 10;
}

/**
 * Notas da partida. Também serve para o acompanhamento ao vivo: o baseline e o bônus de
 * "sem sofrer gol" entram proporcionais ao tempo que cada um jogou, então a nota começa em
 * ~6,0 e evolui com os lances. Quem saiu continua na lista com a nota do tempo que atuou.
 */
export function computeRatings(w: World): Record<string, number> {
  const total = w.setup.halfDurationSec * 2;
  const now = w.phase === 'ft' ? total : Math.min(total, w.time);
  const progress = Math.max(0, Math.min(1, now / total));

  const ownGoals = new Map<string, number>();
  for (const e of w.events) {
    if (e.type === 'goal' && e.ownGoal && e.playerId) {
      ownGoals.set(e.playerId, (ownGoals.get(e.playerId) ?? 0) + 1);
    }
  }

  // 1) pontos brutos (sem baseline) e fração do jogo atuada por cada um
  const everyone = [...w.agents, ...w.subbedOut];
  const raw = new Map<Agent, { points: number; share: number }>();
  for (const a of everyone) {
    const end = Math.min(now, a.leftAt ?? now);
    const share = Math.max(0, Math.min(1, (end - a.enteredAt) / total));
    const cleanSheet = a.stats.conceded === 0 ? WEIGHTS[a.group].cleanSheet * share : 0;
    const points =
      ratingPoints(a.group, { ...a.stats, cleanSheet: false }) +
      cleanSheet +
      (ownGoals.get(a.id) ?? 0) * OWN_GOAL_PENALTY;
    raw.set(a, { points, share });
  }

  // 2) baseline = 15% tabela fixa (âncora absoluta) + 85% média da função NESTA partida
  //    (ajusta sozinho a formação e o ritmo do jogo: goleiro, defensor, meia e atacante partem
  //    do mesmo patamar). A parte dinâmica entra aos poucos conforme o jogo avança.
  const dynWeight = 0.85 * Math.min(1, progress * 3);
  const dynamic: Partial<Record<RoleGroup, number>> = {};
  for (const g of ['GK', 'DEF', 'MID', 'ATT'] as const) {
    const full = everyone.filter(a => a.group === g && (raw.get(a)?.share ?? 0) >= 0.4);
    if (full.length) dynamic[g] = mean(full.map(a => raw.get(a)!.points / raw.get(a)!.share));
  }

  const ratings: Record<string, number> = {};
  for (const a of everyone) {
    const { points, share } = raw.get(a)!;
    const fixed = RATING_BASELINE[w.setup.format][a.group];
    const base = fixed * (1 - dynWeight) + (dynamic[a.group] ?? fixed) * dynWeight;
    const mine = w.score[a.team];
    const theirs = w.score[a.team === 'a' ? 'b' : 'a'];
    const resultMod = mine > theirs ? TEAM_RESULT_MOD : mine < theirs ? -TEAM_RESULT_MOD : 0;
    ratings[a.id] = ratingFromPoints(points - base * share, resultMod, w.setup.format);
  }
  return ratings;
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);

/** Melhor em campo: maior nota; desempata por gols + assistências e depois pelo time vencedor. */
export function pickMvp(w: World, ratings: Record<string, number>): string | null {
  let best: Agent | null = null;
  for (const a of [...w.agents, ...w.subbedOut]) {
    if (!best) {
      best = a;
      continue;
    }
    const diff = ratings[a.id] - ratings[best.id];
    if (diff > 0) {
      best = a;
    } else if (diff === 0) {
      const ca = a.stats.goals + a.stats.assists;
      const cb = best.stats.goals + best.stats.assists;
      if (ca > cb) best = a;
    }
  }
  return best?.id ?? null;
}
