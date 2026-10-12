/**
 * Teste de regressão do motor do Training Pit (roda sem tela):
 *   node scripts/trainingRegression.ts            # completo (~2–3 min)
 *   node scripts/trainingRegression.ts --quick    # rápido (~40 s), menos partidas
 *
 * Simula várias partidas por formato/formação/estilo e compara com as metas do game design
 * (docs em Training - Desenvolvimento/GAME_DESIGN_TRAINING_PIT.md). Sai com código 1 se algo
 * sair da faixa — rode depois de mexer em qualquer coisa do motor.
 */
import { buildResult, simulateMatch } from '../src/training/engine/sim.ts';
import { computeRatings, createWorld, runShootout, stepWorld, substitute } from '../src/training/engine/index.ts';
import { TRAITS } from '../src/training/engine/traits.ts';
import { buildTrainingPulse } from '../src/training/pulseNews.ts';
import { applyTrainingEffects, applyTrainingToPlayers, revertTrainingOnPlayers } from '../src/training/effects.ts';
import type { Player } from '../src/types/Player.ts';
import { positionMatch, ringOf } from '../src/utils/positions.ts';
import type { TrainingSession } from '../src/types/Training.ts';
import type { EnginePlayerInput, Format, MatchResult, StyleTraits } from '../src/training/engine/types.ts';
import type { PlayerPosition } from '../src/types/Player.ts';
import type { SlotRole } from '../src/types/Tactics.ts';

const QUICK = process.argv.includes('--quick');
const HALF = 150;

type Slot = [SlotRole, PlayerPosition, number, number];
type Layout = Slot[];

const LAYOUTS: Record<string, { format: Format; slots: Layout }> = {
  '5 · 2-2': {
    format: 5,
    slots: [['GOL', 'GK', 50, 88], ['ZAG', 'CB', 32, 66], ['ZAG', 'CB', 68, 66], ['ATA', 'ST', 32, 34], ['ATA', 'ST', 68, 34]],
  },
  '7 · 2-3-1': {
    format: 7,
    slots: [['GOL', 'GK', 50, 88], ['ZAG', 'CB', 32, 70], ['ZAG', 'CB', 68, 70], ['ME', 'LW', 20, 48], ['MC', 'CM', 50, 48], ['MD', 'RW', 80, 48], ['ATA', 'ST', 50, 24]],
  },
  '11 · 4-4-2': {
    format: 11,
    slots: [['GOL', 'GK', 50, 88], ['LE', 'LB', 15, 72], ['ZAG', 'CB', 38, 72], ['ZAG', 'CB', 62, 72], ['LD', 'RB', 85, 72], ['ME', 'LW', 15, 48], ['MC', 'CM', 38, 48], ['MC', 'CM', 62, 48], ['MD', 'RW', 85, 48], ['ATA', 'ST', 35, 22], ['ATA', 'ST', 65, 22]],
  },
  '11 · 4-3-3': {
    format: 11,
    slots: [['GOL', 'GK', 50, 88], ['LE', 'LB', 15, 68], ['ZAG', 'CB', 38, 72], ['ZAG', 'CB', 62, 72], ['LD', 'RB', 85, 68], ['MC', 'CM', 28, 50], ['VOL', 'CDM', 50, 54], ['MC', 'CM', 72, 50], ['PE', 'LW', 20, 22], ['ATA', 'ST', 50, 18], ['PD', 'RW', 80, 22]],
  },
};

const STYLES: Record<string, StyleTraits> = {
  posse: { mentalidade: 3, ritmo: 2, amplitude: 4, pressao: 4, linha: 4 },
  direto: { mentalidade: 4, ritmo: 5, amplitude: 3, pressao: 3, linha: 3 },
  retranca: { mentalidade: 1, ritmo: 1, amplitude: 1, pressao: 1, linha: 1 },
  ultra: { mentalidade: 5, ritmo: 5, amplitude: 4, pressao: 5, linha: 5 },
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

function team(prefix: string, slots: Layout, rand: () => number, extra?: (i: number) => Partial<EnginePlayerInput>): EnginePlayerInput[] {
  return slots.map((s, i) => ({
    id: `${prefix}${i}`,
    role: s[0],
    position: s[1],
    overall: Math.round(74 + (rand() - 0.5) * 32),
    slotX: s[2],
    slotY: s[3],
    ...(extra ? extra(i) : {}),
  }));
}

const groupOf = (role: SlotRole) =>
  role === 'GOL' ? 'GK' : ['ZAG', 'LE', 'LD'].includes(role) ? 'DEF' : ['PE', 'PD', 'SA', 'ATA'].includes(role) ? 'ATT' : 'MID';

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)));
};
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

