import type { Player } from '../types/Player';
import type { TrainingSession } from '../types/Training';

/**
 * Efeitos do treino na carreira (Fase 8): moral pela nota e lesões raras.
 * Funções puras — o sorteio recebe um gerador, e o resultado fica gravado na sessão
 * (`moraleDelta`, `injuries`) para o "Voltar dia" conseguir desfazer tudo.
 */

/** Variação de moral pela nota: bom treino sobe, mau treino desce. */
export function trainingMoraleDelta(rating: number): number {
  if (rating >= 8.5) return 4;
  if (rating >= 7.5) return 2;
  if (rating >= 6.5) return 1;
  if (rating >= 5.5) return 0;
  if (rating >= 4.5) return -2;
  return -4;
}

/** Chance base de lesão por jogador numa partida inteira de treino (11x11). */
const INJURY_BASE = 0.007;
const FORMAT_INJURY_MUL = { 5: 0.7, 7: 0.85, 11: 1 } as const;
const MORALE_MIN = 0;
const MORALE_MAX = 100;

const clampMorale = (n: number) => Math.max(MORALE_MIN, Math.min(MORALE_MAX, n));

/** Lesão de treino é leve: 3 a 10 dias. */
function rollTrainingInjuryDays(rng: () => number): number {
  return 3 + Math.floor(rng() * 8);
}

function isUnavailable(p: Player): boolean {
  const a = p.availability ?? 'disponivel';
  return a === 'lesionado' || a === 'indisponivel';
}

/**
 * Calcula moral e lesões de um treino já jogado. Devolve a sessão com `moraleDelta` e `injuries`
 * preenchidos; nada é aplicado aos jogadores ainda (ver `applyTrainingToPlayers`).
 */
export function applyTrainingEffects(
  session: TrainingSession,
  players: Player[],
  rng: () => number = Math.random,
): TrainingSession {
  if (session.placeholder) return session;
  const byId = new Map(players.map(p => [p.id, p]));
  const ids = Object.keys(session.ratings).filter(id => byId.has(id));
  if (!ids.length) return session;

  let worst: string | null = null;
  for (const id of ids) {
    if (worst === null || session.ratings[id] < session.ratings[worst]) worst = id;
  }

  // Treino aberto: a imprensa destaca os 2 melhores (nota ≥ 7,5) e os 2 piores (nota ≤ 5,2)
  const ranked = [...ids].sort((x, y) => session.ratings[y] - session.ratings[x]);
  const bestIds = session.open ? ranked.filter(id => session.ratings[id] >= 7.5).slice(0, 2) : [];
  const worstIds = session.open
    ? [...ranked].reverse().filter(id => session.ratings[id] <= 5.2 && !bestIds.includes(id)).slice(0, 2)
    : [];

  const moraleDelta: Record<string, number> = {};
  const injuries: TrainingSession['injuries'] = [];
  const fmtMul = FORMAT_INJURY_MUL[session.format];

  for (const id of ids) {
    const p = byId.get(id)!;
    const share = session.shares?.[id] ?? 1;

    // Moral: nota + destaque (melhor/pior). Quem jogou pouco sente metade.
    let delta = trainingMoraleDelta(session.ratings[id]);
    if (id === session.mvpId) delta += 1;
    if (id === worst && ids.length > 1) delta -= 1;
    if (share < 0.3) delta = Math.trunc(delta / 2);
    // Exposição pública: elogio e crítica pesam 50% a mais (no mínimo 1 ponto)
    if (bestIds.includes(id) || worstIds.includes(id)) {
      delta += (bestIds.includes(id) ? 1 : -1) * Math.max(1, Math.round(Math.abs(delta) * 0.5));
    }
    const next = clampMorale((p.morale ?? 70) + delta);
    const applied = next - (p.morale ?? 70);
    if (applied !== 0) moraleDelta[id] = applied;

    // Lesão: rara; cansaço, minutos e faltas sofridas aumentam o risco
    if (isUnavailable(p)) continue;
    const fatigue = Math.max(0, Math.min(100, p.fatigue ?? 0));
    const fouled = session.playerStats[id]?.foulsWon ?? 0;
    const chance = INJURY_BASE * fmtMul * share * (0.7 + (0.8 * fatigue) / 100) * (1 + 0.15 * fouled);
    if (rng() < chance) {
      injuries.push({
        playerId: id,
        days: rollTrainingInjuryDays(rng),
        prevAvailability: p.availability ?? 'disponivel',
        prevDays: p.injuryDaysRemaining,
      });
    }
  }

  return { ...session, moraleDelta, injuries, highlights: session.open ? { best: bestIds, worst: worstIds } : undefined };
}

/** Aplica ao elenco o que a sessão gravou (moral e lesões). */
export function applyTrainingToPlayers(players: Player[], session: TrainingSession): Player[] {
  if (session.placeholder) return players;
  const injured = new Map(session.injuries.map(i => [i.playerId, i]));
  return players.map(p => {
    const delta = session.moraleDelta[p.id];
    const injury = injured.get(p.id);
    if (delta === undefined && !injury) return p;
    let next = p;
    if (delta !== undefined) next = { ...next, morale: clampMorale((next.morale ?? 70) + delta) };
    if (injury) {
      next = {
        ...next,
        availability: 'lesionado',
        injuryDaysRemaining: injury.days,
        suspensionMatchesRemaining: undefined,
        suspensionCompetition: undefined,
      };
    }
    return next;
  });
}

/** Desfaz `applyTrainingToPlayers` (usado no "Voltar dia"). */
export function revertTrainingOnPlayers(players: Player[], session: TrainingSession): Player[] {
  if (session.placeholder) return players;
  const injured = new Map(session.injuries.map(i => [i.playerId, i]));
  return players.map(p => {
    const delta = session.moraleDelta[p.id];
    const injury = injured.get(p.id);
    if (delta === undefined && !injury) return p;
    let next = p;
    if (delta !== undefined) next = { ...next, morale: clampMorale((next.morale ?? 70) - delta) };
    // só desfaz a lesão se ela ainda é a do treino (o atleta continua lesionado com os mesmos dias)
    if (injury && next.availability === 'lesionado' && next.injuryDaysRemaining === injury.days) {
      next = {
        ...next,
        availability: injury.prevAvailability ?? 'disponivel',
        injuryDaysRemaining: injury.prevDays,
      };
    }
    return next;
  });
}
