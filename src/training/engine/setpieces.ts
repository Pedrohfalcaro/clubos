import { MARKINGS } from './tuning.ts';
import {
  attackGoalX,
  clampToPitch,
  dist,
  kickPass,
  kickShot,
  other,
  progressOf,
  releaseBall,
  scheduleRestart,
  takePossession,
} from './world.ts';
import type { Agent, Restart, SetPiecePlan, Team, World } from './types.ts';

interface Point {
  x: number;
  y: number;
}

/** Direção que sai do gol atacado para dentro do campo (−1 para o gol da direita). */
function intoPitch(w: World, attackTeam: Team): 1 | -1 {
  return attackGoalX(w, attackTeam) === w.pitch.L ? -1 : 1;
}

/** `margin` (m) alarga a área — usado para achar quem está "na zona de cruzamento". */
export function isInAttackBox(w: World, attackTeam: Team, x: number, y: number, margin = 0): boolean {
  const m = MARKINGS[w.setup.format];
  const gx = attackGoalX(w, attackTeam);
  return Math.abs(x - gx) <= m.boxD + margin && Math.abs(y - w.pitch.H / 2) <= m.boxW / 2 + margin;
}

function outfield(w: World, team: Team): Agent[] {
  return w.byTeam[team].filter(a => a.group !== 'GK');
}

function best(list: Agent[], score: (a: Agent) => number): Agent | undefined {
  return list.reduce<Agent | undefined>((top, a) => (!top || score(a) > score(top) ? a : top), undefined);
}

function nearest(list: Agent[], x: number, y: number): Agent | undefined {
  return best(list, a => -dist(a.x, a.y, x, y));
}

/**
 * Escolhe cobrador e plano assim que a bola sai de jogo: o cobrador já corre até a bola durante
 * a pausa (nada de teletransporte) e a pausa dura o tempo que ele leva para chegar.
 */
export function planRestart(w: World, r: Restart): void {
  const mates = outfield(w, r.team);
  const pool = mates.length ? mates : w.byTeam[r.team];
  let taker: Agent | undefined;
  let plan: SetPiecePlan;

  switch (r.kind) {
    case 'goal-kick':
      taker = w.byTeam[r.team].find(a => a.group === 'GK') ?? pool[0];
      plan = 'goal-kick';
      break;
    case 'throw-in':
      taker = nearest(pool, r.x, r.y);
      plan = 'throw';
      break;
    case 'corner':
      taker = best(pool, a => a.attrs.crossing * 0.7 + a.attrs.pass * 0.3);
      plan = 'cross';
      break;
    case 'penalty':
      taker = best(pool, a => a.attrs.shoot - a.attrs.volatility * 5);
      plan = 'penalty';
      break;
    case 'free-kick': {
      const gx = attackGoalX(w, r.team);
      const goalDist = dist(r.x, r.y, gx, w.pitch.H / 2);
      const prog = progressOf(w, r.team, r.x);
      if (goalDist < w.pitch.L * 0.3 && prog > 0.7) {
        taker = best(pool, a => a.attrs.shoot + a.attrs.pass * 0.3);
        plan = w.rng.chance(0.45 + (taker?.attrs.shoot ?? 60) / 300) ? 'shot' : 'cross';
        if (plan === 'cross') taker = best(pool, a => a.attrs.crossing * 0.7 + a.attrs.pass * 0.3);
      } else if (prog > 0.62) {
        taker = best(pool, a => a.attrs.crossing * 0.7 + a.attrs.pass * 0.3);
        plan = 'cross';
      } else {
        taker = nearest(pool, r.x, r.y);
        plan = 'short';
      }
      break;
    }
    default:
      return;
  }

  if (!taker) return;
  r.taker = taker;
  r.plan = plan;
  // O cobrador corre até a bola; a pausa dura só o tempo da corrida (no máximo ~2 s)
  const arrive = dist(taker.x, taker.y, r.x, r.y) / (taker.attrs.speed * 1.0) + 0.3;
  r.timer = Math.max(r.timer, Math.min(2, arrive));

  // Os demais já se posicionam durante a pausa (área cheia no escanteio, barreira no tiro livre)
  const targets = new Map<Agent, Point>();
  if (r.kind !== 'penalty') {
    if (plan === 'cross') boxTargets(w, r.team, taker, r, targets);
    else if (plan === 'shot') wallTargets(w, r.team, r, targets);
  }
  r.targets = targets;
  if (plan === 'cross') r.timer = Math.max(r.timer, 1.5);
  if (plan === 'shot') r.timer = Math.max(r.timer, 1.5);
}

