import type {
  BoardGoal,
  BoardGoalKind,
  BoardGoalPriority,
  BoardGoalStatus,
  LeagueTier,
} from '../types/Board';
import { LEAGUE_TIER_LABELS } from '../types/Board';
import type { SeasonCompetition } from '../types/Competition';
import { KNOCKOUT_STAGE_RANK } from '../types/Competition';
import type { TransferRecord } from '../types/Transfer';

export interface GoalEvalContext {
  competitions: SeasonCompetition[];
  /** Transferências da temporada da meta (todas, para contar vendas/contratações). */
  transfersSeason: TransferRecord[];
  /** Soma gasta em contratações (`buy`) na temporada da meta. */
  spentOnTransfers: number;
  /** Folha salarial atual (soma dos salários do elenco ativo). */
  wageBill: number;
  /** Soma do saldo devedor de todas as dívidas ativas do clube. */
  debtRemaining: number;
  /** Caixa atual do clube. */
  balance: number;
}

/** Não-`active` — todos os desfechos possíveis de uma meta. */
export type GoalOutcomeStatus = Exclude<BoardGoalStatus, 'active'>;

export interface GoalEvalResult {
  current: number;
  status: GoalOutcomeStatus;
}

export interface GoalMoraleImpact {
  board: number;
  supporter: number;
}

export interface GoalResolution {
  goalId: string;
  status: GoalOutcomeStatus;
  current: number;
  boardDelta: number;
  supporterDelta: number;
  reason: string;
}

export interface GoalPacingTick {
  pacingTickedGames: number;
  boardDelta: number;
  reason: string;
}

/** Escala o impacto de moral pela prioridade escolhida ao criar a meta. */
export const PRIORITY_MULTIPLIER: Record<BoardGoalPriority, number> = {
  low: 0.6,
  medium: 1,
  high: 1.5,
  critical: 2.2,
};

/**
 * Magnitude-base do impacto na Confiança da Diretoria / Moral da Torcida ao
 * resolver uma meta. Falha dói mais que sucesso anima — ajustável aqui. Usada
 * tanto para `done` quanto (com bônus) para `exceeded` — ver `goalMoraleDelta`.
 */
export const GOAL_MORALE_IMPACT: Record<
  BoardGoalKind,
  { done: GoalMoraleImpact; failed: GoalMoraleImpact }
> = {
  win_competition: { done: { board: 14, supporter: 18 }, failed: { board: -20, supporter: -16 } },
  cup_stage: { done: { board: 10, supporter: 12 }, failed: { board: -14, supporter: -12 } },
  league_position: { done: { board: 8, supporter: 10 }, failed: { board: -10, supporter: -14 } },
  dont_spend_over: { done: { board: 6, supporter: 3 }, failed: { board: -9, supporter: -4 } },
  wage_bill_cap: { done: { board: 6, supporter: 3 }, failed: { board: -9, supporter: -4 } },
  reduce_debt: { done: { board: 6, supporter: 3 }, failed: { board: -9, supporter: -4 } },
  positive_balance: { done: { board: 6, supporter: 3 }, failed: { board: -9, supporter: -4 } },
  sell_players: { done: { board: 5, supporter: 2 }, failed: { board: -6, supporter: -3 } },
  sign_players: { done: { board: 5, supporter: 2 }, failed: { board: -6, supporter: -3 } },
};

/** Bônus multiplicativo extra quando a meta é `exceeded` em vez de apenas `done`. */
const EXCEEDED_BONUS = 1.35;

function findCompetition(
  goal: BoardGoal,
  competitions: SeasonCompetition[],
): SeasonCompetition | undefined {
  return goal.competitionId ? competitions.find(c => c.id === goal.competitionId) : undefined;
}

/** Nº de jogos já disputados na fase de liga, a partir da linha do próprio time na tabela. */
export function gamesPlayedForGoal(comp: SeasonCompetition | undefined): number | null {
  const row = comp?.leagueTable?.find(r => r.isUserTeam);
  return row ? row.matches : null;
}

/** Maior estágio de mata-mata confirmadamente alcançado (fases sem `stage` são ignoradas). */
function highestReachedStageRank(comp: SeasonCompetition): number | null {
  let best: number | null = null;
  for (const phase of comp.knockoutPhases ?? []) {
    if (!phase.stage || !phase.advanced || phase.outcome === 'lost') continue;
    const rank = KNOCKOUT_STAGE_RANK[phase.stage];
    if (best == null || rank > best) best = rank;
  }
  return best;
}

