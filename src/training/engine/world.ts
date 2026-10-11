import { createRng } from './rng.ts';
import { deriveAttrs, roleGroup } from './attributes.ts';
import { deriveTactics } from './styles.ts';
import { PITCHES, TUNING } from './tuning.ts';
import { planRestart, startSetPiece } from './setpieces.ts';
import type {
  Agent,
  EnginePlayerInput,
  MatchSetup,
  PlayerMatchStats,
  RestartKind,
  Team,
  World,
} from './types.ts';

export function emptyStats(): PlayerMatchStats {
  return {
    goals: 0,
    assists: 0,
    shotsOn: 0,
    shotsOff: 0,
    passesOk: 0,
    passesBad: 0,
    keyPasses: 0,
    tackles: 0,
    interceptions: 0,
    clearances: 0,
    crosses: 0,
    fouls: 0,
    foulsWon: 0,
    yellows: 0,
    reds: 0,
    offsides: 0,
    dribbles: 0,
    dribblesWon: 0,
    losses: 0,
    saves: 0,
    distance: 0,
    conceded: 0,
    cleanSheet: false,
  };
}

export function other(team: Team): Team {
  return team === 'a' ? 'b' : 'a';
}

/** Team a ataca para +x (defende o gol em x=0); team b, o contrário. */
export function dirOf(team: Team): 1 | -1 {
  return team === 'a' ? 1 : -1;
}

export function ownGoalX(w: World, team: Team): number {
  return team === 'a' ? 0 : w.pitch.L;
}

export function attackGoalX(w: World, team: Team): number {
  return team === 'a' ? w.pitch.L : 0;
}

/** Quão avançado (0–1) está um x, do ponto de vista do time. */
export function progressOf(w: World, team: Team, x: number): number {
  return team === 'a' ? x / w.pitch.L : 1 - x / w.pitch.L;
}

