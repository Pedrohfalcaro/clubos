import type { Match } from '../types/Match';

export function getPlayerMatchClubName(match: Match, fallback: string): string {
  return match.clubName ?? fallback;
}