/** Posições de escanteio/falta cruzada: atacantes ocupam a área, marcadores acompanham. */
function boxTargets(w: World, team: Team, taker: Agent, spot: Point, targets: Map<Agent, Point>): void {
  const { pitch } = w;
  const m = MARKINGS[w.setup.format];
  const s = pitch.scale;
  const gx = attackGoalX(w, team);
  const into = intoPitch(w, team);
  const side = spot.y < pitch.H / 2 ? -1 : 1;
  const cy = pitch.H / 2;

  const spots: Point[] = [
    { x: gx + into * 3.5 * s, y: cy + side * pitch.goalW * 0.6 },
    { x: gx + into * m.spot, y: cy },
    { x: gx + into * 4 * s, y: cy - side * pitch.goalW * 0.9 },
    { x: gx + into * m.boxD * 0.9, y: cy + side * m.boxW * 0.3 },
    { x: gx + into * (m.boxD + 3 * s), y: cy - side * m.boxW * 0.25 },
    { x: gx + into * m.boxD * 0.6, y: cy - side * m.boxW * 0.38 },
  ];

  const mates = outfield(w, team).filter(a => a !== taker);
  // Ficam atrás (cobertura de contra-ataque) os defensores mais rápidos; os melhores de cabeça sobem
  const defenders = mates.filter(a => a.group === 'DEF');
  const coverPool = defenders.length ? defenders : mates;
  const keepBack = new Set(
    [...coverPool].sort((p, q) => q.attrs.speed - p.attrs.speed).slice(0, w.setup.format === 11 ? 2 : 1),
  );
  // quem sobe: os melhores no jogo aéreo / finalização
  const forBox = mates
    .filter(a => !keepBack.has(a))
    .sort((p, q) => q.attrs.aerial + q.attrs.shoot * 0.5 - (p.attrs.aerial + p.attrs.shoot * 0.5))
    .slice(0, spots.length);
  forBox.forEach((a, i) => targets.set(a, clampToPitch(w, spots[i].x, spots[i].y)));

  // Marcadores: cada um fica do lado do gol de um ponto de ataque
  const free = spots.slice(0, forBox.length);
  for (const d of outfield(w, other(team))) {
    if (!free.length) break;
    let bi = 0;
    let bd = Infinity;
    free.forEach((p, i) => {
      const dd = dist(d.x, d.y, p.x, p.y);
      if (dd < bd) {
        bd = dd;
        bi = i;
      }
    });
    const p = free.splice(bi, 1)[0];
    targets.set(d, clampToPitch(w, p.x - into * 1.4 * s, p.y));
  }
  const gk = w.byTeam[other(team)].find(a => a.group === 'GK');
  if (gk) targets.set(gk, { x: gx + into * 1.2, y: cy + side * pitch.goalW * 0.2 });
}

/** Barreira no tiro livre direto: 1 a 4 defensores a ~9 m, entre a bola e o gol. */
function wallTargets(w: World, team: Team, spot: Point, targets: Map<Agent, Point>): void {
  const { pitch } = w;
  const gx = attackGoalX(w, team);
  const gc = { x: gx, y: pitch.H / 2 };
  const goalDist = dist(spot.x, spot.y, gc.x, gc.y);
  const size = w.setup.format === 11 ? (goalDist < 20 ? 4 : 3) : w.setup.format === 7 ? 2 : 1;
  const gap = Math.min(9 * pitch.scale, goalDist * 0.55);
  const ux = (gc.x - spot.x) / (goalDist || 1);
  const uy = (gc.y - spot.y) / (goalDist || 1);
  const cx = spot.x + ux * gap;
  const cy = spot.y + uy * gap;

  const defenders = outfield(w, other(team));
  const taken = new Set<Agent>();
  for (let i = 0; i < size; i++) {
    const off = (i - (size - 1) / 2) * 0.85 * Math.sqrt(pitch.scale);
    const p = clampToPitch(w, cx - uy * off, cy + ux * off);
    const d = best(
      defenders.filter(a => !taken.has(a)),
      a => -dist(a.x, a.y, p.x, p.y),
    );
    if (!d) break;
    taken.add(d);
    targets.set(d, p);
  }
}

