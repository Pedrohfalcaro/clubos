import { FORMAT_TUNING, MARKINGS, TUNING } from './tuning.ts';
import {
  attackGoalX,
  dirOf,
  dist,
  isOffsidePosition,
  kickClear,
  kickPass,
  kickShot,
  nearestOpponentDistance,
  offsideLine,
  other,
  ownGoalX,
  progressOf,
  takePossession,
  xAtProgress,
} from './world.ts';
import {
  foul,
  isInAttackBox,
  kickCross,
  kickLob,
  runSetPiece,
  setPieceHolding,
  setPieceTarget,
} from './setpieces.ts';
import type { Agent, Team, World } from './types.ts';

interface Point {
  x: number;
  y: number;
}

/** Contexto calculado uma vez por passo e compartilhado pelos jogadores. */
export interface TickCtx {
  chasers: Set<Agent>;
  /** zagueiros/volantes → adversário que cada um acompanha */
  marks: Map<Agent, Agent>;
  /** jogadores que oferecem apoio curto ao portador */
  supporters: Set<Agent>;
  /** quão fundo (0–1, do ponto de vista do time) está o último defensor adversário */
  oppLine: Record<Team, number>;
  /** time que acabou de recuperar a bola (contra-ataque) e time que acabou de perdê-la (recomposição) */
  counter: Team | null;
  recover: Team | null;
}

const FULLBACK_ROLES = new Set(['LE', 'LD', 'ALE', 'ALD']);

/** Distância de um ponto ao segmento a→b. */
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function clampPitch(w: World, p: Point): Point {
  return {
    x: Math.max(0.5, Math.min(w.pitch.L - 0.5, p.x)),
    y: Math.max(0.8, Math.min(w.pitch.H - 0.8, p.y)),
  };
}

/** Faixa lateral de repouso do jogador, esticada ou fechada pelo estilo e pela característica. */
function laneY(w: World, a: Agent): number {
  const { H } = w.pitch;
  const base = H * (a.homeLat * 0.9 + 0.05);
  const width = w.tactics[a.team].widthMul * (1 + 0.22 * a.bias.width);
  const stretched = H / 2 + (base - H / 2) * width;
  return Math.max(1, Math.min(H - 1, stretched));
}

/** Y previsto na linha de gol se há um chute vindo contra o goleiro. */
function incomingShotY(w: World, gk: Agent): number | null {
  const { ball, pitch } = w;
  if (ball.kind !== 'shot' || ball.shotTeam === gk.team) return null;
  const gx = ownGoalX(w, gk.team);
  if (Math.abs(ball.vx) < 0.1 || (gx - ball.x) * ball.vx <= 0) return null;
  const t = (gx - ball.x) / ball.vx;
  const y = ball.y + ball.vy * t;
  const half = pitch.goalW / 2 + 1.5;
  return Math.max(pitch.H / 2 - half, Math.min(pitch.H / 2 + half, y));
}

/** Posição do bloco sem a bola: sobe e desce com a bola, na altura que o estilo manda. */
function blockTarget(w: World, a: Agent, ctx?: TickCtx): Point {
  const tact = w.tactics[a.team];
  const ballF = progressOf(w, a.team, w.ball.x);
  let f = 0.12 + a.homeDepth * 0.6 + (ballF - 0.5) * 0.45 + tact.lineShift;
  f += w.possession === a.team ? 0.04 * a.homeDepth : -0.06 * (1 - a.homeDepth);
  // recomposição: acabou de perder a bola, o bloco recua
  if (ctx?.recover === a.team) f -= 0.05;
  const max = a.group === 'DEF' ? 0.68 : a.group === 'MID' ? 0.85 : 0.92;
  f = Math.max(0.06, Math.min(max, f));
  const y = laneY(w, a) + (w.ball.y - w.pitch.H / 2) * 0.2;
  return clampPitch(w, { x: xAtProgress(w, a.team, f), y });
}

/**
 * Goleiro: fica entre a bola e o gol, avança para fechar o ângulo quando um atacante
 * se aproxima e se antecipa ao chute.
 */
function gkTarget(w: World, a: Agent): Point {
  const { ball, pitch } = w;
  const s = pitch.scale;
  const dir = dirOf(a.team);
  const gx = ownGoalX(w, a.team);
  const ballF = progressOf(w, a.team, ball.x);
  const baseDepth = 1.1 + ballF * 2.2;

  const incoming = incomingShotY(w, a);
  if (incoming !== null) return { x: gx + dir * baseDepth, y: incoming };

  const owner = ball.owner;
  if (owner && owner.team !== a.team) {
    const gc = { x: gx, y: pitch.H / 2 };
    const dO = dist(owner.x, owner.y, gc.x, gc.y);
    if (dO < pitch.L * 0.3) {
      // fecha o ângulo pela reta gol → bola
      const maxAdv = (2 + (a.attrs.sweeping / 100) * 6) * s;
      const adv = Math.max(baseDepth, Math.min((dO - 2 * s) * 0.32, maxAdv));
      const ux = (owner.x - gc.x) / dO;
      const uy = (owner.y - gc.y) / dO;
      return clampPitch(w, { x: gc.x + ux * adv, y: gc.y + uy * adv });
    }
  }
  return { x: gx + dir * baseDepth, y: pitch.H / 2 + (ball.y - pitch.H / 2) * 0.3 };
}

