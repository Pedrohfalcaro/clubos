import type { MatchResult } from '../types/Match';
import type {
  PlayerPressConferenceDeltas,
  PlayerPressConferenceResult,
  PlayerPressContext,
  PlayerPressOptionEffects,
  PlayerPressQuestion,
  PlayerPressQuestionTags,
  PlayerPressSituation,
} from '../types/PlayerPressConference';
import { PLAYER_PRESS_QUESTIONS } from './playerQuestions';

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function buildPlayerPressSituation(input: {
  context: PlayerPressContext;
  result?: MatchResult | null;
  goals?: number;
  assists?: number;
  rating?: number | null;
  wasStarter?: boolean;
  wasBenched?: boolean;
  opponent?: string;
  morale?: number;
  coachConfidence?: number;
  fanReputation?: number;
}): PlayerPressSituation {
  return {
    context: input.context,
    result: input.result ?? null,
    goals: input.goals ?? 0,
    assists: input.assists ?? 0,
    rating: input.rating ?? null,
    wasStarter: input.wasStarter ?? true,
    wasBenched: input.wasBenched ?? false,
    opponent: input.opponent,
    morale: input.morale ?? 70,
    coachConfidence: input.coachConfidence ?? 50,
    fanReputation: input.fanReputation ?? 50,
  };
}

function tagsMatch(tags: PlayerPressQuestionTags | undefined, s: PlayerPressSituation): boolean {
  if (!tags) return true;
  if (tags.results?.length) {
    if (!s.result || !tags.results.includes(s.result)) return false;
  }
  if (tags.scoredGoal && !(s.goals && s.goals > 0)) return false;
  if (tags.poorRating && !(s.rating != null && s.rating < 6)) return false;
  if (tags.greatRating && !(s.rating != null && s.rating >= 8)) return false;
  if (tags.benched && !s.wasBenched) return false;
  if (tags.moraleMax != null && (s.morale ?? 70) > tags.moraleMax) return false;
  if (tags.moraleMin != null && (s.morale ?? 70) < tags.moraleMin) return false;
  if (tags.coachMax != null && (s.coachConfidence ?? 50) > tags.coachMax) return false;
  if (tags.coachMin != null && (s.coachConfidence ?? 50) < tags.coachMin) return false;
  if (tags.fanMax != null && (s.fanReputation ?? 50) > tags.fanMax) return false;
  if (tags.fanMin != null && (s.fanReputation ?? 50) < tags.fanMin) return false;
  return true;
}

function contextOk(q: PlayerPressQuestion, ctx: PlayerPressContext): boolean {
  return q.context === ctx || q.context === 'both';
}

function weightedPick(pool: PlayerPressQuestion[], rng: () => number): PlayerPressQuestion {
  const total = pool.reduce((s, q) => s + (q.weight ?? 1), 0);
  let r = rng() * total;
  for (const q of pool) {
    r -= q.weight ?? 1;
    if (r <= 0) return q;
  }
  return pool[pool.length - 1];
}

export function pickPlayerPressQuestions(
  situation: PlayerPressSituation,
  count = 3,
  rng: () => number = Math.random,
): PlayerPressQuestion[] {
  const eligible = PLAYER_PRESS_QUESTIONS.filter(
    q => contextOk(q, situation.context) && tagsMatch(q.tags, situation),
  );
  const tagged = eligible.filter(q => q.tags && Object.keys(q.tags).length > 0);
  const general = eligible.filter(q => !q.tags || Object.keys(q.tags).length === 0);

  const picked: PlayerPressQuestion[] = [];
  const used = new Set<string>();

  const takeFrom = (pool: PlayerPressQuestion[], n: number) => {
    const available = [...pool.filter(q => !used.has(q.id))];
    for (let i = 0; i < n && available.length; i++) {
      const q = weightedPick(available, rng);
      used.add(q.id);
      picked.push(q);
      const idx = available.findIndex(x => x.id === q.id);
      if (idx >= 0) available.splice(idx, 1);
    }
  };

  takeFrom(tagged, Math.min(2, count));
  takeFrom(general, count - picked.length);
  if (picked.length < count) takeFrom(eligible, count - picked.length);

  return picked;
}

function normalizeEffects(effects: PlayerPressOptionEffects): PlayerPressConferenceDeltas {
  return {
    coachConfidence: effects.coachConfidence ?? 0,
    fanReputation: effects.fanReputation ?? 0,
    morale: effects.morale ?? 0,
  };
}

export function runPlayerPressConference(input: {
  context: PlayerPressContext;
  questions: PlayerPressQuestion[];
  answers: string[];
  playerName: string;
  opponent?: string;
}): PlayerPressConferenceResult {
  const deltas: PlayerPressConferenceDeltas = { coachConfidence: 0, fanReputation: 0, morale: 0 };
  const summary: string[] = [];

  input.questions.forEach((q, i) => {
    const optId = input.answers[i];
    const opt = q.options.find(o => o.id === optId);
    if (!opt) return;
    const e = normalizeEffects(opt.effects);
    deltas.coachConfidence = clamp(deltas.coachConfidence + e.coachConfidence, -20, 20);
    deltas.fanReputation = clamp(deltas.fanReputation + e.fanReputation, -20, 20);
    deltas.morale = clamp(deltas.morale + e.morale, -20, 20);
    if (opt.headlineHint) summary.push(opt.headlineHint);
  });

  const hint = summary[0] ?? 'falou com a imprensa';
  const faseLabel = input.context === 'pre_match' ? 'pré-jogo' : 'pós-jogo';
  const vs = input.opponent ? ` vs ${input.opponent}` : '';
  const headline = `${input.playerName}: ${hint} (${faseLabel}${vs})`;

  return { deltas, headline, summary };
}
