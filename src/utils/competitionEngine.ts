import type { Match } from '../types/Match';
import type {
  CompetitionFormat,
  CompetitionTableRow,
  CompetitionType,
  KnockoutPhase,
  SeasonCompetition,
} from '../types/Competition';
import { uid } from './matchEvents';

export function defaultFormatForType(type: CompetitionType): CompetitionFormat {
  if (type === 'cup') return 'knockout';
  if (type === 'continental' || type === 'state') return 'league_knockout';
  return 'league';
}

export function hasLeagueStage(format: CompetitionFormat): boolean {
  return format === 'league' || format === 'league_knockout';
}

export function hasKnockoutStage(format: CompetitionFormat): boolean {
  return format === 'knockout' || format === 'league_knockout';
}

export function rowPoints(row: Pick<CompetitionTableRow, 'wins' | 'draws'>): number {
  return row.wins * 3 + row.draws;
}

export function rowGoalDiff(row: Pick<CompetitionTableRow, 'goalsFor' | 'goalsAgainst'>): number {
  return row.goalsFor - row.goalsAgainst;
}

export function sortLeagueTable(rows: CompetitionTableRow[]): CompetitionTableRow[] {
  return [...rows].sort(
    (a, b) =>
      rowPoints(b) - rowPoints(a) ||
      rowGoalDiff(b) - rowGoalDiff(a) ||
      b.goalsFor - a.goalsFor ||
      a.teamName.localeCompare(b.teamName, 'pt-BR'),
  );
}

function emptyRow(teamName: string, opts?: Partial<CompetitionTableRow>): CompetitionTableRow {
  return {
    id: opts?.id ?? uid(),
    teamName,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    isUserTeam: opts?.isUserTeam,
    locked: opts?.locked,
  };
}

/** Monta tabela relativa só a partir dos jogos (sem persistência). */
export function standingsMapFromMatches(
  teamName: string,
  matches: Match[],
  competitionName: string,
  season?: number,
): Map<string, CompetitionTableRow> {
  const relevant = matches.filter(
    m =>
      m.status === 'completed' &&
      m.competition === competitionName &&
      (season == null || m.season == null || m.season === season),
  );

  const map = new Map<string, CompetitionTableRow>();
  map.set(teamName, emptyRow(teamName, { isUserTeam: true }));

  for (const m of relevant) {
    const us = map.get(teamName)!;
    const oppName = m.opponent.trim();
    if (!oppName) continue;
    if (!map.has(oppName)) map.set(oppName, emptyRow(oppName));
    const opp = map.get(oppName)!;

    const ourResult = m.result ?? 'draw';
    us.matches += 1;
    us.goalsFor += m.goalsFor;
    us.goalsAgainst += m.goalsAgainst;
    if (ourResult === 'win') us.wins += 1;
    else if (ourResult === 'draw') us.draws += 1;
    else us.losses += 1;

    opp.matches += 1;
    opp.goalsFor += m.goalsAgainst;
    opp.goalsAgainst += m.goalsFor;
    if (ourResult === 'win') opp.losses += 1;
    else if (ourResult === 'draw') opp.draws += 1;
    else opp.wins += 1;
  }

  return map;
}

/**
 * Mescla tabela salva com jogos da temporada.
 * Linhas locked preservam stats; adversários novos entram automaticamente.
 */
export function syncLeagueTable(
  existing: CompetitionTableRow[] | undefined,
  teamName: string,
  matches: Match[],
  competitionName: string,
  season?: number,
): CompetitionTableRow[] {
  const auto = standingsMapFromMatches(teamName, matches, competitionName, season);
  const prev = existing ?? [];
  const byName = new Map(prev.map(r => [r.teamName.trim().toLowerCase(), r]));
  const result: CompetitionTableRow[] = [];
  const seen = new Set<string>();

  const pushMerged = (name: string, autoRow?: CompetitionTableRow, preferUser = false) => {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    const old = byName.get(key);
    if (old?.locked) {
      result.push({
        ...old,
        teamName: old.teamName || name,
        isUserTeam: preferUser || old.isUserTeam || autoRow?.isUserTeam,
      });
      return;
    }
    if (autoRow) {
      result.push({
        id: old?.id ?? autoRow.id,
        teamName: old?.teamName || autoRow.teamName,
        matches: autoRow.matches,
        wins: autoRow.wins,
        draws: autoRow.draws,
        losses: autoRow.losses,
        goalsFor: autoRow.goalsFor,
        goalsAgainst: autoRow.goalsAgainst,
        isUserTeam: preferUser || autoRow.isUserTeam,
        locked: false,
      });
      return;
    }
    if (old) {
      result.push({ ...old, isUserTeam: preferUser || old.isUserTeam });
    }
  };

  pushMerged(teamName, auto.get(teamName), true);

  for (const [name, row] of auto) {
    if (name === teamName) continue;
    pushMerged(name, row);
  }

  for (const old of prev) {
    pushMerged(old.teamName);
  }

  if (!result.some(r => r.isUserTeam || r.teamName === teamName)) {
    result.unshift(emptyRow(teamName, { isUserTeam: true }));
  }

  return sortLeagueTable(result);
}