function wasChampion(comp: SeasonCompetition): boolean {
  return (comp.knockoutPhases ?? []).some(p => p.advanced && p.isFinal && p.outcome === 'won');
}

function eliminatedStageRank(comp: SeasonCompetition): number | null {
  const phase = (comp.knockoutPhases ?? []).find(
    p => p.stage && p.advanced && p.outcome === 'lost',
  );
  return phase?.stage ? KNOCKOUT_STAGE_RANK[phase.stage] : null;
}

/** Posição-alvo padrão para uma faixa de liga, dado o nº de times na tabela. */
export function defaultLeagueTargetForTier(tier: LeagueTier, teamCount = 20): number {
  const n = Math.max(2, teamCount);
  switch (tier) {
    case 'champion':
      return 1;
    case 'g4':
      return Math.max(4, Math.round(n * 0.1));
    case 'continental':
      return Math.max(1, Math.round(n * 0.3));
    case 'mid_table':
      return Math.max(1, Math.round(n / 2));
    case 'relegation_escape':
      return Math.max(1, n - Math.round(n * 0.18));
    default:
      return Math.max(1, Math.round(n / 2));
  }
}

/** Progresso "ao vivo" — não decide status final, só o valor de `current` exibido. */
export function evaluateGoalProgress(goal: BoardGoal, ctx: GoalEvalContext): number {
  switch (goal.kind) {
    case 'league_position': {
      const comp = findCompetition(goal, ctx.competitions);
      return comp?.currentPosition ?? goal.current;
    }
    case 'win_competition': {
      const comp = findCompetition(goal, ctx.competitions);
      return comp && wasChampion(comp) ? 1 : 0;
    }
    case 'cup_stage': {
      const comp = findCompetition(goal, ctx.competitions);
      if (!comp) return goal.current;
      return highestReachedStageRank(comp) ?? goal.current;
    }
    case 'dont_spend_over':
      return ctx.spentOnTransfers;
    case 'sell_players':
      return ctx.transfersSeason.filter(t => t.type === 'sell' || t.type === 'loan_out').length;
    case 'sign_players':
      return ctx.transfersSeason.filter(
        t => t.type === 'buy' || t.type === 'loan_in' || t.type === 'free',
      ).length;
    case 'wage_bill_cap':
      return ctx.wageBill;
    case 'reduce_debt':
      return ctx.debtRemaining;
    case 'positive_balance':
      return ctx.balance;
    default:
      return goal.current;
  }
}

/**
 * Resultado definitivo de uma meta — chamado tanto no "tick" contínuo (para as
 * metas que podem resolver a qualquer momento) quanto no fim de temporada
 * (`seasonEnding: true`, para as que só fecham aí). Retorna `null` enquanto a
 * meta deve continuar `active`.
 */
export function evaluateGoalOutcome(
  goal: BoardGoal,
  ctx: GoalEvalContext,
  opts?: { seasonEnding?: boolean },
): GoalEvalResult | null {
  const current = evaluateGoalProgress(goal, ctx);

  switch (goal.kind) {
    case 'win_competition': {
      const comp = findCompetition(goal, ctx.competitions);
      if (!comp) {
        return opts?.seasonEnding ? { current, status: 'failed' } : null;
      }
      const knockout = comp.knockoutPhases ?? [];
      const champion = wasChampion(comp);
      const eliminated = knockout.some(p => p.advanced && p.outcome === 'lost');
      if (champion) return { current: 1, status: 'done' };
      if (eliminated) return { current: 0, status: 'failed' };
      if (!knockout.length && opts?.seasonEnding) {
        return (comp.currentPosition ?? Infinity) === 1
          ? { current, status: 'done' }
          : { current, status: 'failed' };
      }
      return null;
    }

    case 'cup_stage': {
      const comp = findCompetition(goal, ctx.competitions);
      if (!comp) {
        return opts?.seasonEnding ? { current, status: 'failed' } : null;
      }
      const targetRank = goal.target;
      const reached = highestReachedStageRank(comp);
      if (reached != null && (reached > targetRank || wasChampion(comp))) {
        return { current: reached, status: 'exceeded' };
      }
      if (reached != null && reached === targetRank) {
        return { current: reached, status: 'done' };
      }
      const eliminatedRank = eliminatedStageRank(comp);
      if (eliminatedRank != null) {
        return { current: reached ?? 0, status: 'failed' };
      }
      if (opts?.seasonEnding) {
        return { current: reached ?? 0, status: 'failed' };
      }
      return null;
    }

    case 'league_position': {
      const comp = findCompetition(goal, ctx.competitions);
      const totalMatchdays = goal.totalMatchdays ?? 38;
      const gamesPlayed = gamesPlayedForGoal(comp);
      const roundsDone = gamesPlayed != null && gamesPlayed >= totalMatchdays;
      if (!roundsDone && !opts?.seasonEnding) return null;
      if (!comp || comp.currentPosition == null) {
        return { current, status: 'failed' };
      }
      if (comp.currentPosition > goal.target) return { current, status: 'failed' };
      if (comp.currentPosition <= goal.target - 2) return { current, status: 'exceeded' };
      return { current, status: 'done' };
    }

    case 'dont_spend_over':
    case 'wage_bill_cap':
    case 'reduce_debt': {
      if (current > goal.target) return { current, status: 'failed' };
      if (opts?.seasonEnding) {
        return current <= goal.target * 0.8
          ? { current, status: 'exceeded' }
          : { current, status: 'done' };
      }
      return null;
    }

    case 'sell_players':
    case 'sign_players':
    case 'positive_balance': {
      if (current > goal.target) return { current, status: 'exceeded' };
      if (current === goal.target) return { current, status: 'done' };
      if (opts?.seasonEnding) return { current, status: 'failed' };
      return null;
    }

    default:
      return opts?.seasonEnding ? { current, status: 'failed' } : null;
  }
}