interface Check {
  name: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
}

const checks: Check[] = [];
const range = (name: string, value: number, min: number, max: number, unit = '') =>
  checks.push({ name, value, min, max, unit });

// ---------------------------------------------------------------- 1. métricas por formação
function scenario(label: string, format: Format, slots: Layout, matches: number) {
  const rand = mulberry(777 + format);
  let goals = 0;
  let draws = 0;
  let shots = 0;
  let on = 0;
  let saves = 0;
  let passes = 0;
  let passOk = 0;
  let fouls = 0;
  let cards = 0;
  let pens = 0;
  let corners = 0;
  let dribbles = 0;
  let dribblesWon = 0;
  const ratings: number[] = [];
  const rows: { g: string; o: number; r: number }[] = [];
  const goalsBy: Record<string, number> = { ATT: 0, MID: 0, DEF: 0, GK: 0 };

  for (let m = 0; m < matches; m++) {
    const teams = { a: team('a', slots, rand), b: team('b', slots, rand) };
    const res = simulateMatch({ format, halfDurationSec: HALF, seed: m + 1, teams });
    goals += res.score.a + res.score.b;
    if (res.score.a === res.score.b) draws += 1;
    for (const e of res.events) {
      if (e.type === 'foul') fouls += 1;
      else if (e.type === 'card') cards += 1;
      else if (e.type === 'penalty') pens += 1;
      else if (e.type === 'corner') corners += 1;
    }
    for (const side of ['a', 'b'] as const) {
      for (const p of teams[side]) {
        const s = res.stats[p.id];
        const g = groupOf(p.role);
        shots += s.shotsOn + s.shotsOff;
        on += s.shotsOn;
        saves += s.saves;
        passes += s.passesOk + s.passesBad;
        passOk += s.passesOk;
        dribbles += s.dribbles;
        dribblesWon += s.dribblesWon;
        goalsBy[g] += s.goals;
        ratings.push(res.ratings[p.id]);
        rows.push({ g, o: p.overall, r: res.ratings[p.id] });
      }
    }
  }

  const per = (n: number) => n / matches;
  const tg = Object.values(goalsBy).reduce((x, y) => x + y, 0) || 1;
  const gm = (g: string, k: 'o' | 'r') => mean(rows.filter(x => x.g === g).map(x => x[k]));
  const inGroupCorr = corr(
    rows.map(x => x.o - gm(x.g, 'o')),
    rows.map(x => x.r - gm(x.g, 'r')),
  );
  const groupMeans = ['GK', 'DEF', 'MID', 'ATT']
    .map(g => rows.filter(x => x.g === g).map(x => x.r))
    .filter(xs => xs.length)
    .map(mean);

  const L = label;
  range(`${L} · gols por jogo`, per(goals), format === 11 ? 2.8 : 3, 7);
  range(`${L} · empates`, (draws / matches) * 100, 0, 35, '%');
  range(`${L} · chutes por jogo`, per(shots), 10, 28);
  range(`${L} · defesas / chutes no alvo`, saves / (on || 1), 0.35, 0.85);
  range(`${L} · passes certos`, (passOk / (passes || 1)) * 100, 70, 92, '%');
  range(`${L} · faltas por jogo`, per(fouls), 1, 7);
  range(`${L} · cartões por jogo`, per(cards), 0, 1.6);
  range(`${L} · pênaltis por jogo`, per(pens), 0, 0.3);
  range(`${L} · escanteios por jogo`, per(corners), 0.5, 3.2);
  range(`${L} · dribles certos`, (dribblesWon / (dribbles || 1)) * 100, 40, 70, '%');
  range(`${L} · nota média`, mean(ratings), 5.9, 6.3);
  range(`${L} · desvio das notas`, sd(ratings), 0.9, 1.6);
  range(`${L} · notas ≥ 9,5`, (ratings.filter(r => r >= 9.5).length / ratings.length) * 100, 0, 2.5, '%');
  range(`${L} · notas ≤ 3,5`, (ratings.filter(r => r <= 3.5).length / ratings.length) * 100, 0, 3.5, '%');
  range(`${L} · correlação overall × nota`, inGroupCorr, format === 11 ? 0.15 : 0.2, 1);
  range(`${L} · diferença entre funções (nota)`, Math.max(...groupMeans) - Math.min(...groupMeans), 0, 0.35);
  // Metas de distribuição de gols (o objetivo da fase 7: não deixar tudo com o atacante)
  const attShare = (goalsBy.ATT / tg) * 100;
  const attMax = label.includes('4-3-3') ? 85 : format === 11 ? 75 : format === 7 ? 60 : 100;
  range(`${L} · gols dos atacantes`, attShare, 0, attMax, '%');
  // Defensores marcam principalmente de bola parada (meta ≈ 5%)
  if (format === 11) range(`${L} · gols dos defensores`, (goalsBy.DEF / tg) * 100, 2.5, 9, '%');
}