/** O goleiro sai para cortar/dominar bola solta ou lançamento nas costas da defesa. */
function gkSweeps(w: World, gk: Agent): boolean {
  const { ball, pitch } = w;
  if (ball.owner || ball.kind === 'shot' || ball.kind === 'cross') return false;
  const m = MARKINGS[w.setup.format];
  const reach = (5 + (gk.attrs.sweeping / 100) * 9) * pitch.scale;
  const gx = ownGoalX(w, gk.team);
  const inZone =
    Math.abs(ball.x - gx) < Math.max(m.boxD + 4 * pitch.scale, reach) &&
    Math.abs(ball.y - pitch.H / 2) < m.boxW / 2 + 4;
  const dBall = dist(gk.x, gk.y, ball.x, ball.y);
  if (!inZone || dBall > reach) return false;

  const tGk = dBall / (gk.attrs.speed * 1.15);
  let tOpp = Infinity;
  for (const o of w.byTeam[other(gk.team)]) {
    if (o.group === 'GK') continue;
    tOpp = Math.min(tOpp, dist(o.x, o.y, ball.x, ball.y) / o.attrs.speed);
  }
  return tGk < tOpp * 0.9;
}

/** Escolhe um ponto livre perto do portador para receber o passe curto. */
function supportSpot(w: World, a: Agent, owner: Agent): Point {
  if (a.supportTimer > 0) return { x: a.sx, y: a.sy };
  a.supportTimer = 0.4 + w.rng.next() * 0.25;

  const { scale } = w.pitch;
  const dir = dirOf(a.team);
  const home = blockTarget(w, a);
  const opponents = w.byTeam[other(a.team)];
  const mates = w.byTeam[a.team];
  let best: { p: Point; score: number } | null = null;

  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    for (const r of [8, 13]) {
      const cand = clampPitch(w, {
        x: owner.x + Math.cos(ang) * r * scale,
        y: owner.y + Math.sin(ang) * r * scale,
      });
      let open = 10;
      let lane = 5;
      for (const o of opponents) {
        open = Math.min(open, dist(cand.x, cand.y, o.x, o.y));
        lane = Math.min(lane, distToSegment(o, owner, cand));
      }
      let spread = 0;
      for (const m of mates) {
        if (m === a || m === owner || m.supportTimer <= 0) continue;
        if (dist(cand.x, cand.y, m.sx, m.sy) < 6 * scale) spread += 4;
      }
      const gain = (cand.x - owner.x) * dir;
      const score =
        open + lane * 1.2 + gain * 0.15 - dist(cand.x, cand.y, home.x, home.y) * 0.12 - spread;
      if (!best || score > best.score) best = { p: cand, score };
    }
  }
  const spot = best?.p ?? home;
  a.sx = spot.x;
  a.sy = spot.y;
  return spot;
}