export function xAtProgress(w: World, team: Team, f: number): number {
  return team === 'a' ? f * w.pitch.L : (1 - f) * w.pitch.L;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function deriveAgentTraits(input: EnginePlayerInput, scale: number) {
  const { attrs, biases } = deriveAttrs(input, scale);
  return { attrs, bias: biases };
}

function createAgent(
  input: EnginePlayerInput,
  team: Team,
  scale: number,
  x: number,
  y: number,
  enteredAt: number,
): Agent {
  return {
    id: input.id,
    team,
    role: input.role,
    group: roleGroup(input.role),
    ...deriveAgentTraits(input, scale),
    homeDepth: Math.max(0, Math.min(1, (88 - input.slotY) / 72)),
    homeLat: team === 'a' ? input.slotX / 100 : 1 - input.slotX / 100,
    x,
    y,
    vx: 0,
    vy: 0,
    stamina: Math.max(0.6, 1 - (input.fatigue ?? 0) / 250),
    think: 0,
    lock: 0,
    tackleCd: 0,
    protect: 0,
    supportTimer: 0,
    sx: 0,
    sy: 0,
    input,
    enteredAt,
    leftAt: null,
    sentOff: false,
    boostT: 0,
    slowT: 0,
    takeOnCd: 0,
    stats: emptyStats(),
  };
}

/**
 * Substituição: o reserva assume a função, o slot e a posição de quem sai; as estatísticas do
 * titular ficam guardadas. Qualquer referência ao jogador antigo (bola, cobrança) é transferida.
 */
export function substitute(w: World, outId: string, incoming: EnginePlayerInput): boolean {
  const idx = w.agents.findIndex(a => a.id === outId);
  if (idx < 0) return false;
  if (w.agents.some(a => a.id === incoming.id) || w.subbedOut.some(a => a.id === incoming.id)) return false;

  const old = w.agents[idx];
  const input: EnginePlayerInput = {
    ...incoming,
    role: old.role,
    slotX: old.input.slotX,
    slotY: old.input.slotY,
  };
  const fresh = createAgent(input, old.team, w.pitch.scale, old.x, old.y, w.time);
  fresh.vx = old.vx;
  fresh.vy = old.vy;
  fresh.think = old.think;

  old.leftAt = w.time;
  old.stats.cleanSheet = old.stats.conceded === 0;

  const swap = (a: Agent | null): Agent | null => (a === old ? fresh : a);
  const { ball } = w;
  ball.owner = swap(ball.owner);
  ball.lastTouch = swap(ball.lastTouch);
  ball.passFrom = swap(ball.passFrom);
  ball.passTo = swap(ball.passTo);
  ball.crossFrom = swap(ball.crossFrom);
  ball.shotAssist = swap(ball.shotAssist);
  if (w.assistCandidate) {
    w.assistCandidate = {
      ...w.assistCandidate,
      from: swap(w.assistCandidate.from) as Agent,
      to: swap(w.assistCandidate.to) as Agent,
    };
  }
  const sp = w.setPiece;
  if (sp) {
    if (sp.taker === old) sp.taker = fresh;
    const target = sp.targets.get(old);
    if (target) {
      sp.targets.delete(old);
      sp.targets.set(fresh, target);
    }
  }

  const teamList = w.byTeam[old.team];
  teamList[teamList.indexOf(old)] = fresh;
  w.agents[idx] = fresh;
  w.subbedOut.push(old);
  w.subs.push({ t: w.time, team: old.team, outId: old.id, inId: fresh.id, role: old.role });
  w.events.push({ type: 'sub', t: w.time, team: old.team, playerId: fresh.id, outId: old.id });
  return true;
}

/** Linha de impedimento: penúltimo adversário (o goleiro conta), visto do ataque do time. */
export function offsideLine(w: World, attackTeam: Team): number {
  const prog = w.byTeam[other(attackTeam)].map(o => progressOf(w, attackTeam, o.x)).sort((a, b) => b - a);
  return prog[1] ?? prog[0] ?? 1;
}

/** Em impedimento: na metade adversária, à frente da bola e do penúltimo adversário (tolerância de ~40 cm). */
export function isOffsidePosition(w: World, attackTeam: Team, t: Agent, ballX: number): boolean {
  const pT = progressOf(w, attackTeam, t.x);
  return (
    pT > 0.5 &&
    pT > progressOf(w, attackTeam, ballX) + 0.002 &&
    pT > offsideLine(w, attackTeam) + 0.004
  );
}

/** Apito de impedimento: tiro livre indireto para o adversário, onde o jogador recebeu. */
export function callOffside(w: World, a: Agent): void {
  const from = w.ball.passFrom;
  if (from) from.stats.passesBad += 1;
  a.stats.offsides += 1;
  w.events.push({ type: 'offside', t: w.time, team: a.team, playerId: a.id });
  scheduleRestart(w, 'free-kick', other(a.team), a.x, a.y, 0.6);
}

export function createWorld(setup: MatchSetup): World {
  const pitch = PITCHES[setup.format];
  const rng = createRng(setup.seed);
  const byTeam: Record<Team, Agent[]> = { a: [], b: [] };
  const agents: Agent[] = [];

  for (const team of ['a', 'b'] as const) {
    for (const input of setup.teams[team]) {
      const agent = createAgent(input, team, pitch.scale, pitch.L / 2, pitch.H / 2, 0);
      byTeam[team].push(agent);
      agents.push(agent);
    }
  }

  const world: World = {
    setup,
    pitch,
    rng,
    agents,
    byTeam,
    ball: {
      x: pitch.L / 2,
      y: pitch.H / 2,
      vx: 0,
      vy: 0,
      owner: null,
      lastTouch: null,
      kind: 'loose',
      passFrom: null,
      passTo: null,
      shotTeam: null,
      shotAssist: null,
      saveResolved: false,
      penalty: false,
      shotDist: 0,
      crossFrom: null,
      crossT: 0,
      lobTo: null,
      offsideBy: null,
      panenka: false,
      header: false,
    },
    score: { a: 0, b: 0 },
    clock: 0,
    time: 0,
    phase: 'h1',
    restart: null,
    events: [],
    assistCandidate: null,
    possession: 'a',
    tactics: {
      a: deriveTactics(setup.styles?.a, setup.format),
      b: deriveTactics(setup.styles?.b, setup.format),
    },
    setPiece: null,
    subbedOut: [],
    subs: [],
    possTime: { a: 0, b: 0 },
    transition: null,
    celebration: null,
  };

  scheduleRestart(world, 'kickoff', 'a', pitch.L / 2, pitch.H / 2, 0);
  executeRestart(world);
  return world;
}

export function scheduleRestart(
  w: World,
  kind: RestartKind,
  team: Team,
  x: number,
  y: number,
  timer: number,
): void {
  w.restart = { kind, team, x, y, timer };
  if (kind !== 'kickoff') planRestart(w, w.restart);
  w.ball.owner = null;
  w.ball.vx = 0;
  w.ball.vy = 0;
  w.ball.kind = 'loose';
  w.ball.passFrom = null;
  w.ball.passTo = null;
  w.ball.shotTeam = null;
  w.ball.shotAssist = null;
  w.ball.penalty = false;
  w.ball.crossFrom = null;
  w.ball.lobTo = null;
  w.ball.offsideBy = null;
  w.ball.panenka = false;
  w.ball.x = x;
  w.ball.y = y;
  w.setPiece = null;
}

/** Posição-base de formação (sem deslocamento por bola) usada no pontapé inicial. */
function kickoffPosition(w: World, a: Agent): { x: number; y: number } {
  const f =
    a.group === 'GK' ? 0.035 : Math.min(0.12 + a.homeDepth * 0.6, 0.46);
  return { x: xAtProgress(w, a.team, f), y: a.homeLat * w.pitch.H };
}

export function executeRestart(w: World): void {
  const r = w.restart;
  if (!r) return;
  w.restart = null;
  const { ball } = w;

  if (r.kind === 'kickoff') {
    w.celebration = null;
    for (const a of w.agents) {
      const p = kickoffPosition(w, a);
      a.x = p.x;
      a.y = p.y;
      a.vx = 0;
      a.vy = 0;
      a.lock = 0;
      a.protect = 0;
    }
    const taker = [...w.byTeam[r.team]]
      .filter(a => a.group !== 'GK')
      .sort((p, q) => q.homeDepth - p.homeDepth)[0];
    ball.x = w.pitch.L / 2;
    ball.y = w.pitch.H / 2;
    if (taker) {
      taker.x = ball.x - dirOf(r.team) * TUNING.carryDistance;
      taker.y = ball.y;
      takePossession(w, taker);
      taker.think = 0.7;
    }
    return;
  }

  if (r.kind === 'corner' || r.kind === 'free-kick' || r.kind === 'penalty') {
    startSetPiece(w, r);
    return;
  }

  const pool = w.byTeam[r.team].filter(a => (r.kind === 'goal-kick' ? a.group === 'GK' : a.group !== 'GK'));
  const candidates = pool.length ? pool : w.byTeam[r.team];
  let taker = r.taker && w.agents.includes(r.taker) ? r.taker : candidates[0];
  if (!r.taker) {
    let best = Infinity;
    for (const a of candidates) {
      const d = dist(a.x, a.y, r.x, r.y);
      if (d < best) {
        best = d;
        taker = a;
      }
    }
  }
  taker.x = r.x;
  taker.y = r.y;
  taker.vx = 0;
  taker.vy = 0;
  ball.x = r.x;
  ball.y = r.y;
  takePossession(w, taker);
  taker.think = 0.35;
  taker.protect = 1.4;
  w.transition = null;
  w.setPiece = {
    kind: r.kind,
    team: r.team,
    taker,
    plan: r.plan ?? (r.kind === 'goal-kick' ? 'goal-kick' : 'throw'),
    targets: new Map(),
    until: w.time + 4,
  };
}

/**
 * Um jogador passa a ter a bola: resolve o passe em voo (certo/errado) e abre a
 * janela de assistência quando o receptor é companheiro do passador.
 */
export function takePossession(w: World, agent: Agent): void {
  const { ball } = w;
  const from = ball.passFrom;
  if (from) {
    if (agent.team === from.team && agent !== from) {
      from.stats.passesOk += 1;
      w.assistCandidate = { from, to: agent, t: w.time };
    } else if (agent.team !== from.team) {
      from.stats.passesBad += 1;
    }
  }
  ball.passFrom = null;
  ball.passTo = null;
  ball.kind = 'loose';
  ball.shotTeam = null;
  ball.shotAssist = null;
  ball.penalty = false;
  ball.crossFrom = null;
  ball.lobTo = null;
  ball.offsideBy = null;
  ball.panenka = false;
  if (w.restart === null && w.possession !== agent.team) {
    // quem recupera a bola sai em velocidade; quem perdeu recompõe
    w.transition = { team: agent.team, until: w.time + 4 };
  }
  ball.owner = agent;
  ball.lastTouch = agent;
  ball.vx = 0;
  ball.vy = 0;
  agent.protect = TUNING.protectTime;
  agent.think = Math.min(agent.think, 0.12 + w.rng.next() * 0.12);
  w.possession = agent.team;
}

export function releaseBall(w: World, kicker: Agent): void {
  const { ball } = w;
  ball.owner = null;
  ball.lastTouch = kicker;
  ball.x = kicker.x;
  ball.y = kicker.y;
  kicker.lock = TUNING.kickLock;
  if (w.setPiece && w.setPiece.taker === kicker) {
    w.setPiece.until = Math.min(w.setPiece.until, w.time + 3.5);
  }
}

export function clampToPitch(w: World, x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(w.pitch.L, x)),
    y: Math.max(0, Math.min(w.pitch.H, y)),
  };
}

