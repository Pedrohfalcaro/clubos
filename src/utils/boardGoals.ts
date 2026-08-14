import type { BoardGoal, BoardGoalKind, BoardGoalStatus } from '../types/Board';
import type { SeasonCompetition } from '../types/Competition';
import type { TransferRecord } from '../types/Transfer';

export interface GoalEvalContext {
  competitions: SeasonCompetition[];
  /** Transferências da temporada da meta (todas, para contar vendas). */
  transfersSeason: TransferRecord[];
  /** Soma gasta em contratações (`buy`) na temporada da meta. */
  spentOnTransfers: number;
  /** Folha salarial atual (soma dos salários do elenco ativo). */
  wageBill: number;
}

export interface GoalEvalResult {
  current: number;
  /** Nunca 'active' — enquanto a meta deve continuar ativa, a função retorna `null`. */
  status: Exclude<BoardGoalStatus, 'active'>;
}

export interface GoalMoraleImpact {
  board: number;
  supporter: number;
}

export interface GoalResolution {
  goalId: string;
  status: 'done' | 'failed';
  current: number;
  boardDelta: number;
  supporterDelta: number;
  reason: string;
}

/**
 * Magnitude-base do impacto na Confiança da Diretoria / Moral da Torcida ao
 * resolver uma meta. Falha dói mais que sucesso anima — ajustável aqui.
 */
export const GOAL_MORALE_IMPACT: Record<
  BoardGoalKind,
  { done: GoalMoraleImpact; failed: GoalMoraleImpact }
> = {
  win_competition: { done: { board: 14, supporter: 18 }, failed: { board: -20, supporter: -16 } },
  league_position: { done: { board: 8, supporter: 10 }, failed: { board: -10, supporter: -14 } },
  dont_spend_over: { done: { board: 6, supporter: 3 }, failed: { board: -9, supporter: -4 } },
  wage_bill_cap: { done: { board: 6, supporter: 3 }, failed: { board: -9, supporter: -4 } },
  sell_players: { done: { board: 5, supporter: 2 }, failed: { board: -6, supporter: -3 } },
};

function findCompetition(
  goal: BoardGoal,
  competitions: SeasonCompetition[],
): SeasonCompetition | undefined {
  return goal.competitionId ? competitions.find(c => c.id === goal.competitionId) : undefined;
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
      if (!comp) return goal.current;
      const champion = (comp.knockoutPhases ?? []).some(
        p => p.advanced && p.isFinal && p.outcome === 'won',
      );
      return champion ? 1 : 0;
    }
    case 'dont_spend_over':
      return ctx.spentOnTransfers;
    case 'sell_players':
      return ctx.transfersSeason.filter(t => t.type === 'sell' || t.type === 'loan_out').length;
    case 'wage_bill_cap':
      return ctx.wageBill;
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
      const champion = knockout.some(p => p.advanced && p.isFinal && p.outcome === 'won');
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

    case 'league_position': {
      if (!opts?.seasonEnding) return null;
      const comp = findCompetition(goal, ctx.competitions);
      if (!comp || comp.currentPosition == null) return { current, status: 'failed' };
      return comp.currentPosition <= goal.target
        ? { current, status: 'done' }
        : { current, status: 'failed' };
    }

    case 'dont_spend_over':
    case 'wage_bill_cap': {
      if (current > goal.target) return { current, status: 'failed' };
      if (opts?.seasonEnding) return { current, status: 'done' };
      return null;
    }

    case 'sell_players': {
      if (current >= goal.target) return { current, status: 'done' };
      if (opts?.seasonEnding) return { current, status: 'failed' };
      return null;
    }

    default:
      return opts?.seasonEnding ? { current, status: 'failed' } : null;
  }
}

/** Impacto de moral ao resolver, escalado pela distância do alvo quando fizer sentido. */
export function goalMoraleDelta(
  goal: BoardGoal,
  status: 'done' | 'failed',
  current: number,
): GoalMoraleImpact {
  const base = GOAL_MORALE_IMPACT[goal.kind][status];
  if (goal.kind === 'league_position' && goal.target > 0 && status === 'failed') {
    const missedBy = Math.max(0, current - goal.target);
    const factor = Math.min(2.2, 1 + missedBy / 5);
    return {
      board: Math.round(base.board * factor),
      supporter: Math.round(base.supporter * factor),
    };
  }
  return base;
}

function resolutionFor(goal: BoardGoal, outcome: GoalEvalResult): GoalResolution {
  const delta = goalMoraleDelta(goal, outcome.status, outcome.current);
  return {
    goalId: goal.id,
    status: outcome.status,
    current: outcome.current,
    boardDelta: delta.board,
    supporterDelta: delta.supporter,
    reason:
      outcome.status === 'done' ? `Meta cumprida: ${goal.label}` : `Meta falhou: ${goal.label}`,
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
    if (goal.status !== 'active' || goal.season !== season) continue;
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
    if (goal.status !== 'active' || goal.season !== season) continue;
    const outcome = evaluateGoalOutcome(goal, ctx, { seasonEnding: true });
    if (!outcome) continue;
    resolutions.push(resolutionFor(goal, outcome));
  }
  return resolutions;
}
