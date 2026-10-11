/**
 * Calibração do motor do Training Pit (roda sem tela):
 *   node scripts/trainingCalibration.ts [partidas] [formato: 5|7|11|all] [halfSec]
 * Node 22.6+ executa TypeScript direto; o motor usa imports com extensão .ts por isso.
 */
import { simulateMatch } from '../src/training/engine/sim.ts';
import { ratingPoints } from '../src/training/engine/rating.ts';
import type { EnginePlayerInput, Format, MatchSetup } from '../src/training/engine/types.ts';
import type { PlayerPosition } from '../src/types/Player.ts';
import type { SlotRole } from '../src/types/Tactics.ts';

const ROLE_TO_POSITION: Record<SlotRole, PlayerPosition> = {
  GOL: 'GK', ZAG: 'CB', LE: 'LB', LD: 'RB', ALE: 'LB', ALD: 'RB', VOL: 'CDM', MC: 'CM',
  MEI: 'CAM', ME: 'LW', MD: 'RW', PE: 'LW', PD: 'RW', SA: 'CF', ATA: 'ST',
};

type Slot = { x: number; y: number; role: SlotRole };

const LAYOUTS: Record<Format, Slot[]> = {
  11: [
    { x: 50, y: 88, role: 'GOL' }, { x: 15, y: 72, role: 'LE' }, { x: 38, y: 72, role: 'ZAG' },
    { x: 62, y: 72, role: 'ZAG' }, { x: 85, y: 72, role: 'LD' }, { x: 15, y: 48, role: 'ME' },
    { x: 38, y: 48, role: 'MC' }, { x: 62, y: 48, role: 'MC' }, { x: 85, y: 48, role: 'MD' },
    { x: 35, y: 22, role: 'ATA' }, { x: 65, y: 22, role: 'ATA' },
  ],
  7: [
    { x: 50, y: 88, role: 'GOL' }, { x: 32, y: 70, role: 'ZAG' }, { x: 68, y: 70, role: 'ZAG' },
    { x: 20, y: 48, role: 'ME' }, { x: 50, y: 48, role: 'MC' }, { x: 80, y: 48, role: 'MD' },
    { x: 50, y: 24, role: 'ATA' },
  ],
  5: [
    { x: 50, y: 88, role: 'GOL' }, { x: 32, y: 66, role: 'ZAG' }, { x: 68, y: 66, role: 'ZAG' },
    { x: 32, y: 34, role: 'ATA' }, { x: 68, y: 34, role: 'ATA' },
  ],
};

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTeam(prefix: string, format: Format, rand: () => number, avg: number, extra: Partial<EnginePlayerInput> = {}): EnginePlayerInput[] {
  return LAYOUTS[format].map((slot, i) => ({
    id: `${prefix}${i}`,
    position: ROLE_TO_POSITION[slot.role],
    overall: Math.round(avg + (rand() - 0.5) * 32),
    role: slot.role,
    slotX: slot.x,
    slotY: slot.y,
    ...extra,
  }));
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
}
function sd(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)));
}
function corr(xs: number[], ys: number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy || 1);
}