// ---------------------------------------------------------------- 2. estilos táticos
function styleScenario() {
  const { format, slots } = LAYOUTS['11 · 4-4-2'];
  const n = QUICK ? 40 : 100;
  const rand = mulberry(31);
  const stats = (a: string, b: string) => {
    let sa = 0;
    let sb = 0;
    let pa = 0;
    let pb = 0;
    for (let m = 0; m < n; m++) {
      const r = simulateMatch({
        format,
        halfDurationSec: HALF,
        seed: m + 5,
        teams: { a: team('a', slots, rand), b: team('b', slots, rand) },
        styles: { a: STYLES[a], b: STYLES[b] },
      });
      for (const [id, s] of Object.entries(r.stats)) {
        if (id[0] === 'a') {
          sa += s.shotsOn + s.shotsOff;
          pa += s.passesOk + s.passesBad;
        } else {
          sb += s.shotsOn + s.shotsOff;
          pb += s.passesOk + s.passesBad;
        }
      }
    }
    return { sa: sa / n, sb: sb / n, pa: pa / n, pb: pb / n };
  };
  const ur = stats('ultra', 'retranca');
  range('estilo · Ultra-ofensivo chuta mais que Retranca (razão)', ur.sa / (ur.sb || 1), 1.2, 10, '×');
  range('estilo · Retranca troca mais passes que Ultra-ofensivo (razão)', ur.pb / (ur.pa || 1), 1.05, 10, '×');
}