/** Pênalti: todos fora da área, goleiro na linha, cobrador atrás da bola. */
function penaltyTargets(w: World, team: Team, taker: Agent, targets: Map<Agent, Point>): void {
  const { pitch } = w;
  const m = MARKINGS[w.setup.format];
  const s = pitch.scale;
  const gx = attackGoalX(w, team);
  const into = intoPitch(w, team);
  const spotX = gx + into * m.spot;

  const gk = w.byTeam[other(team)].find(a => a.group === 'GK');
  if (gk) targets.set(gk, { x: gx + into * 0.6, y: pitch.H / 2 });
  targets.set(taker, { x: spotX + into * 1.4, y: pitch.H / 2 });

  const others = w.agents.filter(a => a !== taker && a !== gk);
  others.forEach((a, i) => {
    const row = i % 2;
    const col = Math.floor(i / 2) - others.length / 4;
    targets.set(
      a,
      clampToPitch(w, gx + into * (m.boxD + (2.5 + row * 2.2) * s), pitch.H / 2 + col * 2.4 * s),
    );
  });
  for (const [a, p] of targets) {
    a.x = p.x;
    a.y = p.y;
    a.vx = 0;
    a.vy = 0;
  }
}

/** Prepara escanteio, falta ou pênalti com o cobrador e o plano escolhidos na pausa. */
export function startSetPiece(w: World, r: Restart): void {
  const pool = outfield(w, r.team);
  const taker = r.taker && w.agents.includes(r.taker) ? r.taker : (pool[0] ?? w.byTeam[r.team][0]);
  taker.x = r.x;
  taker.y = r.y;
  taker.vx = 0;
  taker.vy = 0;
  w.ball.x = r.x;
  w.ball.y = r.y;
  takePossession(w, taker);
  w.transition = null;
  // falta curta e lateral saem rápido; bola parada de ataque pede um instante para a área se organizar
  taker.think = r.kind === 'penalty' ? 1.0 : r.kind === 'corner' ? 0.8 : r.plan === 'short' ? 0.25 : 0.6;
  taker.protect = 4;

  const plan = r.plan ?? 'short';
  const targets = new Map<Agent, Point>(r.targets ?? []);
  if (r.kind === 'penalty') penaltyTargets(w, r.team, taker, targets);

  w.setPiece = { kind: r.kind, team: r.team, taker, plan, targets, until: w.time + 8 };
}

/** Posição obrigatória enquanto a bola parada está valendo (ou null). */
export function setPieceTarget(w: World, a: Agent): Point | null {
  const sp = w.setPiece;
  if (!sp || w.time > sp.until) return null;
  // A barreira só vale até o chute sair
  if (sp.plan === 'shot' && w.ball.owner !== sp.taker && w.ball.kind !== 'shot') return null;
  return sp.targets.get(a) ?? null;
}

/** A bola está parada nas mãos do cobrador, esperando a cobrança. */
export function setPieceHolding(w: World): boolean {
  const sp = w.setPiece;
  return !!sp && w.time <= sp.until && w.ball.owner === sp.taker;
}

/** Companheiro para o arremesso lateral: livre e perto. */
function throwTarget(w: World, p: Agent): Agent | null {
  const root = Math.sqrt(w.pitch.scale);
  const opponents = w.byTeam[other(p.team)];
  let top: { a: Agent; s: number } | null = null;
  for (const t of w.byTeam[p.team]) {
    if (t === p || t.group === 'GK') continue;
    const d = dist(p.x, p.y, t.x, t.y);
    if (d > 22 * root || d < 3 * root) continue;
    let open = 10;
    for (const o of opponents) open = Math.min(open, dist(t.x, t.y, o.x, o.y));
    const s = Math.min(open, 10) * 1.2 + progressOf(w, p.team, t.x) * 6 - d * 0.15 + w.rng.next() * 2;
    if (!top || s > top.s) top = { a: t, s };
  }
  return top?.a ?? null;
}

