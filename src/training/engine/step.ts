import { prepareTick, updateAgent } from './ai.ts';
import { pushOpponentsBack, resolveCross } from './setpieces.ts';
import { TUNING } from './tuning.ts';
import {
  attackGoalX,
  dirOf,
  dist,
  executeRestart,
  other,
  scheduleRestart,
  callOffside,
  takePossession,
} from './world.ts';
import type { Agent, Team, World } from './types.ts';

function recordGoal(w: World, scoringTeam: Team): void {
  const { ball } = w;
  const toucher = ball.lastTouch;
  const ownGoal = !toucher || toucher.team !== scoringTeam;

  w.score[scoringTeam] += 1;
  let assistId: string | undefined;
  if (!ownGoal && toucher) {
    toucher.stats.goals += 1;
    if (ball.kind === 'shot' && ball.shotAssist) {
      ball.shotAssist.stats.assists += 1;
      assistId = ball.shotAssist.id;
    }
  }
  for (const a of w.byTeam[other(scoringTeam)]) a.stats.conceded += 1;

  w.events.push({
    type: 'goal',
    t: w.time,
    team: scoringTeam,
    playerId: toucher?.id,
    assistId,
    ownGoal,
  });

  scheduleRestart(w, 'kickoff', other(scoringTeam), w.pitch.L / 2, w.pitch.H / 2, TUNING.goalDelay);
  // O autor do gol corre para a bandeirinha e os companheiros vão atrás
  w.celebration =
    !ownGoal && toucher
      ? {
          scorer: toucher,
          team: scoringTeam,
          x: attackGoalX(w, scoringTeam),
          y: ball.y < w.pitch.H / 2 ? 0 : w.pitch.H,
        }
      : null;
}

function ballOutOfPlay(w: World): void {
  const { ball, pitch } = w;
  const lastTeam = ball.lastTouch?.team ?? 'a';
  if (ball.passFrom) {
    ball.passFrom.stats.passesBad += 1;
    ball.passFrom = null;
  }
  if (ball.crossFrom) {
    ball.crossFrom.stats.passesBad += 1;
    ball.crossFrom = null;
  }

  if (ball.x < 0 || ball.x > pitch.L) {
    const endTeam: Team = ball.x < 0 ? 'a' : 'b';
    const inMouth = Math.abs(ball.y - pitch.H / 2) <= pitch.goalW / 2;
    if (inMouth) {
      recordGoal(w, other(endTeam));
      return;
    }
    const endX = ball.x < 0 ? 0 : pitch.L;
    if (lastTeam === endTeam) {
      const cornerY = ball.y < pitch.H / 2 ? 0 : pitch.H;
      w.events.push({ type: 'corner', t: w.time, team: other(endTeam) });
      scheduleRestart(w, 'corner', other(endTeam), endX, cornerY, TUNING.restartDelay);
    } else {
      const boxX = endX === 0 ? 5.5 * pitch.scale : pitch.L - 5.5 * pitch.scale;
      scheduleRestart(w, 'goal-kick', endTeam, boxX, pitch.H / 2, TUNING.restartDelay);
    }
    return;
  }

  const spotX = Math.max(1, Math.min(pitch.L - 1, ball.x));
  const spotY = ball.y < 0 ? 0 : pitch.H;
  scheduleRestart(w, 'throw-in', other(lastTeam), spotX, spotY, TUNING.restartDelay);
}

/** Goleiro espalma ou zagueiro bloqueia para escanteio. */
function awardCorner(w: World, attackTeam: Team): void {
  const { ball, pitch } = w;
  const endX = attackGoalX(w, attackTeam);
  const cornerY = ball.y < pitch.H / 2 ? 0 : pitch.H;
  w.events.push({ type: 'corner', t: w.time, team: attackTeam });
  scheduleRestart(w, 'corner', attackTeam, endX, cornerY, TUNING.restartDelay);
}

/**
 * Defesa do goleiro. A chance depende do reflexo (e do jogo de mãos), da velocidade, de quão
 * perto do canto foi o chute e da distância: chute de longe é mais fácil; de perto, mais difícil.
 * Pênalti é um caso à parte (o goleiro escolhe um lado). A defesa pode ser encaixe, rebote
 * ou espalmada para escanteio.
 */
