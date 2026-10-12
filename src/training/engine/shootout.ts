import { createRng } from './rng.ts';
import type { Agent, Team, World } from './types.ts';

/** Desempate entre cobradores com a mesma nota: ataque > meio > defesa (ATA > PD > PE > MEI > MC > MD > ME > VOL > ZAG > LE > LD). */
const ROLE_ORDER = ['ATA', 'PD', 'PE', 'SA', 'MEI', 'MC', 'MD', 'ME', 'VOL', 'ZAG', 'LE', 'LD', 'ALD', 'ALE'];

export interface ShootoutKick {
  team: Team;
  playerId: string;
  rating: number;
  scored: boolean;
  /** Goleiro que defendia a cobrança (null se o time não tinha goleiro em campo). */
  keeperId: string | null;
  /** 1.. nas cobranças alternadas; passa de 5 nas eliminatórias */
  round: number;
  sudden: boolean;
}

export interface ShootoutResult {
  kicks: ShootoutKick[];
  score: Record<Team, number>;
  winner: Team;
}

/** Ordem de cobrança de um time: maiores notas primeiro (sem goleiro); empate de nota → posição. */
export function penaltyOrder(agents: Agent[], ratings: Record<string, number>): Agent[] {
  const rank = (a: Agent) => {
    const i = ROLE_ORDER.indexOf(a.role);
    return i < 0 ? ROLE_ORDER.length : i;
  };
  return agents
    .filter(a => a.group !== 'GK' && !a.sentOff && a.leftAt === null)
    .sort(
      (a, b) =>
        (ratings[b.id] ?? 0) - (ratings[a.id] ?? 0) || rank(a) - rank(b) || a.id.localeCompare(b.id),
    );
}

/** Chance de converter: finalização do cobrador contra a defesa de pênalti do goleiro. */
function convertChance(taker: Agent, keeper: Agent | undefined): number {
  const gk = keeper ? keeper.attrs.penaltySave : 50;
  const p = 0.76 + (taker.attrs.shoot - 70) * 0.004 - (gk - 70) * 0.0035;
  return Math.max(0.5, Math.min(0.93, p));
}

/**
 * Decisão por pênaltis. Os 5 melhores em nota de cada time (sem goleiro) cobram de forma
 * intercalada contra o goleiro adversário; se persistir o empate, seguem as cobranças
 * eliminatórias (uma de cada vez) com os maiores notas que ainda não cobraram — quando todos já
 * cobraram, a fila recomeça. Termina assim que um time não pode mais ser alcançado.
 */
export function runShootout(w: World, ratings: Record<string, number>, seed: number): ShootoutResult {
  const rng = createRng(seed ^ 0x9e3779b9);
  const queue: Record<Team, Agent[]> = {
    a: penaltyOrder(w.byTeam.a, ratings),
    b: penaltyOrder(w.byTeam.b, ratings),
  };
  const keeper = (team: Team) => w.byTeam[team].find(a => a.group === 'GK' && !a.sentOff && a.leftAt === null);
  const score: Record<Team, number> = { a: 0, b: 0 };
  const taken: Record<Team, number> = { a: 0, b: 0 };
  const kicks: ShootoutKick[] = [];
  // sem ninguém para cobrar (todos fora), a decisão é no sorteio
  if (!queue.a.length || !queue.b.length) {
    const winner: Team = !queue.a.length && queue.b.length ? 'b' : !queue.b.length && queue.a.length ? 'a' : rng.chance(0.5) ? 'a' : 'b';
    return { kicks, score, winner };
  }
  // com times de tamanhos diferentes, as 5 primeiras ficam equilibradas
  const regular = Math.min(5, queue.a.length, queue.b.length);

  const kick = (team: Team, round: number, sudden: boolean) => {
    const order = queue[team];
    const taker = order[taken[team] % order.length];
    const keep = keeper(team === 'a' ? 'b' : 'a');
    const scored = rng.chance(convertChance(taker, keep));
    if (scored) score[team] += 1;
    taken[team] += 1;
    kicks.push({
      team,
      playerId: taker.id,
      rating: ratings[taker.id] ?? 0,
      scored,
      keeperId: keep?.id ?? null,
      round,
      sudden,
    });
  };

  for (let r = 1; r <= regular; r++) {
    for (const team of ['a', 'b'] as const) {
      kick(team, r, false);
      // já decidido? (quem está atrás não alcança mesmo acertando tudo)
      const left = (t: Team) => regular - taken[t];
      if (score.a > score.b + left('b') || score.b > score.a + left('a')) {
        return { kicks, score, winner: score.a > score.b ? 'a' : 'b' };
      }
    }
  }

  let round = regular;
  while (score.a === score.b && round < regular + 100) {
    round += 1;
    kick('a', round, true);
    kick('b', round, true);
  }
  const winner: Team = score.a === score.b ? (rng.chance(0.5) ? 'a' : 'b') : score.a > score.b ? 'a' : 'b';
  return { kicks, score, winner };
}