/** Pressão sobre o jogador: distância ao adversário mais próximo. */
export function nearestOpponentDistance(w: World, a: Agent): number {
  let best = Infinity;
  for (const o of w.byTeam[other(a.team)]) {
    const d = dist(a.x, a.y, o.x, o.y);
    if (d < best) best = d;
  }
  return best;
}

export interface PassOpts {
  /** teto de velocidade (arremesso lateral) */
  maxSpeed?: number;
  /** multiplicador do erro */
  sigmaMul?: number;
}

export function kickPass(w: World, p: Agent, target: Agent, opts: PassOpts = {}): void {
  const { ball, pitch } = w;
  const root = Math.sqrt(pitch.scale);
  const d = dist(p.x, p.y, target.x, target.y);
  const T = d / (15 * root) + 0.15;
  const aim = clampToPitch(w, target.x + target.vx * T * 0.7, target.y + target.vy * T * 0.7);
  const fr = TUNING.ballFriction * root;
  const v0 = Math.min(d / T + 0.5 * fr * T, opts.maxSpeed ?? 26 * root);

  const pressure = nearestOpponentDistance(w, p) < 2.5 * pitch.scale ? 0.05 : 0;
  const passAttr = p.group === 'GK' ? p.attrs.distribution : p.attrs.pass;
  const sigma =
    ((1 - passAttr / 100) * 0.42 * p.attrs.volatility + pressure + (d > 25 * root ? 0.03 : 0)) *
    (opts.sigmaMul ?? 1);
  const angle = Math.atan2(aim.y - p.y, aim.x - p.x) + w.rng.gauss() * sigma;

  const offside = isOffsidePosition(w, p.team, target, p.x);
  releaseBall(w, p);
  ball.vx = Math.cos(angle) * v0;
  ball.vy = Math.sin(angle) * v0;
  ball.kind = 'pass';
  ball.passFrom = p;
  ball.passTo = target;
  ball.saveResolved = false;
  ball.offsideBy = offside ? target : null;
}