function goalkeeperSave(w: World, gk: Agent, defTeam: Team): boolean {
  const { ball, pitch } = w;
  const shooter = ball.lastTouch;
  const speed = Math.hypot(ball.vx, ball.vy);
  const offset = Math.min(1, Math.abs(ball.y - pitch.H / 2) / (pitch.goalW / 2));
  let p: number;

  if (ball.penalty && ball.panenka) {
    // cavadinha: quem pula para um canto fica para trás
    p = 0.3;
  } else if (ball.penalty) {
    const correctSide = w.rng.chance(Math.max(0.4, Math.min(0.75, 0.5 + (gk.attrs.penaltySave - 55) / 250)));
    p = correctSide
      ? 0.42 + gk.attrs.penaltySave / 700 - ((shooter?.attrs.shoot ?? 60) - 60) / 500
      : 0.04;
    p = Math.max(0.03, Math.min(0.72, p));
  } else {
    const close = ball.shotDist < 8 * pitch.scale ? ((8 * pitch.scale - ball.shotDist) / (8 * pitch.scale)) * 0.18 : 0;
    p =
      0.27 +
      gk.attrs.gk / 230 +
      (gk.attrs.handling - 60) / 600 -
      Math.max(0, speed - 20) * 0.01 -
      offset * 0.14 +
      Math.min(1, ball.shotDist / pitch.L) * 0.18 -
      close -
      // cabeceio dentro da área: pouco tempo de reação
      (ball.header ? 0.3 : 0);
    p = Math.max(0.08, Math.min(0.92, p));
  }
  if (!w.rng.chance(p)) return false;

  gk.stats.saves += 1;
  w.events.push({ type: 'save', t: w.time, team: defTeam, playerId: gk.id });
  const catchP = Math.max(0.1, 0.3 + gk.attrs.handling / 220 - Math.max(0, speed - 18) * 0.015);
  if (w.rng.chance(catchP)) {
    takePossession(w, gk);
    gk.think = 0.8;
    return true;
  }
  if (ball.shotTeam && w.rng.chance(0.5)) {
    // espalma para escanteio
    awardCorner(w, ball.shotTeam);
    return true;
  }
  // rebote: a bola sobra para o lado, longe do gol
  const away = dirOf(defTeam);
  ball.kind = 'loose';
  ball.shotTeam = null;
  ball.shotAssist = null;
  ball.lastTouch = gk;
  ball.penalty = false;
  ball.vx = away * (3 + w.rng.next() * 4);
  ball.vy = (ball.y < pitch.H / 2 ? -1 : 1) * (1 + w.rng.next() * 6);
  gk.lock = 0.5;
  return true;
}

function resolveShotInterference(w: World): void {
  const { ball } = w;
  if (ball.kind !== 'shot' || !ball.shotTeam) return;
  const defTeam = other(ball.shotTeam);
  const speed = Math.hypot(ball.vx, ball.vy);

  const gk = w.byTeam[defTeam].find(a => a.group === 'GK');
  const reach = TUNING.gkReach * Math.sqrt(w.pitch.scale);
  if (gk && !ball.saveResolved && dist(gk.x, gk.y, ball.x, ball.y) < reach) {
    ball.saveResolved = true;
    if (goalkeeperSave(w, gk, defTeam)) return;
  }

  // Barreira e defensores no caminho bloqueiam o chute
  const wallActive = !!w.setPiece && w.setPiece.kind === 'free-kick';
  for (const d of w.byTeam[defTeam]) {
    if (d.group === 'GK' || d.lock > 0) continue;
    if (dist(d.x, d.y, ball.x, ball.y) > 0.9) continue;
    d.lock = 0.6;
    const inWall = wallActive && w.setPiece?.targets.has(d);
    if (!w.rng.chance(inWall ? 0.6 : 0.22 + d.attrs.defend / 320)) continue;
    d.stats.clearances += 1;
    if (w.rng.chance(0.5)) {
      awardCorner(w, ball.shotTeam);
      return;
    }
    const angle = w.rng.next() * Math.PI * 2;
    ball.kind = 'loose';
    ball.shotTeam = null;
    ball.shotAssist = null;
    ball.lastTouch = d;
    ball.vx = Math.cos(angle) * 7;
    ball.vy = Math.sin(angle) * 7;
    return;
  }

  if (speed < 9) {
    ball.kind = 'loose';
    ball.shotTeam = null;
    ball.shotAssist = null;
  }
}