/** Cruzamento: bola alta para a área, cai no ponto escolhido e vira disputa aérea. */
export function kickCross(w: World, p: Agent): void {
  const { ball, pitch } = w;
  const m = MARKINGS[w.setup.format];
  const root = Math.sqrt(pitch.scale);
  const gx = attackGoalX(w, p.team);
  const into = intoPitch(w, p.team);

  const fromSetPiece = !!w.setPiece && w.setPiece.taker === p;
  // Mira em quem é melhor no alto e está livre; sem ninguém, na marca do pênalti
  let aim: Point | null = null;
  let top = -Infinity;
  for (const t of w.byTeam[p.team]) {
    if (t === p || t.group === 'GK') continue;
    if (!isInAttackBox(w, p.team, t.x, t.y)) continue;
    let open = 10;
    for (const o of w.byTeam[other(p.team)]) open = Math.min(open, dist(t.x, t.y, o.x, o.y));
    // em bola parada o alvo é quem é bom de cabeça (zagueiro alto sobe e vira opção real)
    const score = fromSetPiece ? open * 0.6 + t.attrs.aerial / 9 + (t.group === 'DEF' ? 8 : 0) + w.rng.next() * 1.5 : open + t.attrs.aerial / 25;
    if (score > top) {
      top = score;
      aim = { x: t.x + t.vx * 0.6, y: t.y + t.vy * 0.6 };
    }
  }
  if (!aim) {
    aim = { x: gx + into * m.spot * 0.85, y: pitch.H / 2 + (w.rng.next() - 0.5) * pitch.goalW * 2 };
  }

  const sigma = (1 - p.attrs.crossing / 100) * 5 * root * p.attrs.volatility + 0.8 * root;
  const target = clampToPitch(w, aim.x + w.rng.gauss() * sigma, aim.y + w.rng.gauss() * sigma);
  const d = dist(p.x, p.y, target.x, target.y);
  const T = d / (17 * root) + 0.45;

  p.stats.crosses += 1;
  releaseBall(w, p);
  ball.vx = (target.x - p.x) / T;
  ball.vy = (target.y - p.y) / T;
  ball.kind = 'cross';
  ball.crossFrom = p;
  ball.crossT = T;
  ball.lobTo = null;
  ball.passFrom = null;
  ball.passTo = null;
  ball.shotTeam = null;
  ball.shotAssist = null;
  ball.saveResolved = false;
}

/** Lançamento: passe longo por cima da marcação, destinado a um companheiro. */
export function kickLob(w: World, p: Agent, target: Agent): void {
  const { ball, pitch } = w;
  const root = Math.sqrt(pitch.scale);
  const passAttr = p.group === 'GK' ? p.attrs.distribution : p.attrs.pass;
  const d0 = dist(p.x, p.y, target.x, target.y);
  const lead = Math.min(1.2, d0 / (16 * root));
  const aim = clampToPitch(w, target.x + target.vx * lead, target.y + target.vy * lead);
  const sigma = ((1 - passAttr / 100) * 3.2 * p.attrs.volatility + 0.5) * root;
  const landing = clampToPitch(w, aim.x + w.rng.gauss() * sigma, aim.y + w.rng.gauss() * sigma);
  const d = dist(p.x, p.y, landing.x, landing.y);
  const T = d / (16 * root) + 0.5;

  releaseBall(w, p);
  ball.vx = (landing.x - p.x) / T;
  ball.vy = (landing.y - p.y) / T;
  ball.kind = 'cross';
  ball.crossFrom = p;
  ball.crossT = T;
  ball.lobTo = target;
  ball.passFrom = null;
  ball.passTo = null;
  ball.shotTeam = null;
  ball.shotAssist = null;
  ball.saveResolved = false;
}

/** Cobrança de bola parada. Devolve true quando o cobrador tratou a jogada (ou ainda espera). */
export function runSetPiece(w: World, a: Agent, dt: number): boolean {
  const sp = w.setPiece;
  if (!sp || sp.taker !== a || w.ball.owner !== a) return false;

  a.think -= dt;
  if (a.think > 0) {
    a.vx = 0;
    a.vy = 0;
    return true;
  }

  // Cruzamento de bola parada: espera a área encher (até ~3 s), senão os zagueiros lentos nunca chegam
  if (sp.plan === 'cross' && w.time - (sp.until - 8) < 3.8) {
    for (const [p, t] of sp.targets) {
      if (p.team === sp.team && dist(p.x, p.y, t.x, t.y) > 5 * Math.sqrt(w.pitch.scale)) return true;
    }
  }

  const root = Math.sqrt(w.pitch.scale);
  switch (sp.plan) {
    case 'throw': {
      const t = throwTarget(w, a);
      if (!t) {
        w.setPiece = null;
        return false;
      }
      kickPass(w, a, t, { maxSpeed: 14 * root, sigmaMul: 0.6 });
      return true;
    }
    case 'cross':
      kickCross(w, a);
      return true;
    case 'shot':
      kickShot(w, a, { freeKick: true });
      return true;
    case 'penalty':
      kickShot(w, a, { penalty: true });
      return true;
    default:
      // tiro de meta e falta curta seguem a decisão normal do portador: a bola parada acaba aqui
      w.setPiece = null;
      return false;
  }
}