/** Posição de quem não está com a bola enquanto o time ataca: apoio, corridas, largura e infiltração. */
function attackTarget(w: World, a: Agent, owner: Agent, ctx: TickCtx): Point {
  const { pitch } = w;
  const tact = w.tactics[a.team];
  const ownerF = progressOf(w, a.team, owner.x);
  const lane = laneY(w, a);
  const counter = ctx.counter === a.team ? tact.directness : 0;
  // corridas sem a bola: característica + disposição física
  const runBoost = a.bias.run * 0.05 + (a.attrs.workRate - 60) / 1200;
  const homeF = Math.max(
    0.06,
    Math.min(
      0.92,
      0.12 +
        a.homeDepth * 0.6 +
        (ownerF - 0.5) * 0.4 +
        tact.lineShift +
        tact.mentShift * a.homeDepth +
        (a.group !== 'DEF' ? runBoost : 0),
    ),
  );

  if (a.group === 'ATT') {
    // quem tem pouca visão de jogo às vezes erra o tempo da corrida e fica em impedimento
    const cap = Math.min(0.94, ctx.oppLine[a.team] - 0.004 + (1 - a.attrs.vision / 100) * 0.09);
    let f = Math.max(homeF + 0.05, ownerF + 0.1 + tact.mentShift) + 0.07 * counter;
    // quem recua para buscar o jogo (falso 9, pivô) não vai até a linha
    f -= a.bias.drop * 0.14;
    f = Math.min(cap, f);
    // abre a faixa quando o portador está na mesma
    const sameLane = Math.abs(lane - owner.y) < pitch.H * 0.14;
    const y = sameLane ? lane + (lane < pitch.H / 2 ? 1 : -1) * pitch.H * 0.12 : lane;
    // quem recua também fecha para o centro, onde recebe de frente
    const yy = a.bias.drop > 0.3 ? pitch.H / 2 + (y - pitch.H / 2) * 0.5 : y;
    return clampPitch(w, { x: xAtProgress(w, a.team, Math.max(0.06, f)), y: yy });
  }

  if (a.group === 'MID') {
    const arrive = ownerF > 0.5 - a.bias.run * 0.08 && a.homeDepth > 0.4;
    if (arrive && !(ctx.supporters.has(a) && ownerF < 0.72)) {
      // chegada na área: meia infiltra pelo meio
      return clampPitch(w, {
        // chega na área, mas sem passar da linha de impedimento
        x: xAtProgress(w, a.team, Math.min(0.84, ctx.oppLine[a.team] - 0.006)),
        y: pitch.H / 2 + (lane - pitch.H / 2) * 0.5,
      });
    }
    if (ctx.supporters.has(a)) return supportSpot(w, a, owner);
    return clampPitch(w, { x: xAtProgress(w, a.team, homeF + 0.05 * counter), y: lane });
  }

  // Defesa: linha sobe junto com a bola, laterais apoiam por fora
  if (FULLBACK_ROLES.has(a.role) && ownerF > 0.4 - a.bias.run * 0.1 && Math.abs(owner.y - lane) < pitch.H * (0.3 + a.bias.run * 0.1) && a.bias.run > -0.3) {
    const wideY = lane < pitch.H / 2 ? pitch.H * 0.07 : pitch.H * 0.93;
    const reach = 0.03 + a.bias.run * 0.04;
    return clampPitch(w, {
      x: xAtProgress(w, a.team, Math.min(0.88, ownerF + reach, ctx.oppLine[a.team] - 0.006)),
      y: wideY,
    });
  }
  const f = Math.max(0.06, Math.min(0.6, ownerF - 0.3 + tact.lineShift));
  return clampPitch(w, { x: xAtProgress(w, a.team, f), y: lane });
}

function homeTarget(w: World, a: Agent, ctx: TickCtx): Point {
  if (a.group === 'GK') return gkTarget(w, a);

  const owner = w.ball.owner;
  if (owner && owner.team === a.team) return attackTarget(w, a, owner, ctx);

  const block = blockTarget(w, a, ctx);
  const mark = ctx.marks.get(a);
  if (mark) {
    // fica entre o adversário e o próprio gol, sem abandonar a posição
    const dir = dirOf(a.team);
    const gap = 1.8 * w.pitch.scale;
    const guard = clampPitch(w, { x: mark.x - dir * gap, y: mark.y });
    return { x: guard.x * 0.8 + block.x * 0.2, y: guard.y * 0.8 + block.y * 0.2 };
  }
  return block;
}

/** Afasta o alvo de quem está colado, para os jogadores não se empilharem. */
function separate(w: World, a: Agent, t: Point): Point {
  const root = Math.sqrt(w.pitch.scale);
  const r = 2 * root;
  let sx = 0;
  let sy = 0;
  for (const o of w.agents) {
    if (o === a) continue;
    const d = dist(a.x, a.y, o.x, o.y);
    if (d >= r || d < 0.001) continue;
    const k = (r - d) / r;
    sx += ((a.x - o.x) / d) * k;
    sy += ((a.y - o.y) / d) * k;
  }
  return { x: t.x + sx * 2.4 * root, y: t.y + sy * 2.4 * root };
}

export function moveAgent(
  w: World,
  a: Agent,
  tx: number,
  ty: number,
  dt: number,
  sprint: boolean,
  speedMul = 1,
): void {
  const dx = tx - a.x;
  const dy = ty - a.y;
  const d = Math.hypot(dx, dy);
  const gkBoost = a.group === 'GK' ? 1.15 : 1;
  // arrancada depois de vencer um drible / atordoamento de quem foi driblado
  const burst = (a.boostT > 0 ? 1.25 : 1) * (a.slowT > 0 ? 0.65 : 1);
  const maxV =
    a.attrs.speed *
    gkBoost *
    speedMul *
    burst *
    (sprint ? 1 : TUNING.walkFactor) *
    (0.75 + 0.25 * a.stamina);
  const want = d < 0.15 ? 0 : Math.min(maxV, d * 3);
  const wvx = d > 0 ? (dx / d) * want : 0;
  const wvy = d > 0 ? (dy / d) * want : 0;

  const ax = wvx - a.vx;
  const ay = wvy - a.vy;
  const am = Math.hypot(ax, ay);
  const limit = TUNING.accel * Math.sqrt(w.pitch.scale) * speedMul * dt;
  if (am > limit) {
    a.vx += (ax / am) * limit;
    a.vy += (ay / am) * limit;
  } else {
    a.vx = wvx;
    a.vy = wvy;
  }

  a.x = Math.max(0, Math.min(w.pitch.L, a.x + a.vx * dt));
  a.y = Math.max(0, Math.min(w.pitch.H, a.y + a.vy * dt));

  const speed = Math.hypot(a.vx, a.vy);
  a.stats.distance += speed * dt;
  const frac = speed / (a.attrs.speed * speedMul);
  a.stamina = Math.max(
    0.15,
    a.stamina - frac * frac * TUNING.staminaDrain * (1.35 - a.attrs.stamina / 100) * dt,
  );
}