function resolvePickups(w: World): void {
  const { ball } = w;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > TUNING.pickupMaxSpeed || ball.kind === 'shot') return;

  const candidates: { a: Agent; d: number }[] = [];
  for (const a of w.agents) {
    if (a.lock > 0) continue;
    const reach = a.group === 'GK' ? TUNING.gkPickupRadius : TUNING.pickupRadius;
    const d = dist(a.x, a.y, ball.x, ball.y);
    if (d <= reach) candidates.push({ a, d });
  }
  candidates.sort((m, k) => m.d - k.d);

  for (const { a } of candidates) {
    const lastTeam = ball.lastTouch?.team;
    const opponentOfToucher = lastTeam !== undefined && a.team !== lastTeam;

    if (opponentOfToucher) {
      const inFlight = ball.kind === 'pass' || ball.kind === 'clear';
      const p = inFlight ? 0.18 + a.attrs.defend / 450 : 0.6;
      if (!w.rng.chance(p)) {
        a.lock = 0.25;
        continue;
      }
      if (ball.kind === 'pass' && ball.passFrom) a.stats.interceptions += 1;
      takePossession(w, a);
      return;
    }

    const p = Math.max(0.55, Math.min(0.97, 1.05 - speed / 40 + a.attrs.pass / 400));
    if (!w.rng.chance(p)) {
      ball.vx *= 0.45;
      ball.vy *= 0.45;
      ball.vx += (w.rng.next() - 0.5) * 3;
      ball.vy += (w.rng.next() - 0.5) * 3;
      a.lock = 0.25;
      continue;
    }
    if (ball.offsideBy === a) {
      callOffside(w, a);
      return;
    }
    takePossession(w, a);
    return;
  }
}

function stepBall(w: World, dt: number): void {
  const { ball, pitch } = w;

  if (ball.owner) {
    const o = ball.owner;
    const speed = Math.hypot(o.vx, o.vy);
    const fx = speed > 0.3 ? o.vx / speed : dirOf(o.team);
    const fy = speed > 0.3 ? o.vy / speed : 0;
    ball.x = o.x + fx * TUNING.carryDistance;
    ball.y = o.y + fy * TUNING.carryDistance;
    ball.vx = o.vx;
    ball.vy = o.vy;
    return;
  }

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Cruzamento no ar: sem atrito nem interceptação — só a disputa na queda
  if (ball.kind === 'cross') {
    ball.crossT -= dt;
    if (ball.x < 0 || ball.x > pitch.L || ball.y < 0 || ball.y > pitch.H) {
      ballOutOfPlay(w);
      return;
    }
    if (ball.crossT <= 0) resolveCross(w);
    return;
  }

  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > 0) {
    const fr = TUNING.ballFriction * Math.sqrt(pitch.scale) * dt;
    const next = Math.max(0, speed - fr);
    ball.vx *= next / speed;
    ball.vy *= next / speed;
  }

  if (ball.x < 0 || ball.x > pitch.L || ball.y < 0 || ball.y > pitch.H) {
    ballOutOfPlay(w);
    return;
  }

  resolveShotInterference(w);
  if (!ball.owner) resolvePickups(w);
}

function finishMatch(w: World): void {
  w.phase = 'ft';
  w.events.push({ type: 'full-time', t: w.time });
  for (const team of ['a', 'b'] as const) {
    if (w.score[other(team)] === 0) for (const a of w.byTeam[team]) a.stats.cleanSheet = true;
  }
}

/** True quando o apito final já soou. */
export function isFinished(w: World): boolean {
  return w.phase === 'ft';
}

export function stepWorld(w: World, dt: number = TUNING.dt): void {
  if (w.phase === 'ft') return;
  w.time += dt;
  w.clock += dt;

  if (w.restart) {
    w.restart.timer -= dt;
    if (w.restart.timer <= 0) executeRestart(w);
  }

  if (!w.restart) w.possTime[w.possession] += dt;
  const ctx = prepareTick(w);
  for (const a of w.agents) updateAgent(w, a, dt, ctx);
  pushOpponentsBack(w);
  if (!w.restart) stepBall(w, dt);

  if (w.clock >= w.setup.halfDurationSec) {
    if (w.phase === 'h1') {
      w.phase = 'h2';
      w.clock = 0;
      w.events.push({ type: 'half-time', t: w.time });
      scheduleRestart(w, 'kickoff', 'b', w.pitch.L / 2, w.pitch.H / 2, TUNING.halfTimeDelay);
    } else {
      finishMatch(w);
    }
  }
}
