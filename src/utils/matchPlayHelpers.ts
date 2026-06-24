import type {
  GoalEvent,
  AssistEvent,
  CardEvent,
  SubstitutionEvent,
  TeamGoalEntry,
  TeamCardEntry,
  OpponentGoalEntry,
} from '../types/Match';
import type { Player } from '../types/Player';
import { minuteSortValue } from './matchEvents';

export function getFieldPlayerIds(
  starters: string[],
  subs: SubstitutionEvent[],
): Set<string> {
  const onField = new Set(starters);
  for (const sub of subs.filter(s => s.side === 'team').sort((a, b) => minuteSortValue(a.minute) - minuteSortValue(b.minute))) {
    onField.delete(sub.playerOutId);
    onField.add(sub.playerInId);
  }
  return onField;
}

export function isPlayerOnField(playerId: string, starters: string[], subs: SubstitutionEvent[]): boolean {
  return getFieldPlayerIds(starters, subs).has(playerId);
}

export function getExpelledPlayerIds(cards: TeamCardEntry[]): Set<string> {
  const yellows = new Map<string, number>();
  const expelled = new Set<string>();
  for (const c of cards) {
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
  return cards.map(c => ({
    playerId: c.playerId,
    playerName: c.playerName,
    minute: c.minute.base,
    stoppage: c.minute.stoppage,
    type: c.type,
  }));
}

export function syncTeamGoalsCount(goals: TeamGoalEntry[], count: number, uid: () => string): TeamGoalEntry[] {
  if (goals.length === count) return goals;
  if (goals.length < count) {
    return [
      ...goals,
      ...Array.from({ length: count - goals.length }, () => ({
        id: uid(),
        type: 'team' as const,
        playerId: '',
        minute: { base: 1 },
      })),
    ];
  }
  return goals.slice(0, count);
}

export function opponentGoalsText(goals: OpponentGoalEntry[]): string {
  return goals.map(g => g.scorerName).filter(Boolean).join(', ');
}