interface PassOption {
  target: Agent;
  score: number;
  /** lançamento por cima da marcação em vez de passe rasteiro */
  lob: boolean;
}

function bestPass(w: World, p: Agent, forGk = false): PassOption | null {
  const { pitch } = w;
  const tact = w.tactics[p.team];
  const root = pitch.scale;
  const opponents = w.byTeam[other(p.team)];
  const dir = dirOf(p.team);
  const pressured = nearestOpponentDistance(w, p) < 3.2 * root;
  // característica: + toque curto e seguro, − passe vertical e arriscado
  const directness = Math.max(0.4, tact.directness * (1 - 0.35 * p.bias.safe));
  let best: PassOption | null = null;

  for (const t of w.byTeam[p.team]) {
    if (t === p) continue;
    const d = dist(p.x, p.y, t.x, t.y);
    if (d < 2.5 * root) continue;
    if (isOffsidePosition(w, p.team, t, p.x) && !w.rng.chance(0.15)) continue;
    if (t.group === 'GK' && !forGk && progressOf(w, p.team, p.x) > 0.35) continue;

    let open = 12;
    let lane = 6;
    for (const o of opponents) {
      open = Math.min(open, dist(t.x, t.y, o.x, o.y));
      lane = Math.min(lane, distToSegment(o, p, t));
    }
    const gain = (t.x - p.x) * dir;
    const progT = progressOf(w, p.team, t.x);
    const noise = w.rng.next() * 2.5 - (1 - p.attrs.vision / 100) * w.rng.next() * 6;

    let s = Math.min(open, 10) + Math.min(lane, 5) * 1.8;
    s += gain * 0.13 * directness;
    if (gain < 0) s += gain * 0.12 + (pressured ? 4 : 0);
    if (d >= 5 * root && d <= 15 * root) s += 3 + 2 * Math.max(0, p.bias.safe);
    if (d > 25 * root) s -= ((d - 25 * root) * 0.9) / directness;
    if (d < 5 * root) s -= 2;
    if (progT > 0.7 && open > 5) s += 2.5;
    // lançamento: companheiro em corrida, com espaço nas costas da defesa
    if (t.vx * dir > 2 && gain > 12 * root && lane > 3) s += 1.5 * directness;
    // lateral em ultrapassagem, livre pelo corredor: sai a bola para a lateral
    if (FULLBACK_ROLES.has(t.role) && progT > 0.5 && Math.abs(t.y - pitch.H / 2) > pitch.H * 0.3 && open > 6) s += 3;
    // finalizador de ofício (Artilheiro, meia de chegada) bem posicionado na área recebe mais bolas
    if (progT > 0.75 && open > 4) s += Math.max(0, t.bias.shoot) * 3;
    // quem tem perfil de cruzador, livre pelo corredor no terço final, recebe mais bolas
    if (progT > 0.5 && Math.abs(t.y - pitch.H / 2) > pitch.H * 0.28 && open > 5) s += Math.max(0, t.bias.cross) * 3.5 + Math.max(0, t.bias.run) * 1.5;
    // passe/cruzamento para dentro da área
    if (progT > 0.82 && Math.abs(t.y - pitch.H / 2) < pitch.H * 0.3) s += 3;
    s += noise;

    let mode: PassOption = { target: t, score: s, lob: false };

    // Lançamento por cima: linha de passe fechada, mas o companheiro está livre lá na frente
    if (d >= 18 * root && lane < 2 * root && open > 6 * root) {
      const lobScore =
        Math.min(open, 10) +
        gain * 0.25 * directness +
        1 +
        (p.attrs.vision - 60) / 20 -
        Math.max(0, d - 40 * root) * 0.8 -
        3 -
        0.8 * Math.max(0, p.bias.safe) +
        noise;
      if (lobScore > s + 2) mode = { target: t, score: lobScore, lob: true };
    }
    if (!best || mode.score > best.score) best = mode;
  }
  return best;
}

/** Espaço livre à frente do portador (m), para decidir se vale conduzir. */
function spaceAhead(w: World, a: Agent): number {
  const gx = attackGoalX(w, a.team);
  const dx = gx - a.x;
  const dy = w.pitch.H / 2 - a.y;
  const len = Math.hypot(dx, dy) || 1;
  let space = 14 * w.pitch.scale;
  for (const o of w.byTeam[other(a.team)]) {
    const ox = o.x - a.x;
    const oy = o.y - a.y;
    const d = Math.hypot(ox, oy);
    if (d > space || d < 0.01) continue;
    if ((ox * dx + oy * dy) / (d * len) > 0.3) space = d;
  }
  return space;
}