/** Impacto de moral ao resolver, escalado pela distância do alvo, prioridade e superação. */
export function goalMoraleDelta(
  goal: BoardGoal,
  status: GoalOutcomeStatus,
  current: number,
): GoalMoraleImpact {
  const impactStatus = status === 'exceeded' ? 'done' : status;
  const base = GOAL_MORALE_IMPACT[goal.kind][impactStatus];
  let board = base.board;
  let supporter = base.supporter;

  if (status === 'exceeded') {
    board *= EXCEEDED_BONUS;
    supporter *= EXCEEDED_BONUS;
  }

  if (goal.kind === 'league_position' && goal.target > 0 && status === 'failed') {
    const missedBy = Math.max(0, current - goal.target);
    const factor = Math.min(2.2, 1 + missedBy / 5);
    board *= factor;
    supporter *= factor;
  }

  const multiplier = PRIORITY_MULTIPLIER[goal.priority ?? 'medium'];
  return {
    board: Math.round(board * multiplier),
    supporter: Math.round(supporter * multiplier),
  };
}

function resolutionFor(goal: BoardGoal, outcome: GoalEvalResult): GoalResolution {
  const delta = goalMoraleDelta(goal, outcome.status, outcome.current);
  const verb =
    outcome.status === 'done' ? 'cumprida' : outcome.status === 'exceeded' ? 'superada' : 'falhou';
  return {
    goalId: goal.id,
    status: outcome.status,
    current: outcome.current,
    boardDelta: delta.board,
    supporterDelta: delta.supporter,
    reason: outcome.status === 'failed' ? `Meta falhou: ${goal.label}` : `Meta ${verb}: ${goal.label}`,
  };
}

/** Mesmo cálculo de impacto de moral, para uma finalização manual (usuário decide o status). */
export function resolveGoalManually(
  goal: BoardGoal,
  status: 'done' | 'exceeded' | 'failed',
  current: number,
): GoalResolution {
  const delta = goalMoraleDelta(goal, status, current);
  const verb = status === 'done' ? 'concluída' : status === 'exceeded' ? 'superada' : 'não concluída';
  return {
    goalId: goal.id,
    status,
    current,
    boardDelta: delta.board,
    supporterDelta: delta.supporter,
    reason: `Meta encerrada manualmente (${verb}): ${goal.label}`,
  };
}

/** Passagem contínua: metas que resolvem na hora viram `resolutions`; as demais só atualizam `progress`. */
export function tickBoardGoals(
  goals: BoardGoal[],
  season: number,
  ctx: GoalEvalContext,
): { progress: { goalId: string; current: number }[]; resolutions: GoalResolution[] } {
  const progress: { goalId: string; current: number }[] = [];
  const resolutions: GoalResolution[] = [];

  for (const goal of goals) {
    if (goal.status !== 'active' || goal.season !== season || goal.resolvedManually) continue;
    const outcome = evaluateGoalOutcome(goal, ctx);
    if (outcome) {
      resolutions.push(resolutionFor(goal, outcome));
      continue;
    }
    const current = evaluateGoalProgress(goal, ctx);
    if (current !== goal.current) {
      progress.push({ goalId: goal.id, current });
    }
  }

  return { progress, resolutions };
}