// ---------------------------------------------------------------- 3. características
function traitScenario() {
  const { format, slots } = LAYOUTS['11 · 4-4-2'];
  const n = QUICK ? 60 : 140;
  const rand = mulberry(99);
  let goalsT = 0;
  let goalsP = 0;
  let strikerShotsT = 0;
  let strikerShotsP = 0;
  let crossT = 0;
  let crossP = 0;
  let savesT = 0;
  let onT = 0;
  let savesP = 0;
  let onP = 0;
  const sum = (res: MatchResult, side: 'a' | 'b', key: 'crosses' | 'saves' | 'shotsOn') =>
    Object.entries(res.stats).reduce((acc, [id, st]) => (id[0] === side ? acc + st[key] : acc), 0);
  for (let m = 0; m < n; m++) {
    const base = { a: team('a', slots, rand), b: team('b', slots, rand) };
    const withTraits = base.a.map((p, i) => {
      const role = slots[i][0];
      if (role === 'ATA') return { ...p, trait: 'st-artilheiro' };
      if (role === 'LE' || role === 'LD') return { ...p, trait: 'fb-ofensivo' };
      if (role === 'ME' || role === 'MD') return { ...p, trait: 'w-cruzador' };
      if (role === 'GOL') return { ...p, trait: 'gk-paredao' };
      return p;
    });
    const r1 = simulateMatch({ format, halfDurationSec: HALF, seed: m + 1, teams: { a: withTraits, b: base.b } });
    const r2 = simulateMatch({ format, halfDurationSec: HALF, seed: m + 1, teams: base });
    goalsT += r1.score.a;
    goalsP += r2.score.a;
    for (const [i, slot] of slots.entries()) {
      if (slot[0] !== 'ATA') continue;
      strikerShotsT += r1.stats[`a${i}`].shotsOn + r1.stats[`a${i}`].shotsOff;
      strikerShotsP += r2.stats[`a${i}`].shotsOn + r2.stats[`a${i}`].shotsOff;
    }
    crossT += sum(r1, 'a', 'crosses');
    crossP += sum(r2, 'a', 'crosses');
    // goleiro de a defende os chutes de b
    savesT += sum(r1, 'a', 'saves');
    onT += sum(r1, 'b', 'shotsOn');
    savesP += sum(r2, 'a', 'saves');
    onP += sum(r2, 'b', 'shotsOn');
  }
  range('características · atacantes Artilheiro: chutes (razão vs Padrão)', (strikerShotsT || 1) / (strikerShotsP || 1), 1.15, 3, '×');
  range('características · atacantes Artilheiro: gols (razão vs Padrão)', (goalsT || 1) / (goalsP || 1), 1.0, 3, '×');
  range('características · laterais ofensivos + pontas cruzadores: cruzamentos (razão)', (crossT || 1) / (crossP || 1), 1.3, 5, '×');
  range('características · goleiro Paredão: defesas por chute no alvo (razão)', (savesT / (onT || 1)) / (savesP / (onP || 1) || 1), 1.0, 2, '×');
}

// ---------------------------------------------------------------- 4. robustez
function robustness() {
  const rand = mulberry(2024);
  const personalities = ['Líder', 'Veterano', 'Promessa', 'Temperamental', 'Vaidoso', 'Ambicioso', 'Reservado', 'Disciplinado', undefined];
  const styleKeys = Object.keys(STYLES);
  const layouts = Object.values(LAYOUTS);
  const runs = QUICK ? 30 : 90;
  let crashes = 0;
  let badRatings = 0;
  let unfinished = 0;
  let subs = 0;
  let reds = 0;

  for (let i = 0; i < runs; i++) {
    const lay = layouts[i % layouts.length];
    const mk = (prefix: string) =>
      team(prefix, lay.slots, rand, idx => {
        const traits = TRAITS.filter(t => t.positions.includes(lay.slots[idx][1]));
        return {
          morale: Math.round(rand() * 100),
          fatigue: Math.round(rand() * 60),
          personality: personalities[Math.floor(rand() * personalities.length)],
          trait: rand() < 0.6 && traits.length ? traits[Math.floor(rand() * traits.length)].key : undefined,
          fit: rand() < 0.2 ? 0.5 : 1,
        };
      });
    try {
      const w = createWorld({
        format: lay.format,
        halfDurationSec: 60,
        seed: i + 1,
        teams: { a: mk('a'), b: mk('b') },
        styles: {
          a: STYLES[styleKeys[Math.floor(rand() * styleKeys.length)]],
          b: STYLES[styleKeys[Math.floor(rand() * styleKeys.length)]],
        },
      });
      let guard = 0;
      while (w.phase !== 'ft' && guard++ < 40000) {
        stepWorld(w);
        // substituições aleatórias durante o jogo
        if (guard % 600 === 0 && rand() < 0.5) {
          const out = w.agents[Math.floor(rand() * w.agents.length)];
          const ok = substitute(w, out.id, {
            id: `sub${i}-${guard}`,
            position: out.input.position,
            overall: 70,
            role: out.role,
            slotX: 0,
            slotY: 0,
          });
          if (ok) subs += 1;
        }
      }
      if (w.phase !== 'ft') unfinished += 1;
      reds += w.subbedOut.filter(a => a.sentOff).length;
      const res: MatchResult = buildResult(w);
      for (const r of Object.values(res.ratings)) if (!Number.isFinite(r) || r < 3 || r > 10) badRatings += 1;
      for (const a of w.agents) if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) badRatings += 1;
    } catch (e) {
      crashes += 1;
      console.log('  erro na partida', i, e);
    }
  }
  range(`robustez · partidas com erro (de ${runs}, ${subs} substituições, ${reds} expulsões)`, crashes, 0, 0);
  range('robustez · partidas que não terminaram', unfinished, 0, 0);
  range('robustez · notas/posições inválidas', badRatings, 0, 0);
}