const SHOOT_ROLE_FACTOR = { GK: 0, DEF: 0.6, MID: 1.4, ATT: 0.4 } as const;

function passOrLob(w: World, a: Agent, opt: PassOption): void {
  if (opt.lob) kickLob(w, a, opt.target);
  else kickPass(w, a, opt.target);
}

/**
 * Um contra um: o portador encara o marcador à frente. Vencer dá uma arrancada (e deixa o
 * marcador para trás); perder entrega a bola. Retorna true se a bola mudou de mãos.
 */
function tryTakeOn(w: World, a: Agent, best: PassOption | null): boolean {
  if (a.takeOnCd > 0 || a.group === 'GK') return false;
  const { pitch } = w;
  const root = pitch.scale;
  const gx = attackGoalX(w, a.team);
  const dx = gx - a.x;
  const dy = pitch.H / 2 - a.y;
  const len = Math.hypot(dx, dy) || 1;

  let foe: Agent | null = null;
  let foeD = 2.6 * root;
  for (const o of w.byTeam[other(a.team)]) {
    const ox = o.x - a.x;
    const oy = o.y - a.y;
    const d = Math.hypot(ox, oy);
    if (d < foeD && d > 0.01 && (ox * dx + oy * dy) / (d * len) > 0.2) {
      foeD = d;
      foe = o;
    }
  }
  if (!foe) return false;
  // com um passe muito bom disponível, toca em vez de driblar
  if (best && best.score > 22) return false;
  const pTry = Math.max(0.1, Math.min(0.85, 0.3 + a.bias.carry * 0.35 + (a.attrs.dribble - 60) / 150));
  if (!w.rng.chance(pTry)) return false;

  a.takeOnCd = 1.6;
  a.stats.dribbles += 1;
  const pWin = Math.max(
    0.12,
    Math.min(0.8, 0.5 + (a.attrs.dribble - foe.attrs.defend) / 140 + (a.attrs.speed - foe.attrs.speed) * 0.04 + a.bias.carry * 0.06),
  );
  if (w.rng.chance(pWin)) {
    a.stats.dribblesWon += 1;
    a.boostT = 0.7;
    foe.slowT = 0.7;
    foe.tackleCd = Math.max(foe.tackleCd, 1.1);
    return false;
  }
  // perdeu o drible: o marcador fica com a bola
  a.stats.losses += 1;
  foe.stats.tackles += 1;
  a.lock = 0.5;
  takePossession(w, foe);
  foe.think = 0.25;
  return true;
}