/** Fim de temporada: resolve tudo que ainda estiver `active` na temporada que está fechando. */
export function resolveGoalsAtSeasonEnd(
  goals: BoardGoal[],
  season: number,
  ctx: GoalEvalContext,
): GoalResolution[] {
  const resolutions: GoalResolution[] = [];
  for (const goal of goals) {
    if (goal.status !== 'active' || goal.season !== season || goal.resolvedManually) continue;
    const outcome = evaluateGoalOutcome(goal, ctx, { seasonEnding: true });
    if (!outcome) continue;
    resolutions.push(resolutionFor(goal, outcome));
  }
  return resolutions;
}

/**
 * Ajuste de Confiança da Diretoria "por rodada" para metas de liga ativas — o ritmo do
 * campeonato pesa mais perto do fim da temporada. Constantes nomeadas abaixo para calibrar.
 */
const PACING_BASE_UNIT = 0.6;
const PACING_ONTRACK_UNIT = 0.4;
const PACING_DISTANCE_DIVISOR = 5;
const PACING_LATE_FACTOR_MIN = 0.4;
const PACING_LATE_FACTOR_RANGE = 0.6;

export function tickLeaguePacing(
  goal: BoardGoal,
  comp: SeasonCompetition | undefined,
): GoalPacingTick | null {
  if (goal.kind !== 'league_position' || goal.status !== 'active' || goal.resolvedManually) {
    return null;
  }
  if (!comp) return null;
  const gamesPlayed = gamesPlayedForGoal(comp);
  if (gamesPlayed == null) return null;
  const ticked = goal.pacingTickedGames ?? 0;
  if (gamesPlayed <= ticked) return null;

  const totalMatchdays = goal.totalMatchdays ?? 38;
  const position = comp.currentPosition ?? goal.target;
  const distance = position - goal.target;
  const multiplier = PRIORITY_MULTIPLIER[goal.priority ?? 'medium'];

  let total = 0;
  for (let g = ticked + 1; g <= gamesPlayed; g++) {
    const progressFrac = totalMatchdays > 0 ? Math.min(1, g / totalMatchdays) : 0;
    const lateFactor = PACING_LATE_FACTOR_MIN + PACING_LATE_FACTOR_RANGE * progressFrac;
    if (distance > 0) {
      total -= Math.round(PACING_BASE_UNIT * (1 + distance / PACING_DISTANCE_DIVISOR) * lateFactor * multiplier);
    } else if (distance < 0) {
      total += Math.round(PACING_ONTRACK_UNIT * lateFactor * multiplier);
    }
  }

  return {
    pacingTickedGames: gamesPlayed,
    boardDelta: total,
    reason:
      total !== 0
        ? `Ritmo do campeonato — ${goal.label}: ${position}º atual vs. meta ${goal.target}º`
        : '',
  };
}

/** Verdadeiro quando as rodadas da liga já terminaram mas a meta ainda está ativa. */
export function leagueGoalAwaitingUpdate(goal: BoardGoal, comp: SeasonCompetition | undefined): boolean {
  if (goal.kind !== 'league_position' || goal.status !== 'active') return false;
  const gamesPlayed = gamesPlayedForGoal(comp);
  if (gamesPlayed == null) return false;
  return gamesPlayed >= (goal.totalMatchdays ?? 38);
}

/** Rótulo curto da meta de liga vinculada a uma competição, para exibir ao lado da posição. */
export function describeLeagueGoalForCompetition(
  comp: SeasonCompetition,
  goals: BoardGoal[],
  season: number,
): { label: string; onTrack: boolean } | null {
  const goal = goals.find(
    g => g.competitionId === comp.id && g.season === season && g.kind === 'league_position',
  );
  if (!goal) return null;
  const tierLabel = goal.leagueTier ? LEAGUE_TIER_LABELS[goal.leagueTier] : `Top ${goal.target}`;
  const position = comp.currentPosition;
  const onTrack = position != null ? position <= goal.target : true;
  return { label: `Meta: ${tierLabel}`, onTrack };
}

/** Migração leve para saves antigos — garante defaults dos campos novos. */
export function migrateBoardGoal(raw: BoardGoal): BoardGoal {
  return {
    ...raw,
    priority: raw.priority ?? 'medium',
    pacingTickedGames: raw.pacingTickedGames ?? 0,
  };
}