// ---------------------------------------------------------------- 4b. efeitos na carreira (fase 8)
function effectsScenario() {
  const { format, slots } = LAYOUTS['11 · 4-4-2'];
  const n = QUICK ? 60 : 200;
  const rand = mulberry(8080);
  let sessions = 0;
  let injuries = 0;
  let topDelta = 0;
  let topN = 0;
  let bottomDelta = 0;
  let bottomN = 0;
  let allDelta = 0;
  let allN = 0;
  let revertErrors = 0;
  let injuredWhileUnavailable = 0;
  let longInjuries = 0;
  let newsTotal = 0;
  let newsClosed = 0;
  let newsBadIds = 0;
  let bestOpen = 0;
  let bestClosed = 0;
  let bestN = 0;

  for (let m = 0; m < n; m++) {
    const teams = { a: team('a', slots, rand), b: team('b', slots, rand) };
    const res = simulateMatch({ format, halfDurationSec: HALF, seed: m + 1, teams });
    const ids = [...teams.a, ...teams.b].map(p => p.id);
    const squad = ids.map(
      (id, i) =>
        ({
          id,
          morale: 30 + Math.round(rand() * 65),
          fatigue: Math.round(rand() * 50),
          // alguns já lesionados: não podem se lesionar de novo
          availability: i % 17 === 0 ? 'lesionado' : 'disponivel',
          injuryDaysRemaining: i % 17 === 0 ? 9 : undefined,
        }) as unknown as Player,
    );
    const base: TrainingSession = {
      id: 't',
      date: '2027-01-05',
      season: 2027,
      open: false,
      mode: 'cpu-cpu',
      format,
      halfDurationSec: HALF,
      teams: {
        a: { name: 'Time A', kit: '#fff', formationKey: 'x', lineup: teams.a.map((p, slot) => ({ slot, playerId: p.id })) },
        b: { name: 'Time B', kit: '#000', formationKey: 'x', lineup: teams.b.map((p, slot) => ({ slot, playerId: p.id })) },
      } as TrainingSession['teams'],
      score: res.score,
      playerStats: Object.fromEntries(ids.map(id => [id, { goals: 0, assists: 0, foulsWon: res.stats[id].foulsWon }])),
      ratings: res.ratings,
      shares: res.shares,
      moraleDelta: {},
      injuries: [],
      mvpId: res.mvpId,
    };
    const session = applyTrainingEffects(base, squad, rand);
    sessions += 1;
    injuries += session.injuries.length;
    for (const inj of session.injuries) {
      const p = squad.find(x => x.id === inj.playerId)!;
      if (p.availability === 'lesionado') injuredWhileUnavailable += 1;
      if (inj.days < 3 || inj.days > 10) longInjuries += 1;
    }
    const sorted = [...ids].sort((x, y) => res.ratings[y] - res.ratings[x]);
    for (const id of sorted.slice(0, 3)) {
      topDelta += session.moraleDelta[id] ?? 0;
      topN += 1;
    }
    for (const id of sorted.slice(-3)) {
      bottomDelta += session.moraleDelta[id] ?? 0;
      bottomN += 1;
    }
    for (const id of ids) {
      allDelta += session.moraleDelta[id] ?? 0;
      allN += 1;
    }
    // treino aberto: notícias no Pulse e moral amplificada para os destacados
    const open = applyTrainingEffects({ ...base, open: true }, squad, rand);
    const news = buildTrainingPulse(open, id => 'Jogador ' + id);
    newsTotal += news.length;
    if (new Set(news.map(x => x.id)).size !== news.length || news.some(x => !x.titulo || !x.descricao)) newsBadIds += 1;
    newsClosed += buildTrainingPulse(session, id => id).length;
    for (const id of open.highlights?.best ?? []) {
      bestOpen += open.moraleDelta[id] ?? 0;
      bestClosed += session.moraleDelta[id] ?? 0;
      bestN += 1;
    }
    // aplicar e desfazer devolve o elenco ao estado original
    const applied = applyTrainingToPlayers(squad, session);
    const reverted = revertTrainingOnPlayers(applied, session);
    for (let i = 0; i < squad.length; i++) {
      const a = squad[i];
      const b = reverted[i];
      if (a.morale !== b.morale || a.availability !== b.availability || a.injuryDaysRemaining !== b.injuryDaysRemaining) revertErrors += 1;
    }
  }
  range('efeitos · lesões por treino (11x11)', injuries / sessions, 0.03, 0.35);
  range('efeitos · moral média dos 3 melhores (pontos)', topDelta / topN, 0.8, 6);
  range('efeitos · moral média dos 3 piores (pontos)', bottomDelta / bottomN, -6, -0.8);
  range('efeitos · moral média do elenco (neutra)', allDelta / allN, -1, 1);
  range('efeitos · lesão em atleta que já estava indisponível', injuredWhileUnavailable, 0, 0);
  range('efeitos · lesões fora de 3–10 dias', longInjuries, 0, 0);
  range('pulse · notícias por treino aberto', newsTotal / sessions, 1.2, 5);
  range('pulse · notícias em treino fechado', newsClosed, 0, 0);
  range('pulse · notícias com id repetido ou vazias', newsBadIds, 0, 0);
  range('pulse · destaque do treino aberto ganha mais moral que no fechado (pontos)', bestN ? (bestOpen - bestClosed) / bestN : 1, 0.5, 5);
  range('efeitos · "Voltar dia" desfaz moral e lesões (divergências)', revertErrors, 0, 0);
}

