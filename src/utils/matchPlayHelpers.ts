import type {
  GoalEvent,
  AssistEvent,
  CardEvent,
  SubstitutionEvent,
  TeamGoalEntry,
  TeamCardEntry,
  OpponentGoalEntry,
  TeamInjuryEntry,
  MatchMinute,
} from '../types/Match';
import type { Player } from '../types/Player';
import { minuteSortValue } from './matchEvents';

export function getSubbedOutIds(subs: SubstitutionEvent[]): Set<string> {
  return new Set(
    subs.filter(s => s.side === 'team' && s.playerOutId).map(s => s.playerOutId),
  );
}

export function getInjuredIds(injuries: TeamInjuryEntry[] = []): Set<string> {
  return new Set(injuries.map(i => i.playerId).filter(Boolean));
}

/** Players permanently unavailable for the rest of the match (subbed out or injured). */
export function getPermanentlyOutIds(
  subs: SubstitutionEvent[],
  injuries: TeamInjuryEntry[] = [],
): Set<string> {
  return new Set([...getSubbedOutIds(subs), ...getInjuredIds(injuries)]);
}

/**
 * Who is currently on the pitch.
 * Once substituted out (or injured), a player never returns.
 */
export function getFieldPlayerIds(
  starters: string[],
  subs: SubstitutionEvent[],
  injuries: TeamInjuryEntry[] = [],
): Set<string> {
  const permanentlyOut = getPermanentlyOutIds(subs, injuries);
  const onField = new Set(starters.filter(id => !permanentlyOut.has(id)));

  const teamSubs = subs
    .filter(s => s.side === 'team')
    .sort((a, b) => minuteSortValue(a.minute) - minuteSortValue(b.minute));

  for (const sub of teamSubs) {
    onField.delete(sub.playerOutId);
    if (sub.playerInId && !permanentlyOut.has(sub.playerInId)) {
      onField.add(sub.playerInId);
    }
  }

  for (const id of permanentlyOut) {
    onField.delete(id);
  }

  return onField;
}

export function isPlayerOnField(
  playerId: string,
  starters: string[],
  subs: SubstitutionEvent[],
  injuries: TeamInjuryEntry[] = [],
): boolean {
  return getFieldPlayerIds(starters, subs, injuries).has(playerId);
}

/**
 * Quem estava em campo no minuto do evento.
 * Subs com minuto <= `at` já valem (quem entrou aos 70 pode marcar aos 70;
 * quem saiu aos 70 não aparece para evento aos 70 — só antes).
 */
export function getFieldPlayerIdsAtMinute(
  starters: string[],
  subs: SubstitutionEvent[],
  at: MatchMinute,
  injuries: TeamInjuryEntry[] = [],
): Set<string> {
  const atVal = minuteSortValue(at);

  const injuredByThen = new Set(
    injuries
      .filter(i => i.playerId && minuteSortValue(i.minute) <= atVal)
      .map(i => i.playerId),
  );

  const onField = new Set(starters.filter(id => !injuredByThen.has(id)));

  const teamSubs = subs
    .filter(s => s.side === 'team')
    .sort((a, b) => minuteSortValue(a.minute) - minuteSortValue(b.minute));

  for (const sub of teamSubs) {
    if (minuteSortValue(sub.minute) > atVal) continue;
    onField.delete(sub.playerOutId);
    if (sub.playerInId && !injuredByThen.has(sub.playerInId)) {
      onField.add(sub.playerInId);
    }
  }

  for (const id of injuredByThen) {
    onField.delete(id);
  }

  return onField;
}

export function isPlayerOnFieldAtMinute(
  playerId: string,
  starters: string[],
  subs: SubstitutionEvent[],
  at: MatchMinute,
  injuries: TeamInjuryEntry[] = [],
): boolean {
  return getFieldPlayerIdsAtMinute(starters, subs, at, injuries).has(playerId);
}

/**
 * Quem pode ser autor/assistente num evento aos `at`:
 * - quem estava em campo nesse minuto (inclui titular que só saiu depois)
 * - quem ainda pode entrar do banco (dispara modal de sub)
 */