export function createEmptyTableRow(teamName = '', isUserTeam = false): CompetitionTableRow {
  return emptyRow(teamName || 'Novo time', { isUserTeam, locked: !isUserTeam });
}

export function createInitialKnockoutPhase(name = 'Fase 1'): KnockoutPhase {
  return {
    id: uid(),
    name,
    opponent: '',
    goalsFor: null,
    goalsAgainst: null,
    advanced: false,
    isFinal: false,
  };
}

export function ensureCompetitionShape(
  comp: SeasonCompetition,
  teamName?: string,
): SeasonCompetition {
  const format = comp.format ?? defaultFormatForType(comp.type);
  let leagueTable = comp.leagueTable;
  let knockoutPhases = comp.knockoutPhases;

  if (hasLeagueStage(format) && (!leagueTable || leagueTable.length === 0) && teamName) {
    leagueTable = [emptyRow(teamName, { isUserTeam: true })];
  }
  if (hasKnockoutStage(format) && (!knockoutPhases || knockoutPhases.length === 0)) {
    if (format === 'knockout' || comp.knockoutStarted) {
      knockoutPhases = [createInitialKnockoutPhase()];
    }
  }

  return { ...comp, format, leagueTable, knockoutPhases };
}

export function phaseOutcome(
  goalsFor: number | null,
  goalsAgainst: number | null,
): 'won' | 'lost' | 'draw' | null {
  if (goalsFor == null || goalsAgainst == null) return null;
  if (goalsFor > goalsAgainst) return 'won';
  if (goalsFor < goalsAgainst) return 'lost';
  return 'draw';
}

/** Placar agregado da fase (soma ida+volta quando `twoLegged`; senão o placar único). */
export function phaseAggregate(phase: KnockoutPhase): { for: number; against: number } | null {
  if (phase.goalsFor == null || phase.goalsAgainst == null) return null;
  if (!phase.twoLegged) return { for: phase.goalsFor, against: phase.goalsAgainst };
  const leg2 = phase.secondLeg;
  if (!leg2 || leg2.goalsFor == null || leg2.goalsAgainst == null) return null;
  return {
    for: phase.goalsFor + leg2.goalsFor,
    against: phase.goalsAgainst + leg2.goalsAgainst,
  };
}

/**
 * Resultado da fase pelo agregado. Se o agregado empatar, só resolve quando
 * `decidedOnPenalties` + `penaltyWinner` estiverem preenchidos — senão retorna 'draw'.
 */
export function phaseTieOutcome(phase: KnockoutPhase): 'won' | 'lost' | 'draw' | null {
  const agg = phaseAggregate(phase);
  if (!agg) return null;
  if (agg.for > agg.against) return 'won';
  if (agg.for < agg.against) return 'lost';
  if (phase.decidedOnPenalties && phase.penaltyWinner) {
    return phase.penaltyWinner === 'us' ? 'won' : 'lost';
  }
  return 'draw';
}

/** Descrição textual do placar (ida/volta/agregado/pênaltis) para mensagens de resultado. */
function legScoreLabel(phase: KnockoutPhase, agg: { for: number; against: number }): string {
  if (!phase.twoLegged) return `${phase.goalsFor}-${phase.goalsAgainst}`;
  const leg2 = phase.secondLeg!;
  const base = `ida ${phase.goalsFor}-${phase.goalsAgainst}, volta ${leg2.goalsFor}-${leg2.goalsAgainst}, agregado ${agg.for}-${agg.against}`;
  return phase.decidedOnPenalties ? `${base}, nos pênaltis` : base;
}

export type KnockoutAdvanceResult = {
  phases: KnockoutPhase[];
  prizeAmount: number;
  prizeKind: 'knockout' | 'champion' | null;
  eliminated: boolean;
  champion: boolean;
  message: string;
};