// ---------------------------------------------------------------- 4c. subposições e anel da escalação
function positionsScenario() {
  type Case = [PlayerPosition, PlayerPosition[], SlotRole, 'exact' | 'sector' | 'off'];
  const cases: Case[] = [
    ['ST', [], 'ATA', 'exact'],
    ['CF', [], 'ATA', 'sector'], // mesmo setor, não exata → laranja
    ['LW', [], 'ATA', 'sector'],
    ['CM', [], 'ATA', 'off'], // outro setor → vermelho
    ['CM', ['ST'], 'ATA', 'exact'], // subposição: não perde nada
    ['CM', ['CAM'], 'MEI', 'exact'],
    ['CM', ['CAM'], 'ATA', 'off'],
    ['CB', [], 'LE', 'sector'],
    ['LB', [], 'ZAG', 'sector'],
    ['CDM', [], 'MC', 'sector'],
    ['CB', ['LB'], 'LE', 'exact'],
    ['GK', [], 'ZAG', 'off'],
    ['ST', ['GK'], 'GOL', 'exact'],
    ['LW', [], 'PE', 'exact'],
    ['RW', [], 'PE', 'sector'],
    ['CAM', [], 'ME', 'sector'],
    ['CM', ['LM'], 'ME', 'exact'],
    ['ST', ['RWB'], 'ALD', 'exact'],
    ['LW', [], 'ME', 'off'],
  ];
  let wrong = 0;
  for (const [position, altPositions, role, expected] of cases) {
    if (positionMatch({ position, altPositions }, role) !== expected) wrong += 1;
  }
  const ringOk =
    ringOf({ position: 'ST' }, 'ATA') === undefined &&
    ringOf({ position: 'CF' }, 'ATA') === 'sector' &&
    ringOf({ position: 'CM' }, 'ATA') === 'off';
  range(`posições · casos de encaixe incorretos (de ${cases.length})`, wrong, 0, 0);
  range('posições · anel (nenhum / laranja / vermelho) correto', ringOk ? 1 : 0, 1, 1);
}