/** Fim do voo de um cruzamento ou lançamento. */
export function resolveCross(w: World): void {
  const { ball, pitch } = w;
  const crosser = ball.crossFrom;
  const lobTo = ball.lobTo;
  ball.crossFrom = null;
  ball.lobTo = null;
  ball.kind = 'loose';
  ball.vx = 0;
  ball.vy = 0;
  if (!crosser) return;

  const root = Math.sqrt(pitch.scale);
  const defTeam = other(crosser.team);
  const gk = w.byTeam[defTeam].find(a => a.group === 'GK');

  // Goleiro sai e encaixa a bola
  if (gk) {
    const reach = (4 + (gk.attrs.sweeping / 100) * 5) * root;
    const inOwnBox = isInAttackBox(w, crosser.team, ball.x, ball.y, 2 * root);
    if (inOwnBox && dist(gk.x, gk.y, ball.x, ball.y) < reach) {
      const claim = Math.max(0.1, Math.min(0.78, 0.12 + gk.attrs.aerial / 200 + gk.attrs.handling / 400));
      if (w.rng.chance(claim)) {
        crosser.stats.passesBad += 1;
        takePossession(w, gk);
        gk.think = 0.8;
        return;
      }
    }
  }

  const contenders = w.agents.filter(
    a => a.lock <= 0 && (a.group !== 'GK' || a === gk) && dist(a.x, a.y, ball.x, ball.y) < 3.2 * root,
  );
  if (!contenders.length) {
    crosser.stats.passesBad += 1;
    ball.lastTouch = crosser;
    ball.vx = (w.rng.next() - 0.5) * 6;
    ball.vy = (w.rng.next() - 0.5) * 6;
    return;
  }

  let winner = contenders[0];
  let topScore = -Infinity;
  for (const a of contenders) {
    let power: number;
    if (lobTo) {
      // Lançamento: quem controla melhor, o destinatário leva vantagem
      power =
        a === lobTo
          ? 26 + a.attrs.dribble * 0.25 + a.attrs.aerial * 0.15
          : a.team === crosser.team
            ? a.attrs.aerial * 0.3 + a.attrs.pass * 0.1
            : a.attrs.defend * 0.4 + a.attrs.aerial * 0.4;
    } else if (a.team === crosser.team) {
      // zagueiro que sobe na bola parada chega com embalo (e é alto): leva vantagem no alto
      power = a.attrs.aerial * 0.6 + a.attrs.strength * 0.2 + a.attrs.shoot * 0.1 + (a.group === 'DEF' && w.setPiece ? 6 : 0);
    } else {
      power = a.attrs.aerial * 0.45 + a.attrs.defend * 0.35 + a.attrs.strength * 0.15;
    }
    const score = power + w.rng.gauss() * 9 - dist(a.x, a.y, ball.x, ball.y) * 3;
    if (score > topScore) {
      topScore = score;
      winner = a;
    }
  }

  if (winner.team === crosser.team) {
    crosser.stats.passesOk += 1;
    w.assistCandidate = { from: crosser, to: winner, t: w.time };
    ball.lastTouch = winner;
    takePossession(w, winner);
    // Cruzamento: cabeceio/finalização de primeira. Lançamento: domina e segue o jogo.
    if (!lobTo) kickShot(w, winner, { header: true });
    return;
  }

  crosser.stats.passesBad += 1;
  if (lobTo) {
    winner.stats.interceptions += 1;
    ball.lastTouch = winner;
    takePossession(w, winner);
    return;
  }
  winner.stats.clearances += 1;
  const away = Math.atan2(pitch.H / 2 - ball.y, pitch.L / 2 - ball.x) + (w.rng.next() - 0.5) * 1.2;
  ball.lastTouch = winner;
  ball.vx = Math.cos(away) * 11;
  ball.vy = Math.sin(away) * 11;
  winner.lock = 0.3;
}