/**
 * Avança a fase atual do mata-mata.
 * Premiação: knockout ao passar de fase; champion se for final vencida.
 */
export function advanceKnockoutPhase(
  phases: KnockoutPhase[],
  prizes: { knockout?: number; champion?: number },
  options?: { markAsFinal?: boolean },
): KnockoutAdvanceResult | { error: string } {
  const current = [...phases];
  const idx = current.findIndex(p => !p.advanced);
  if (idx < 0) return { error: 'Não há fase aberta para avançar.' };

  const phase = { ...current[idx] };
  if (options?.markAsFinal) phase.isFinal = true;

  if (!phase.opponent.trim()) return { error: 'Informe o adversário.' };

  const agg = phaseAggregate(phase);
  if (!agg) {
    return {
      error: phase.twoLegged
        ? 'Preencha o placar dos dois jogos (ida e volta).'
        : 'Informe o placar da fase.',
    };
  }

  const outcome = phaseTieOutcome(phase);
  if (outcome === 'draw') {
    return {
      error: phase.twoLegged
        ? 'Empate no agregado — informe quem venceu nos pênaltis/prorrogação.'
        : 'Empate no mata-mata — ajuste o placar (prorrogação/pênaltis contam no placar final).',
    };
  }
  if (!outcome) return { error: 'Informe o placar da fase.' };

  phase.outcome = outcome;
  const scoreNote = legScoreLabel(phase, agg);

  if (outcome === 'lost') {
    phase.advanced = true;
    current[idx] = phase;
    return {
      phases: current,
      prizeAmount: 0,
      prizeKind: null,
      eliminated: true,
      champion: false,
      message: `Eliminado por ${phase.opponent.trim()} na ${phase.name} (${scoreNote}).`,
    };
  }

  // won
  phase.advanced = true;
  let prizeAmount: number;
  let prizeKind: 'knockout' | 'champion' | null;

  if (phase.isFinal) {
    prizeAmount = prizes.champion ?? 0;
    prizeKind = prizeAmount > 0 ? 'champion' : null;
    phase.prizeReceived = prizeAmount > 0 ? prizeAmount : undefined;
    current[idx] = phase;
    return {
      phases: current,
      prizeAmount,
      prizeKind,
      eliminated: false,
      champion: true,
      message:
        prizeAmount > 0
          ? `Campeão! (${scoreNote}) Premiação de campeão creditada.`
          : `Campeão da competição! (${scoreNote})`,
    };
  }

  prizeAmount = prizes.knockout ?? 0;
  prizeKind = prizeAmount > 0 ? 'knockout' : null;
  phase.prizeReceived = prizeAmount > 0 ? prizeAmount : undefined;
  current[idx] = phase;

  const nextNumber = current.length + 1;
  current.push(createInitialKnockoutPhase(`Fase ${nextNumber}`));

  return {
    phases: current,
    prizeAmount,
    prizeKind,
    eliminated: false,
    champion: false,
    message:
      prizeAmount > 0
        ? `Classificado! (${scoreNote}) Premiação de eliminatória creditada.`
        : `Classificado para a próxima fase! (${scoreNote})`,
  };
}

/**
 * Atalho: declara eliminação na fase atual sem exigir placar preenchido.
 * Sem premiação — apenas marca a fase corrente como derrota.
 */
export function eliminateCurrentPhase(
  phases: KnockoutPhase[],
): KnockoutAdvanceResult | { error: string } {
  const current = [...phases];
  const idx = current.findIndex(p => !p.advanced);
  if (idx < 0) return { error: 'Não há fase aberta para declarar eliminação.' };

  const phase: KnockoutPhase = { ...current[idx], advanced: true, outcome: 'lost' };
  current[idx] = phase;

  const opponentLabel = phase.opponent.trim() || 'adversário';
  return {
    phases: current,
    prizeAmount: 0,
    prizeKind: null,
    eliminated: true,
    champion: false,
    message: `Eliminado por ${opponentLabel} na ${phase.name}.`,
  };
}

export function leagueTablesEqual(a?: CompetitionTableRow[], b?: CompetitionTableRow[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.teamName !== y.teamName ||
      x.matches !== y.matches ||
      x.wins !== y.wins ||
      x.draws !== y.draws ||
      x.losses !== y.losses ||
      x.goalsFor !== y.goalsFor ||
      x.goalsAgainst !== y.goalsAgainst ||
      !!x.locked !== !!y.locked ||
      !!x.isUserTeam !== !!y.isUserTeam
    ) {
      return false;
    }
  }
  return true;
}