export function getEligiblePlayerIdsForEvent(
  starters: string[],
  bench: string[],
  subs: SubstitutionEvent[],
  at: MatchMinute,
  injuries: TeamInjuryEntry[] = [],
): string[] {
  const atVal = minuteSortValue(at);
  const onField = getFieldPlayerIdsAtMinute(starters, subs, at, injuries);

  const outByThen = new Set(
    subs
      .filter(s => s.side === 'team' && minuteSortValue(s.minute) <= atVal)
      .map(s => s.playerOutId),
  );
  const inByThen = new Set(
    subs
      .filter(s => s.side === 'team' && minuteSortValue(s.minute) <= atVal)
      .map(s => s.playerInId)
      .filter(Boolean),
  );
  const injuredByThen = new Set(
    injuries
      .filter(i => i.playerId && minuteSortValue(i.minute) <= atVal)
      .map(i => i.playerId),
  );

  const eligible = new Set(onField);

  for (const id of bench) {
    if (injuredByThen.has(id) || outByThen.has(id) || onField.has(id)) continue;
    // Ainda no banco nesse minuto → pode entrar via substituição
    if (!inByThen.has(id)) eligible.add(id);
  }

  return [...eligible];
}

/** Bench players eligible to enter (not already on field, not permanently out). */
export function getBenchAvailableIds(
  starters: string[],
  bench: string[],
  subs: SubstitutionEvent[],
  injuries: TeamInjuryEntry[] = [],
): string[] {
  const onField = getFieldPlayerIds(starters, subs, injuries);
  const permanentlyOut = getPermanentlyOutIds(subs, injuries);
  return bench.filter(id => !onField.has(id) && !permanentlyOut.has(id));
}

export function getExpelledPlayerIds(cards: TeamCardEntry[]): Set<string> {
  const yellows = new Map<string, number>();
  const expelled = new Set<string>();
  for (const c of cards) {
    if (!c.playerId) continue;
    if (c.type === 'red') expelled.add(c.playerId);
    if (c.type === 'yellow') {
      const n = (yellows.get(c.playerId) ?? 0) + 1;
      yellows.set(c.playerId, n);
      if (n >= 2) expelled.add(c.playerId);
    }
  }
  return expelled;
}

export function buildGoalEvents(
  teamGoals: TeamGoalEntry[],
  players: Player[],
): GoalEvent[] {
  return teamGoals.map(g => {
    if (g.type === 'own') {
      return {
        playerId: '',
        playerName: 'Gol Contra',
        minute: g.minute.base,
        stoppage: g.minute.stoppage,
        isOwnGoal: true,
        opponentScorerName: g.opponentScorerName,
      };
    }
    const scorer = players.find(p => p.id === g.playerId);
    const assist = g.assistPlayerId ? players.find(p => p.id === g.assistPlayerId) : undefined;
    return {
      playerId: g.playerId ?? '',
      playerName: scorer?.name ?? '',
      minute: g.minute.base,
      stoppage: g.minute.stoppage,
      assistPlayerId: g.assistPlayerId,
      assistPlayerName: assist?.name,
    };
  });
}

export function buildAssistEvents(teamGoals: TeamGoalEntry[], players: Player[]): AssistEvent[] {
  return teamGoals
    .filter(g => g.type === 'team' && g.assistPlayerId)
    .map((g, i) => {
      const p = players.find(pl => pl.id === g.assistPlayerId);
      return {
        playerId: g.assistPlayerId!,
        playerName: p?.name ?? '',
        minute: g.minute.base,
        stoppage: g.minute.stoppage,
        goalIndex: i,
      };
    });
}

export function buildCardEvents(cards: TeamCardEntry[]): CardEvent[] {
  return cards
    .filter(c => c.playerId)
    .map(c => ({
      playerId: c.playerId,
      playerName: c.playerName,
      minute: c.minute.base,
      stoppage: c.minute.stoppage,
      type: c.type,
    }));
}

export function syncTeamGoalsCount(goals: TeamGoalEntry[], count: number, makeId: () => string): TeamGoalEntry[] {
  if (goals.length === count) return goals;
  if (goals.length < count) {
    return [
      ...goals,
      ...Array.from({ length: count - goals.length }, () => ({
        id: makeId(),
        type: 'team' as const,
        playerId: '',
        minute: { base: 1 },
      })),
    ];
  }
  return goals.slice(0, count);
}

export function opponentGoalsText(goals: OpponentGoalEntry[]): string {
  return goals
    .map(g => {
      const assist = g.assistName?.trim();
      return assist ? `${g.scorerName} (${assist})` : g.scorerName;
    })
    .filter(Boolean)
    .join(', ');
}

export function isTeamGoalsValid(goalsFor: number, teamGoals: TeamGoalEntry[]): boolean {
  if (goalsFor === 0) return true;
  return (
    teamGoals.length === goalsFor &&
    teamGoals.every(g =>
      g.type === 'own' ? !!g.opponentScorerName?.trim() : !!g.playerId,
    )
  );
}

export function isOpponentGoalsValid(goalsAgainst: number, goals: OpponentGoalEntry[]): boolean {
  if (goalsAgainst === 0) return true;
  return goals.length === goalsAgainst && goals.every(g => !!g.scorerName.trim());
}