function ownerAct(w: World, a: Agent, dt: number): void {
  const { pitch } = w;
  const root = pitch.scale;
  const tact = w.tactics[a.team];
  const gx = attackGoalX(w, a.team);

  if (runSetPiece(w, a, dt)) return;

  a.think -= dt;
  if (a.think <= 0) {
    a.think = (TUNING.thinkMin + w.rng.next() * TUNING.thinkJitter) * tact.thinkMul;
    const pressure = nearestOpponentDistance(w, a);
    const goalDist = dist(a.x, a.y, gx, pitch.H / 2);
    const prog = progressOf(w, a.team, a.x);
    const best = bestPass(w, a, a.group === 'GK');

    if (a.group === 'GK') {
      if (best) passOrLob(w, a, best);
      else kickClear(w, a);
      return;
    }

    if (prog < TUNING.clearZone && pressure < 4 * root && (!best || best.score < 9)) {
      kickClear(w, a);
      return;
    }

    // Cruzamento rasteiro: perto da linha de fundo, devolve para quem chega na meia-lua / marca do pênalti
    if (prog > 0.86 && Math.abs(a.y - pitch.H / 2) > pitch.goalW) {
      const boxW = MARKINGS[w.setup.format].boxW;
      let back: Agent | null = null;
      let backOpen = 0;
      for (const t of w.byTeam[a.team]) {
        if (t === a || t.group === 'GK') continue;
        const pt = progressOf(w, a.team, t.x);
        if (pt < 0.7 || pt > prog - 0.03 || Math.abs(t.y - pitch.H / 2) > boxW * 0.45) continue;
        let open = 10;
        for (const o of w.byTeam[other(a.team)]) open = Math.min(open, dist(t.x, t.y, o.x, o.y));
        if (open > 3.5 * root && open > backOpen) {
          backOpen = open;
          back = t;
        }
      }
      if (back && w.rng.chance(0.55 + 0.2 * a.bias.safe)) {
        kickPass(w, a, back, { sigmaMul: 0.8 });
        return;
      }
    }

    // Cruzamento: portador pelo corredor, terço final, com gente na área
    if (Math.abs(a.y - pitch.H / 2) > pitch.H * (0.28 - Math.max(0, a.bias.cross) * 0.06) && prog > 0.68 - Math.max(0, a.bias.cross) * 0.1) {
      const inBox = w.byTeam[a.team].some(
        m => m !== a && m.group !== 'GK' && isInAttackBox(w, a.team, m.x, m.y, 4 * root),
      );
      if (inBox) {
        const base = FULLBACK_ROLES.has(a.role) ? 0.75 : 0.55;
        const pCross = Math.max(
          0.15,
          Math.min(0.92, base + (tact.widthMul - 1) * 0.8 + a.bias.cross * 0.55 + (a.attrs.crossing - 60) / 200),
        );
        if (w.rng.chance(pCross)) {
          kickCross(w, a);
          return;
        }
      }
    }

    const ft = FORMAT_TUNING[w.setup.format];
    // meias e defensores chutam de mais longe; quem tem chute de fora arrisca mais
    const range =
      ft.shootRange *
      pitch.L *
      (a.group === 'MID' ? 1.3 : a.group === 'DEF' ? 1.15 : 1) *
      (1 + a.bias.longShot * 0.3);
    if (goalDist < range) {
      // Companheiro em melhor posição, livre: toca em vez de forçar (gera assistências)
      const mates = w.byTeam[a.team].filter(m => m !== a && m.group !== 'GK');
      let tapIn: Agent | null = null;
      let tapScore = 0;
      for (const m of mates) {
        const md = dist(m.x, m.y, gx, pitch.H / 2);
        if (md > goalDist + 2 * root || md > range) continue;
        let open = 10;
        let lane = 5;
        for (const o of w.byTeam[other(a.team)]) {
          open = Math.min(open, dist(m.x, m.y, o.x, o.y));
          lane = Math.min(lane, distToSegment(o, a, m));
        }
        if (open > 5 * root && lane > 2.5 * root) {
          const score = open + lane;
          if (score > tapScore) {
            tapScore = score;
            tapIn = m;
          }
        }
      }
      if (tapIn && w.rng.next() > a.attrs.selfish + 0.05 + a.bias.shoot * 0.2) {
        kickPass(w, a, tapIn);
        return;
      }

      let laneToGoal = 4;
      for (const o of w.byTeam[other(a.team)]) {
        laneToGoal = Math.min(laneToGoal, distToSegment(o, a, { x: gx, y: pitch.H / 2 }));
      }
      const close = goalDist < pitch.L * 0.15 ? 0.2 : 0;
      let pShoot = ((1 - goalDist / range) * 0.6 + 0.15 + close + a.attrs.shoot / 400) * ft.shotP;
      pShoot *= SHOOT_ROLE_FACTOR[a.group] * tact.shootMul * (0.7 + a.attrs.selfish * 0.9);
      pShoot *= Math.max(0.2, 1 + a.bias.shoot);
      pShoot *= 0.6 + 0.4 * Math.min(1, laneToGoal / (3 * root));
      // de ângulo fechado a finalização é menos provável
      pShoot *= 0.55 + 0.45 * (1 - Math.min(1, Math.abs(a.y - pitch.H / 2) / (pitch.H * 0.4)));
      if (w.rng.chance(Math.min(0.9, pShoot))) {
        kickShot(w, a);
        return;
      }
    }

    // Drible: com um marcador logo à frente, tenta o um contra um (quem gosta de driblar tenta mais)
    if (tryTakeOn(w, a, best)) return;

    // Passar ou conduzir: conduz quando há espaço e o passe não compensa
    const carry =
      10 + Math.min(spaceAhead(w, a), 12 * root) * 1.2 + a.attrs.dribble / 15 + a.bias.carry * 7;
    if (best && ((pressure < 3.2 * root && best.score > 3) || best.score > carry)) {
      passOrLob(w, a, best);
      return;
    }
  }

  if (a.group === 'GK') {
    moveAgent(w, a, a.x, a.y, dt, false);
    return;
  }

  // Conduz a bola em direção ao gol, desviando de adversários próximos
  // Jogador de lado (lateral/ponta/meia aberto) segue pela faixa até a zona de cruzamento
  const wideRole = FULLBACK_ROLES.has(a.role) || a.homeLat < 0.25 || a.homeLat > 0.75;
  const onFlank = Math.abs(a.y - pitch.H / 2) > pitch.H * 0.28;
  const keepLane = wideRole && onFlank && a.bias.width > -0.3 ? 0.97 : onFlank ? 0.4 : 0.6;
  let tx = gx;
  let ty = pitch.H / 2 + (a.y - pitch.H / 2) * keepLane;
  let nearest = Infinity;
  for (const o of w.byTeam[other(a.team)]) {
    const d = dist(a.x, a.y, o.x, o.y);
    nearest = Math.min(nearest, d);
    if (d < 5 * root && d > 0.01) {
      const push = (5 * root - d) * 2.2;
      tx += ((a.x - o.x) / d) * push;
      ty += ((a.y - o.y) / d) * push;
    }
  }
  moveAgent(w, a, tx, ty, dt, nearest > 2 * root);
}

