import type { Match, MatchResult, Player } from '../types';
import type { TransferRecord } from '../types/Transfer';
import type {
  PressConferenceDeltas,
  PressConferenceResult,
  PressContext,
  PressOptionEffects,
  PressPlayerMoraleDelta,
  PressQuestion,
  PressQuestionTags,
  PressSituation,
} from '../types/PressConference';
import { PRESS_QUESTIONS } from './questions';

const RECENT_SIGNING_TYPES = new Set(['buy', 'loan_in', 'free']);
const RECENT_SIGNING_WINDOW_DAYS = 14;

/** Dias decorridos (0 = mesmo dia). */
function calendarDaysAgo(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso.slice(0, 10)}T12:00:00`);
  const b = new Date(`${toIso.slice(0, 10)}T12:00:00`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

/** Reforço (compra / empréstimo in / livre) nos últimos dias. */
export function findRecentSigning(input: {
  history: TransferRecord[];
  players: Player[];
  currentDate?: string | null;
  windowDays?: number;
}): { id: string; name: string; daysAgo: number } | null {
  const today = (input.currentDate ?? new Date().toISOString()).slice(0, 10);
  const window = input.windowDays ?? RECENT_SIGNING_WINDOW_DAYS;
  const candidates = input.history
    .filter(r => RECENT_SIGNING_TYPES.has(r.type))
    .map(r => {
      const daysAgo = calendarDaysAgo(r.date, today);
      const id =
        r.squadPlayerId ??
        input.players.find(p => p.name === r.playerSnapshot.name)?.id ??
        '';
      return { id, name: r.playerSnapshot.name, daysAgo, date: r.date };
    })
    .filter(c => c.daysAgo <= window && c.id);

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.daysAgo - b.daysAgo || b.date.localeCompare(a.date));
  const top = candidates[0];
  return { id: top.id, name: top.name, daysAgo: top.daysAgo };
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * Mídia: sobe pouco, cai mais.
 * Com atrito alto (pressFriction), ganhos positivos quase somem — difícil reconquistar.
 */
export function scaleMediaDelta(
  raw: number | undefined,
  pressFriction = 0,
): number {
  if (raw == null || raw === 0) return 0;
  if (raw > 0) {
    const base = Math.max(1, Math.round(raw * 0.45));
    const friction = clamp(pressFriction, 0, 100);
    // friction 0 → 100% do ganho; friction 100 → ~20%
    const factor = 1 - (friction / 100) * 0.8;
    return Math.max(0, Math.round(base * factor));
  }
  // Negativos: atrito piora um pouco a queda
  const extra = 1 + (clamp(pressFriction, 0, 100) / 100) * 0.25;
  return Math.round(raw * 1.35 * extra);
}

export function normalizeEffects(
  effects: PressOptionEffects,
  pressFriction = 0,
): PressConferenceDeltas {
  return {
    boardConfidence: effects.boardConfidence ?? 0,
    supporterConfidence: effects.supporterConfidence ?? 0,
    squadMorale: effects.squadMorale ?? 0,
    mediaConfidence: scaleMediaDelta(effects.mediaConfidence, pressFriction),
  };
}

/** Ajuste de atrito após a sessão. */
export function nextPressFriction(
  current: number | undefined,
  aggressiveCount: number,
): number {
  let f = clamp(current ?? 0, 0, 100);
  if (aggressiveCount > 0) {
    f = clamp(f + aggressiveCount * 14, 0, 100);
  } else {
    // sessão calma: recuperação lenta
    f = clamp(f - 3, 0, 100);
  }
  return f;
}

export function isAggressiveOption(opt: { aggressive?: boolean; effects: PressOptionEffects }): boolean {
  if (opt.aggressive) return true;
  return (opt.effects.mediaConfidence ?? 0) <= -3;
}

function goalCounts(match: Match | null | undefined): Map<string, { name: string; n: number }> {
  const map = new Map<string, { name: string; n: number }>();
  for (const g of match?.goals ?? []) {
    if (g.isOwnGoal || !g.playerId) continue;
    const cur = map.get(g.playerId) ?? { name: g.playerName, n: 0 };
    cur.n += 1;
    map.set(g.playerId, cur);
  }
  return map;
}

function findHatTrick(match: Match | null | undefined): string | null {
  for (const { name, n } of goalCounts(match).values()) {
    if (n >= 3) return name;
  }
  return null;
}

function findFormDryAttacker(players: Player[]): string | null {
  const dry = players
    .filter(p => {
      if (p.status === 'Aposentado') return false;
      const pos = String(p.position ?? '');
      const isAtk = ['ATA', 'ST', 'CF', 'PE', 'PD', 'LW', 'RW', 'SS'].some(
        x => pos === x || pos.includes(x),
      );
      if (!isAtk) return false;
      const matches = p.stats?.matches ?? 0;
      const goals = p.stats?.goals ?? 0;
      return matches >= 6 && goals <= 1;
    })
    .sort((a, b) => (a.morale ?? 50) - (b.morale ?? 50))[0];
  return dry?.name ?? null;
}

function avgMorale(players: Player[]): number {
  const active = players.filter(p => p.status !== 'Aposentado');
  if (!active.length) return 50;
  return active.reduce((s, p) => s + (p.morale ?? 70), 0) / active.length;
}

export function buildPressSituation(input: {
  context: PressContext;
  match?: Match | null;
  players?: Player[];
  recentResults?: MatchResult[];
  boardConfidence?: number;
  supporterConfidence?: number;
  mediaConfidence?: number;
  transferHistory?: TransferRecord[];
  currentDate?: string | null;
  injuredPlayerId?: string | null;
  balance?: number | null;
  wageBill?: number | null;
  pressFriction?: number;
}): PressSituation {
  const match = input.match ?? null;
  const gf = match?.goalsFor ?? 0;
  const ga = match?.goalsAgainst ?? 0;
  const result = match?.result ?? null;
  const recent = input.recentResults ?? [];
  const signing = findRecentSigning({
    history: input.transferHistory ?? [],
    players: input.players ?? [],
    currentDate: input.currentDate,
  });
  const injured =
    input.injuredPlayerId
      ? (input.players ?? []).find(p => p.id === input.injuredPlayerId) ?? null
      : null;

  return {
    context: input.context,
    result,
    location: match?.location,
    significance: match?.significance ?? 'normal',
    goalsFor: gf,
    goalsAgainst: ga,
    margin: Math.abs(gf - ga),
    cleanSheet: ga === 0 && result === 'win',
    hatTrickName: findHatTrick(match),
    redCards: (match?.cards ?? []).filter(c => c.type === 'red').length,
    avgSquadMorale: avgMorale(input.players ?? []),
    formDryAttacker: findFormDryAttacker(input.players ?? []),
    recentLosses: recent.slice(0, 5).filter(r => r === 'loss').length,
    recentWins: recent.slice(0, 5).filter(r => r === 'win').length,
    opponent: match?.opponent,
    boardConfidence: input.boardConfidence ?? 50,
    supporterConfidence: input.supporterConfidence ?? 50,
    mediaConfidence: input.mediaConfidence ?? 50,
    recentSigningName: signing?.name ?? null,
    recentSigningId: signing?.id ?? null,
    recentSigningDaysAgo: signing?.daysAgo ?? null,
    injuredPlayerName: injured?.name ?? null,
    injuredPlayerId: injured?.id ?? null,
    injuryDaysRemaining: injured?.injuryDaysRemaining ?? null,
    balance: input.balance ?? null,
    wageBill: input.wageBill ?? null,
    pressFriction: input.pressFriction ?? 0,
  };
}

function tagsMatch(tags: PressQuestionTags | undefined, s: PressSituation): boolean {
  if (!tags) return true;
  if (tags.results?.length) {
    if (!s.result || !tags.results.includes(s.result)) return false;
  }
  if (tags.locations?.length) {
    if (!s.location || !tags.locations.includes(s.location)) return false;
  }
  if (tags.significance?.length) {
    const sig = s.significance ?? 'normal';
    if (!tags.significance.includes(sig)) return false;
  }
  if (tags.minMargin != null && (s.margin ?? 0) < tags.minMargin) return false;
  if (tags.maxMargin != null && (s.margin ?? 0) > tags.maxMargin) return false;
  if (tags.cleanSheet && !s.cleanSheet) return false;
  if (tags.requiresHatTrick && !s.hatTrickName) return false;
  if (tags.requiresRedCard && !(s.redCards && s.redCards > 0)) return false;
  if (tags.requiresFormDry && !s.formDryAttacker) return false;
  if (tags.requiresRecentSigning && !s.recentSigningName) return false;
  if (tags.avgMoraleMax != null && (s.avgSquadMorale ?? 50) > tags.avgMoraleMax) return false;
  if (tags.avgMoraleMin != null && (s.avgSquadMorale ?? 50) < tags.avgMoraleMin) return false;
  if (tags.boardMax != null && (s.boardConfidence ?? 50) > tags.boardMax) return false;
  if (tags.boardMin != null && (s.boardConfidence ?? 50) < tags.boardMin) return false;
  if (tags.supporterMax != null && (s.supporterConfidence ?? 50) > tags.supporterMax) return false;
  if (tags.supporterMin != null && (s.supporterConfidence ?? 50) < tags.supporterMin) return false;
  if (tags.mediaMax != null && (s.mediaConfidence ?? 50) > tags.mediaMax) return false;
  if (tags.mediaMin != null && (s.mediaConfidence ?? 50) < tags.mediaMin) return false;
  if (tags.recentLossesMin != null && (s.recentLosses ?? 0) < tags.recentLossesMin) return false;
  if (tags.recentWinsMin != null && (s.recentWins ?? 0) < tags.recentWinsMin) return false;
  return true;
}

function contextOk(q: PressQuestion, ctx: PressContext): boolean {
  if (q.context === ctx) return true;
  if (q.context === 'both' && (ctx === 'pre_match' || ctx === 'post_match')) return true;
  return false;
}

function weightedPick(pool: PressQuestion[], rng: () => number): PressQuestion {
  const total = pool.reduce((s, q) => s + (q.weight ?? 1), 0);
  let r = rng() * total;
  for (const q of pool) {
    r -= q.weight ?? 1;
    if (r <= 0) return q;
  }
  return pool[pool.length - 1];
}

function personalizePrompt(prompt: string, s: PressSituation): string {
  let out = prompt;
  if (s.formDryAttacker) {
    out = out.replace(/o artilheiro em jejum|atacante em jejum/gi, s.formDryAttacker);
  }
  if (s.hatTrickName) {
    out = out.replace(/seu jogador/gi, s.hatTrickName);
  }
  if (s.opponent) {
    out = out.replace(/o adversário/gi, s.opponent);
  }
  if (s.recentSigningName) {
    out = out
      .replace(/o reforço recente|o novo reforço|o recém-contratado/gi, s.recentSigningName)
      .replace(/\{\{signing\}\}/g, s.recentSigningName);
  }
  if (s.injuredPlayerName) {
    out = out
      .replace(/o lesionado|o atleta lesionado|o jogador lesionado/gi, s.injuredPlayerName)
      .replace(/\{\{injured\}\}/g, s.injuredPlayerName);
  }
  return out;
}

/**
 * Sorteia perguntas priorizando cenários com tags (resultado, moral, mídia…).
 * API legada: pickPressQuestions(context, matchResult, count)
 * API rica: pickPressQuestions(situation, count?)
 */
export function pickPressQuestions(
  contextOrSituation: PressContext | PressSituation,
  matchResultOrCount?: MatchResult | null | number,
  countArg = 3,
  rng: () => number = Math.random,
): PressQuestion[] {
  let situation: PressSituation;
  let count: number;

  if (typeof contextOrSituation === 'string') {
    situation = {
      context: contextOrSituation,
      result: typeof matchResultOrCount === 'string' ? matchResultOrCount : null,
    };
    count = typeof matchResultOrCount === 'number' ? matchResultOrCount : countArg;
  } else {
    situation = contextOrSituation;
    count = typeof matchResultOrCount === 'number' ? matchResultOrCount : countArg;
  }

  const eligible = PRESS_QUESTIONS.filter(
    q => contextOk(q, situation.context) && tagsMatch(q.tags, situation),
  );
  const tagged = eligible.filter(q => q.tags && Object.keys(q.tags).length > 0);
  const general = eligible.filter(q => !q.tags || Object.keys(q.tags).length === 0);

  const picked: PressQuestion[] = [];
  const used = new Set<string>();

  const takeFrom = (pool: PressQuestion[], n: number) => {
    const available = [...pool.filter(q => !used.has(q.id))];
    for (let i = 0; i < n && available.length; i++) {
      const q = weightedPick(available, rng);
      used.add(q.id);
      picked.push({
        ...q,
        prompt: personalizePrompt(q.prompt, situation),
      });
      const idx = available.findIndex(x => x.id === q.id);
      if (idx >= 0) available.splice(idx, 1);
    }
  };

  takeFrom(tagged, Math.min(2, count));
  takeFrom(general, count - picked.length);
  if (picked.length < count) takeFrom(eligible, count - picked.length);

  return picked;
}

export function runPressConference(input: {
  context: PressContext;
  matchResult?: MatchResult | null;
  questions: PressQuestion[];
  answers: string[];
  teamName: string;
  opponent?: string;
  managerName?: string;
  recentSigningId?: string | null;
  recentSigningName?: string | null;
  injuredPlayerName?: string | null;
  pressFriction?: number;
}): PressConferenceResult {
  const deltas: PressConferenceDeltas = {
    supporterConfidence: 0,
    squadMorale: 0,
    boardConfidence: 0,
    mediaConfidence: 0,
  };
  const summary: string[] = [];
  const coach = input.managerName?.trim() || 'O técnico';
  const targetMorale = new Map<string, number>();
  const friction = input.pressFriction ?? 0;
  let aggressiveCount = 0;

  input.questions.forEach((q, i) => {
    const optId = input.answers[i];
    const opt = q.options.find(o => o.id === optId);
    if (!opt) return;
    if (isAggressiveOption(opt)) aggressiveCount += 1;
    const e = normalizeEffects(opt.effects, friction);
    deltas.supporterConfidence += e.supporterConfidence;
    deltas.squadMorale += e.squadMorale;
    deltas.boardConfidence += e.boardConfidence;
    deltas.mediaConfidence += e.mediaConfidence;
    const tDelta = opt.effects.targetPlayerMorale ?? 0;
    if (tDelta !== 0 && input.recentSigningId) {
      targetMorale.set(
        input.recentSigningId,
        (targetMorale.get(input.recentSigningId) ?? 0) + tDelta,
      );
    }
    if (opt.headlineHint) {
      let hint = opt.headlineHint;
      if (input.recentSigningName) {
        hint = hint.replace(/\{\{signing\}\}/g, input.recentSigningName);
      }
      if (input.injuredPlayerName) {
        hint = hint.replace(/\{\{injured\}\}/g, input.injuredPlayerName);
      }
      summary.push(hint);
    }
  });

  // Sessão: mídia difícil de agradar; atrito reduz o teto positivo
  const mediaCap = friction >= 60 ? 2 : friction >= 30 ? 3 : 4;
  deltas.mediaConfidence = clamp(deltas.mediaConfidence, -16, mediaCap);

  const hint = summary[0] ?? 'falou com a imprensa';
  const vs = input.opponent ? ` vs ${input.opponent}` : '';
  const faseLabel: Record<PressContext, string> = {
    pre_match: 'pré-jogo',
    post_match: 'pós-jogo',
    callup: 'convocação',
    injury: 'lesão',
    finance_crisis: 'crise financeira',
    story_arc: 'arco narrativo',
  };
  const fase = faseLabel[input.context] ?? input.context;
  const headline = `${coach}: ${hint}${vs ? ` (${fase}${vs})` : ` (${fase})`}`;

  const playerMorale: PressPlayerMoraleDelta[] = [...targetMorale.entries()].map(
    ([playerId, delta]) => ({ playerId, delta }),
  );

  return { deltas, headline, summary, playerMorale, aggressiveCount };
}