// ---------------------------------------------------------------- 5. determinismo
function determinism() {
  const { format, slots } = LAYOUTS['11 · 4-4-2'];
  const rand = mulberry(5);
  const teams = { a: team('a', slots, rand), b: team('b', slots, rand) };
  const a = JSON.stringify(simulateMatch({ format, halfDurationSec: 60, seed: 123, teams }));
  const b = JSON.stringify(simulateMatch({ format, halfDurationSec: 60, seed: 123, teams }));
  const c = JSON.stringify(simulateMatch({ format, halfDurationSec: 60, seed: 124, teams }));
  range('determinismo · mesma seed = mesma partida', a === b ? 1 : 0, 1, 1);
  range('determinismo · seeds diferentes = partidas diferentes', a !== c ? 1 : 0, 1, 1);
}

// ---------------------------------------------------------------- 6. pênaltis
function shootouts() {
  const { format, slots } = LAYOUTS['11 · 4-4-2'];
  const rand = mulberry(77);
  let bad = 0;
  let gkTakers = 0;
  let unordered = 0;
  const N = QUICK ? 30 : 100;
  for (let i = 0; i < N; i++) {
    const w = createWorld({
      format,
      halfDurationSec: 20,
      seed: 900 + i,
      teams: { a: team('a', slots, rand), b: team('b', slots, rand) },
    });
    for (let k = 0; k < 40000 && w.phase !== 'ft'; k++) stepWorld(w);
    const ratings = computeRatings(w);
    const r = runShootout(w, ratings, 900 + i);
    const regular = r.kicks.filter(k => !k.sudden);
    // intercalado (a, b, a, b…) e no máximo 5 por time na fase regular
    const alternates = r.kicks.every((k, idx) => k.team === (idx % 2 === 0 ? 'a' : 'b'));
    const perTeam = (t: 'a' | 'b') => regular.filter(k => k.team === t).length;
    const winnerOk = r.score.a !== r.score.b && (r.score.a > r.score.b ? 'a' : 'b') === r.winner;
    if (!alternates || perTeam('a') > 5 || perTeam('b') > 5 || !winnerOk) bad += 1;
    gkTakers += r.kicks.filter(k => w.agents.find(a => a.id === k.playerId)?.group === 'GK').length;
    // cada time cobra em ordem decrescente de nota nas 5 primeiras
    for (const t of ['a', 'b'] as const) {
      const rs = regular.filter(k => k.team === t).map(k => k.rating);
      if (rs.some((x, idx) => idx > 0 && x > rs[idx - 1] + 1e-9)) unordered += 1;
    }
  }
  range('pênaltis · decisões inválidas (alternância/vencedor/limite de 5)', bad, 0, 0);
  range('pênaltis · goleiro cobrando', gkTakers, 0, 0);
  range('pênaltis · cobradores fora da ordem de nota', unordered, 0, 0);
}

// ---------------------------------------------------------------- execução
const t0 = Date.now();
const counts: Record<string, number> = QUICK ? { '5': 60, '7': 60, '11': 40 } : { '5': 200, '7': 200, '11': 120 };
for (const [label, lay] of Object.entries(LAYOUTS)) {
  process.stdout.write(`simulando ${label}… `);
  scenario(label, lay.format, lay.slots, counts[String(lay.format)]);
  console.log('ok');
}
styleScenario();
traitScenario();
shootouts();
robustness();
effectsScenario();
positionsScenario();
determinism();

let failed = 0;
const f = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2));
console.log('');
for (const c of checks) {
  const ok = c.value >= c.min && c.value <= c.max;
  if (!ok) failed += 1;
  const bounds = `[${f(c.min)} – ${c.max >= 1e6 ? '∞' : f(c.max)}]`;
  console.log(`${ok ? 'OK  ' : 'FALHA'}  ${c.name.padEnd(70)} ${f(c.value).padStart(7)}${c.unit ?? ''}  ${bounds}`);
}
console.log(`\n${checks.length - failed}/${checks.length} verificações dentro da meta · ${((Date.now() - t0) / 1000).toFixed(0)} s${QUICK ? ' (modo rápido)' : ''}`);
process.exit(failed ? 1 : 0);