function tryTackle(w: World, a: Agent): void {
  const owner = w.ball.owner;
  if (!owner || owner.team === a.team || a.tackleCd > 0 || owner.protect > 0) return;
  if (setPieceHolding(w)) return;
  if (dist(a.x, a.y, owner.x, owner.y) > TUNING.tackleRadius) return;

  a.tackleCd = TUNING.tackleCooldown;
  // Quem é forte protege a bola e quem é fraco no corpo perde o duelo
  const duel = (a.attrs.defend - owner.attrs.dribble) / 110 + (a.attrs.strength - owner.attrs.strength) / 400;
  const base = 0.4 + duel;
  const p = Math.max(0.1, Math.min(0.7, base * (1 + (a.attrs.aggression - 0.5) * 0.4)));
  if (!w.rng.chance(p)) {
    // desarme perdido pode virar falta — mais provável vindo por trás, em quem é agressivo
    const fromBehind = owner.vx * (owner.x - a.x) + owner.vy * (owner.y - a.y) > 1;
    const formatMul = w.setup.format === 5 ? 0.45 : w.setup.format === 7 ? 0.6 : 1;
    const pFoul =
      Math.max(0.04, 0.16 + a.attrs.aggression * 0.3 - a.attrs.defend / 900 + (fromBehind ? 0.16 : 0)) *
      formatMul;
    // dentro da área o defensor pensa duas vezes antes de entrar na bola (menos pênaltis)
    const careful = isInAttackBox(w, owner.team, owner.x, owner.y) ? 0.45 : 1;
    if (w.rng.chance(pFoul * careful)) foul(w, a, owner, fromBehind);
    return;
  }

  a.stats.tackles += 1;
  owner.stats.losses += 1;
  owner.lock = 0.5;
  a.tackleCd = 0.25;
  takePossession(w, a);
  a.think = 0.25;
}

/** Quem pressiona a bola: os mais próximos do time sem posse, dentro do raio de pressão do estilo. */
function pickChasers(w: World): Set<Agent> {
  const chasers = new Set<Agent>();
  const { ball } = w;
  const owner = ball.owner;
  // Bola parada na pausa: ninguém corre para ela, só o cobrador
  if (w.restart) return chasers;

  for (const team of ['a', 'b'] as const) {
    if (owner && owner.team === team) continue;
    const tact = w.tactics[team];
    const n = owner ? tact.pressN : team === w.possession ? 1 : tact.pressN;
    const ballF = progressOf(w, team, ball.x);
    // ameaça perto do próprio gol: todo mundo se compromete mais
    let radius = tact.pressRadius * (ballF < 0.3 ? 1.5 : 1);
    let count = n;
    // gatilhos de pressão: saída de bola do adversário e bola na linha lateral (armadilha)
    if (owner && tact.pressTrap > 0) {
      const ownerProg = progressOf(w, owner.team, owner.x);
      const buildUp = ownerProg < 0.3 && (owner.group === 'GK' || owner.group === 'DEF');
      const onTouchline = Math.abs(owner.y - w.pitch.H / 2) > w.pitch.H * 0.38;
      if (buildUp) {
        radius *= 1 + 0.6 * tact.pressTrap;
        count = Math.min(3, count + 1);
      } else if (onTouchline) {
        radius *= 1 + 0.4 * tact.pressTrap;
        count = Math.min(3, count + 1);
      }
    }
    const nearest = w.byTeam[team]
      .filter(p => p.group !== 'GK')
      .map(p => ({ p, d: dist(p.x, p.y, ball.x, ball.y) }))
      .sort((m, k) => m.d - k.d)
      .slice(0, count);
    nearest.forEach(({ p, d }, i) => {
      // o mais próximo sempre vai; os demais só dentro do raio (marcadores combativos vão mais longe)
      if (i === 0 || d <= radius * (1 + p.bias.press * 0.35)) chasers.add(p);
    });

    const gk = w.byTeam[team].find(g => g.group === 'GK');
    if (gk && gkSweeps(w, gk)) chasers.add(gk);
  }
  return chasers;
}

function pickMarks(w: World, defending: Team, chasers: Set<Agent>): Map<Agent, Agent> {
  const marks = new Map<Agent, Agent>();
  const owner = w.ball.owner;
  if (!owner || owner.team === defending) return marks;

  const radius = 17 * w.pitch.scale;
  const defenders = w.byTeam[defending].filter(
    p => !chasers.has(p) && (p.group === 'DEF' || (p.group === 'MID' && p.homeDepth < 0.55)),
  );
  const attackers = w.byTeam[other(defending)].filter(p => p.group !== 'GK' && p !== owner);

  const pairs: { d: Agent; o: Agent; dist: number }[] = [];
  for (const d of defenders) {
    const home = blockTarget(w, d);
    for (const o of attackers) {
      const gap = dist(home.x, home.y, o.x, o.y);
      if (gap <= radius) pairs.push({ d, o, dist: gap });
    }
  }
  pairs.sort((m, k) => m.dist - k.dist);
  const usedO = new Set<Agent>();
  for (const pair of pairs) {
    if (marks.has(pair.d) || usedO.has(pair.o)) continue;
    marks.set(pair.d, pair.o);
    usedO.add(pair.o);
  }
  return marks;
}