function run(format: Format, matches: number, halfSec: number): void {
  const rand = mulberry(1234 + format);
  const goals: number[] = [];
  let draws = 0;
  let shots = 0;
  let onTarget = 0;
  let passOk = 0;
  let passAll = 0;
  let tackles = 0;
  let interceptions = 0;
  const goalsBy: Record<string, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  const assistsBy: Record<string, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  let saves = 0;
  let clears = 0;
  const ratings: number[] = [];
  const rows: { g: string; o: number; r: number }[] = [];
  const pts: Record<string, number[]> = { GK: [], DEF: [], MID: [], ATT: [] };
  const byGroup: Record<string, number[]> = { GK: [], DEF: [], MID: [], ATT: [] };
  const groupOf = (role: SlotRole) =>
    role === 'GOL' ? 'GK' : ['ZAG', 'LE', 'LD'].includes(role) ? 'DEF' : ['PE', 'PD', 'SA', 'ATA'].includes(role) ? 'ATT' : 'MID';

  const t0 = Date.now();
  for (let m = 0; m < matches; m++) {
    const setup: MatchSetup = {
      format,
      halfDurationSec: halfSec,
      seed: m + 1,
      teams: { a: makeTeam('a', format, rand, 74), b: makeTeam('b', format, rand, 74) },
    };
    const res = simulateMatch(setup);
    goals.push(res.score.a + res.score.b);
    if (res.score.a === res.score.b) draws += 1;
    for (const team of ['a', 'b'] as const) {
      for (const p of setup.teams[team]) {
        const s = res.stats[p.id];
        shots += s.shotsOn + s.shotsOff;
        onTarget += s.shotsOn;
        passOk += s.passesOk;
        passAll += s.passesOk + s.passesBad;
        tackles += s.tackles;
        interceptions += s.interceptions;
        saves += s.saves;
        clears += s.clearances;
        const r = res.ratings[p.id];
        ratings.push(r);
        goalsBy[groupOf(p.role)] += s.goals;
        assistsBy[groupOf(p.role)] += s.assists;
        rows.push({ g: groupOf(p.role), o: p.overall, r });
        pts[groupOf(p.role)].push(ratingPoints(groupOf(p.role) as never, s));
        byGroup[groupOf(p.role)].push(r);
      }
    }
  }
  const secs = (Date.now() - t0) / 1000;
  const f = (n: number, d = 2) => n.toFixed(d);

  console.log(`\n=== ${format}x${format} · ${matches} partidas · tempo ${halfSec}s · ${f(secs, 1)}s de CPU ===`);
  console.log(`gols/jogo: ${f(mean(goals))}  empates: ${f((draws / matches) * 100, 0)}%`);
  console.log(`chutes/jogo: ${f(shots / matches, 1)} (no alvo ${f((onTarget / shots) * 100, 0)}%)  defesas/jogo: ${f(saves / matches, 1)}`);
  console.log(`passes/jogo: ${f(passAll / matches, 0)} (certos ${f((passOk / passAll) * 100, 0)}%)  desarmes/jogo: ${f(tackles / matches, 1)}  intercept./jogo: ${f(interceptions / matches, 1)}  cortes/jogo: ${f(clears / matches, 1)}`);
  console.log(`notas: média ${f(mean(ratings))} · desvio ${f(sd(ratings))} · >=9.5: ${f((ratings.filter(r => r >= 9.5).length / ratings.length) * 100, 1)}% · <=3.5: ${f((ratings.filter(r => r <= 3.5).length / ratings.length) * 100, 1)}%`);
  console.log(
    'baseline pts (cole em RATING_BASELINE): ' +
      Object.entries(pts)
        .filter(([, xs]) => xs.length)
        .map(([g, xs]) => `${g}: ${f(mean(xs) - 0.3)}`)
        .join(', '),
  );
  const gm = (g: string, k: 'o' | 'r') => mean(rows.filter(x => x.g === g).map(x => x[k]));
  const totG = Object.values(goalsBy).reduce((x, y) => x + y, 0) || 1;
  const totA = Object.values(assistsBy).reduce((x, y) => x + y, 0) || 1;
  console.log(`gols por função: ATT ${f((goalsBy.ATT / totG) * 100, 0)}% MID ${f((goalsBy.MID / totG) * 100, 0)}% DEF ${f((goalsBy.DEF / totG) * 100, 0)}% · assist.: ATT ${f((assistsBy.ATT / totA) * 100, 0)}% MID ${f((assistsBy.MID / totA) * 100, 0)}% DEF ${f((assistsBy.DEF / totA) * 100, 0)}%`);
  console.log(`corr(overall, nota) dentro da função: ${f(corr(rows.map(x => x.o - gm(x.g, 'o')), rows.map(x => x.r - gm(x.g, 'r'))))}`);
  console.log(
    'média por função: ' +
      Object.entries(byGroup)
        .map(([g, xs]) => `${g} ${f(mean(xs))}`)
        .join(' · '),
  );
}

const matches = Number(process.argv[2] ?? 100);
const which = process.argv[3] ?? 'all';
const halfSec = Number(process.argv[4] ?? 150);
const formats: Format[] = which === 'all' ? [5, 7, 11] : [Number(which) as Format];
for (const format of formats) run(format, matches, halfSec);