export interface ShotOpts {
  /** cabeceio: mais impreciso e mais fraco */
  header?: boolean;
  /** tiro livre direto: sem pressão, um pouco mais impreciso */
  freeKick?: boolean;
  /** pênalti: bola colocada, goleiro defende bem menos */
  penalty?: boolean;
}

export function kickShot(w: World, p: Agent, opts: ShotOpts = {}): void {
  const { ball, pitch } = w;
  const root = Math.sqrt(pitch.scale);
  const gx = attackGoalX(w, p.team);
  // Cavadinha: raro, mais comum em quem é egoísta/vaidoso
  const panenka = !!opts.penalty && w.rng.chance(0.03 + (p.attrs.selfish > 0.6 ? 0.05 : 0));
  const corner = opts.penalty
    ? panenka
      ? (w.rng.next() - 0.5) * 0.2
      : (w.rng.next() < 0.5 ? -1 : 1) * (0.55 + w.rng.next() * 0.35)
    : null;
  // quanto melhor o finalizador, mais perto do canto ele mira
  const cornerBias = Math.pow(w.rng.next(), 1.7 - p.attrs.shoot / 100);
  const aimY =
    pitch.H / 2 +
    (corner !== null ? corner : (w.rng.next() < 0.5 ? -1 : 1) * cornerBias) *
      (corner !== null ? 1 : 0.85) *
      (pitch.goalW / 2);
  const d = dist(p.x, p.y, gx, aimY);
  const near = nearestOpponentDistance(w, p);
  // marcador colado atrapalha a finalização (quanto mais perto, pior)
  const pressure = opts.penalty || opts.freeKick ? 0 : near < 1.8 * pitch.scale ? 0.1 : near < 3 * pitch.scale ? 0.05 : 0;
  // cabeceio depende do jogo aéreo tanto quanto da finalização
  const skill = opts.header ? p.attrs.aerial * 0.75 + p.attrs.shoot * 0.25 : p.attrs.shoot;
  let sigma =
    0.05 + (1 - skill / 100) * 0.4 * p.attrs.volatility * (1 + d / (pitch.L * 0.3)) + pressure;
  if (opts.penalty) sigma = 0.015 + (1 - p.attrs.shoot / 100) * 0.1 * p.attrs.volatility;
  if (opts.header) sigma *= 1.05;
  if (opts.freeKick) sigma *= 1.2;
  const angle = Math.atan2(aimY - p.y, gx - p.x) + w.rng.gauss() * sigma;
  const speed = (20 + (p.attrs.shoot / 99) * 8) * root * (opts.header ? 0.95 : panenka ? 0.4 : 1);

  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const towardGoal = (gx - p.x) * dx > 0;
  const yAtGoal = towardGoal ? p.y + dy * ((gx - p.x) / dx) : -999;
  const onTarget = Math.abs(yAtGoal - pitch.H / 2) <= pitch.goalW / 2;
  if (onTarget) p.stats.shotsOn += 1;
  else p.stats.shotsOff += 1;

  const cand = w.assistCandidate;
  const assist =
    cand && cand.to === p && w.time - cand.t <= 4 && cand.from !== p ? cand.from : null;
  if (assist) assist.stats.keyPasses += 1;

  releaseBall(w, p);
  ball.vx = dx * speed;
  ball.vy = dy * speed;
  ball.kind = 'shot';
  ball.passFrom = null;
  ball.passTo = null;
  ball.shotTeam = p.team;
  ball.shotAssist = assist;
  ball.saveResolved = false;
  ball.penalty = !!opts.penalty;
  ball.panenka = panenka;
  ball.header = !!opts.header;
  ball.shotDist = d;
}

/** Bola longa para afastar o perigo (zona de defesa sob pressão). */
export function kickClear(w: World, p: Agent): void {
  const { ball, pitch } = w;
  const root = Math.sqrt(pitch.scale);
  const targetX = xAtProgress(w, p.team, Math.min(0.72, progressOf(w, p.team, p.x) + 0.4));
  const side = p.y < pitch.H / 2 ? 0.12 : 0.88;
  const aim = { x: targetX, y: pitch.H * side };
  const d = dist(p.x, p.y, aim.x, aim.y);
  const T = d / (15 * root) + 0.15;
  const fr = TUNING.ballFriction * root;
  const v0 = Math.min(d / T + 0.5 * fr * T, 26 * root);
  const angle = Math.atan2(aim.y - p.y, aim.x - p.x) + w.rng.gauss() * 0.14;

  p.stats.clearances += 1;
  releaseBall(w, p);
  ball.vx = Math.cos(angle) * v0;
  ball.vy = Math.sin(angle) * v0;
  ball.kind = 'clear';
  ball.passFrom = null;
  ball.passTo = null;
  ball.saveResolved = false;
}
