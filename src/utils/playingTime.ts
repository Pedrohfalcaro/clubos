import type { Match, SubstitutionEvent, TeamInjuryEntry } from '../types/Match';

const FULL_MATCH_MINUTES = 90;

function teamSubs(match: Match): SubstitutionEvent[] {
  return (match.substitutions ?? []).filter(s => s.side === 'team' && s.playerInId);
}

function leaveMinute(
  pid: string,
  subs: SubstitutionEvent[],
  injuries: TeamInjuryEntry[],
  after = 0,
): number | null {
  const outs = [
    ...subs
      .filter(s => s.playerOutId === pid && s.minute.base >= after)
      .map(s => s.minute.base),
    ...injuries
      .filter(i => i.playerId === pid && i.minute.base >= after)
      .map(i => i.minute.base),
  ].sort((a, b) => a - b);
  return outs[0] ?? null;
}

/**
 * Who actually played and for how many minutes.
 * Starters count from kickoff; bench only counts if they entered via substitution.
 * Injury or sub-out ends their minutes; they never return.
 */
export function getMatchPlayingTime(match: Match): Map<string, number> {
  const result = new Map<string, number>();
  const starters = match.lineup?.formation?.map(s => s.playerId) ?? [];
  const subs = teamSubs(match);
  const injuries = match.injuries ?? [];

  if (starters.length === 0) {
    for (const pid of match.playerMatches ?? []) {
      result.set(pid, FULL_MATCH_MINUTES);
    }
    return result;
  }

  for (const pid of starters) {
    const left = leaveMinute(pid, subs, injuries);
    result.set(
      pid,
      left != null
        ? Math.max(0, Math.min(FULL_MATCH_MINUTES, left))
        : FULL_MATCH_MINUTES,
    );
  }

  for (const sub of subs) {
    const pid = sub.playerInId;
    if (!pid || starters.includes(pid)) continue;

    const entry = Math.max(0, Math.min(FULL_MATCH_MINUTES, sub.minute.base));
    const left = leaveMinute(pid, subs, injuries, entry);
    const end = left != null ? Math.min(FULL_MATCH_MINUTES, left) : FULL_MATCH_MINUTES;
    const mins = Math.max(0, end - entry);
    result.set(pid, (result.get(pid) ?? 0) + mins);
  }

  return result;
}

export function getPlayersWhoPlayed(match: Match): string[] {
  return Array.from(getMatchPlayingTime(match).keys());
}