/** Expulsão: o jogador deixa o campo e o time segue com um a menos. */
export function sendOff(w: World, a: Agent): void {
  if (a.sentOff) return;
  a.sentOff = true;
  a.leftAt = w.time;
  a.stats.cleanSheet = false;
  w.agents.splice(w.agents.indexOf(a), 1);
  const list = w.byTeam[a.team];
  list.splice(list.indexOf(a), 1);
  w.subbedOut.push(a);
  if (w.setPiece) w.setPiece.targets.delete(a);
}

/**
 * Falta: tiro livre onde foi cometida — ou pênalti se foi dentro da área. Entradas por trás,
 * em jogadores velozes e de quem é agressivo rendem cartão; o segundo amarelo expulsa.
 */
export function foul(w: World, offender: Agent, victim: Agent, fromBehind: boolean): void {
  offender.stats.fouls += 1;
  victim.stats.foulsWon += 1;
  w.events.push({ type: 'foul', t: w.time, team: victim.team, playerId: offender.id });

  const s = clampToPitch(w, victim.x, victim.y);
  const penalty = isInAttackBox(w, victim.team, s.x, s.y);

  // Cartões (goleiro leva no máximo amarelo, para o time nunca ficar sem goleiro)
  const speed = Math.hypot(victim.vx, victim.vy) / victim.attrs.speed;
  // campos menores têm menos jogadores: o juiz é mais brando
  const strict = w.setup.format === 5 ? 0.55 : w.setup.format === 7 ? 0.8 : 1;
  const pRed = (0.01 + (fromBehind ? 0.02 : 0) + (penalty ? 0.01 : 0)) * strict;
  const pYellow = (0.1 + (fromBehind ? 0.14 : 0) + offender.attrs.aggression * 0.12 + speed * 0.05) * strict;
  const r = w.rng.next();
  if (r < pRed && offender.group !== 'GK') {
    offender.stats.reds += 1;
    w.events.push({ type: 'card', t: w.time, team: offender.team, playerId: offender.id, card: 'red' });
    sendOff(w, offender);
  } else if (r < pRed + pYellow) {
    offender.stats.yellows += 1;
    const second = offender.stats.yellows >= 2 && offender.group !== 'GK';
    w.events.push({
      type: 'card',
      t: w.time,
      team: offender.team,
      playerId: offender.id,
      card: second ? 'second-yellow' : 'yellow',
    });
    if (second) {
      offender.stats.reds += 1;
      sendOff(w, offender);
    }
  }

  if (penalty) {
    const m = MARKINGS[w.setup.format];
    const gx = attackGoalX(w, victim.team);
    const spotX = gx + intoPitch(w, victim.team) * m.spot;
    w.events.push({ type: 'penalty', t: w.time, team: victim.team, playerId: victim.id });
    scheduleRestart(w, 'penalty', victim.team, spotX, w.pitch.H / 2, 1.8);
    return;
  }
  scheduleRestart(w, 'free-kick', victim.team, s.x, s.y, 0.6);
}

/** Escanteio/falta: adversários mantêm a distância regulamentar da bola até a cobrança. */
export function pushOpponentsBack(w: World): void {
  const sp = w.setPiece;
  if (!sp || (sp.kind !== 'corner' && sp.kind !== 'free-kick') || !setPieceHolding(w)) return;
  const radius = (sp.kind === 'corner' ? 6 : 7) * w.pitch.scale;
  const { ball } = w;
  for (const a of w.byTeam[other(sp.team)]) {
    if (a.group === 'GK' || sp.targets.has(a)) continue;
    const d = dist(a.x, a.y, ball.x, ball.y);
    if (d >= radius) continue;
    const ux = d > 0.01 ? (a.x - ball.x) / d : 1;
    const uy = d > 0.01 ? (a.y - ball.y) / d : 0;
    const p = clampToPitch(w, ball.x + ux * radius, ball.y + uy * radius);
    a.x = p.x;
    a.y = p.y;
    a.vx = 0;
    a.vy = 0;
  }
}