export function prepareTick(w: World): TickCtx {
  // Bola parada (escanteio, falta, pênalti, lateral): ninguém pressiona o cobrador
  const holding = setPieceHolding(w);
  const chasers = holding ? new Set<Agent>() : pickChasers(w);
  const marks = new Map<Agent, Agent>();
  const supporters = new Set<Agent>();
  const owner = w.ball.owner;

  if (!holding) {
    for (const team of ['a', 'b'] as const) {
      for (const [d, o] of pickMarks(w, team, chasers)) marks.set(d, o);
    }
  }

  if (owner && !holding) {
    const reach = 28 * w.pitch.scale;
    w.byTeam[owner.team]
      .filter(p => p !== owner && p.group !== 'GK' && p.group !== 'ATT')
      .map(p => ({ p, d: dist(p.x, p.y, owner.x, owner.y) }))
      .filter(m => m.d < reach)
      .sort((m, k) => m.d - k.d)
      .slice(0, 2)
      .forEach(m => supporters.add(m.p));
  }

  // Linha de impedimento de cada time (penúltimo adversário): os atacantes correm até ela, não além
  const oppLine = { a: offsideLine(w, 'a'), b: offsideLine(w, 'b') };

  const tr = w.transition && w.time < w.transition.until ? w.transition : null;
  return {
    chasers,
    marks,
    supporters,
    oppLine,
    counter: tr ? tr.team : null,
    recover: tr ? other(tr.team) : null,
  };
}

export function updateAgent(w: World, a: Agent, dt: number, ctx: TickCtx): void {
  a.lock = Math.max(0, a.lock - dt);
  a.tackleCd = Math.max(0, a.tackleCd - dt);
  a.protect = Math.max(0, a.protect - dt);
  a.supportTimer = Math.max(0, a.supportTimer - dt);
  a.boostT = Math.max(0, a.boostT - dt);
  a.slowT = Math.max(0, a.slowT - dt);
  a.takeOnCd = Math.max(0, a.takeOnCd - dt);

  const { ball } = w;

  // Pausa de bola parada: o cobrador corre até a bola; os demais já tomam suas posições
  if (w.restart) {
    const cel = w.celebration;
    if (cel && w.restart.kind === 'kickoff') {
      if (a === cel.scorer) {
        moveAgent(w, a, cel.x, cel.y, dt, true);
        return;
      }
      if (a.team === cel.team && a.group !== 'GK' && dist(a.x, a.y, cel.scorer.x, cel.scorer.y) < 32 * Math.sqrt(w.pitch.scale)) {
        moveAgent(w, a, cel.scorer.x, cel.scorer.y, dt, true);
        return;
      }
    }
    if (w.restart.taker === a) {
      moveAgent(w, a, w.restart.x, w.restart.y, dt, true);
      return;
    }
    const rt = w.restart.targets?.get(a);
    if (rt) {
      // corrida organizada até a posição da bola parada: ninguém caminha
      moveAgent(w, a, rt.x, rt.y, dt, true, 1.35);
      return;
    }
  }

  if (ball.owner === a) {
    ownerAct(w, a, dt);
    return;
  }

  // Posição de escanteio/falta/pênalti (área cheia, marcadores, barreira, afastados)
  const spTarget = setPieceTarget(w, a);
  if (spTarget) {
    moveAgent(w, a, spTarget.x, spTarget.y, dt, true, dist(a.x, a.y, spTarget.x, spTarget.y) > 6 ? 1.35 : 1);
    return;
  }

  // Destinatário do passe corre ao encontro da bola
  if (ball.kind === 'pass' && ball.passTo === a) {
    moveAgent(w, a, ball.x + ball.vx * 0.35, ball.y + ball.vy * 0.35, dt, true);
    return;
  }

  if (ctx.chasers.has(a)) {
    const owner = ball.owner;
    const tx = owner ? owner.x + owner.vx * 0.25 : ball.x + ball.vx * 0.35;
    const ty = owner ? owner.y + owner.vy * 0.25 : ball.y + ball.vy * 0.35;
    moveAgent(w, a, tx, ty, dt, true, a.group === 'GK' ? 1.1 : 1);
    if (a.group !== 'GK') tryTackle(w, a);
    return;
  }

  if (a.group === 'GK') {
    // Mergulho: o goleiro se desloca bem mais rápido quando há chute a caminho
    const diving = incomingShotY(w, a) !== null;
    const t = gkTarget(w, a);
    moveAgent(w, a, t.x, t.y, dt, true, diving ? 1.9 : 1);
    return;
  }

  const home = separate(w, a, homeTarget(w, a, ctx));
  const far = dist(a.x, a.y, home.x, home.y) > 6 * w.pitch.scale;
  const hurry = ctx.recover === a.team || ctx.counter === a.team;
  moveAgent(w, a, home.x, home.y, dt, far || hurry);
  tryTackle(w, a);
}
