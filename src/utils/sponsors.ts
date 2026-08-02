import type { Match } from '../types/Match';
import type { SeasonCompetition } from '../types/Competition';
import type { Player } from '../types/Player';
import type {
  ClubSponsor,
  FinanceLedgerEntry,
  SponsorBonusClause,
  SponsorTier,
} from '../types/Finance';
import { buildCompetitionStandings } from './achievements';
import { uid } from './matchEvents';
import { clampPaymentDay, isPaymentDay, yearMonth } from './clubDebts';
import { newLedgerEntry } from './finance';

export function sponsorTierLabel(tier: SponsorTier): string {
  return tier === 'master' ? 'Master' : 'Manga';
}

export function createClubSponsor(input: {
  brand: string;
  tier: SponsorTier;
  monthlyFee: number;
  seasons: number;
  startSeason: number;
  paymentDay?: number;
  minLeaguePosition?: number;
  terminationFee?: number;
  bonuses?: Omit<SponsorBonusClause, 'id'>[];
}): ClubSponsor {
  const seasons = Math.max(1, Math.round(input.seasons));
  return {
    id: uid(),
    brand: input.brand.trim() || 'Patrocinador',
    tier: input.tier,
    monthlyFee: Math.max(0, Math.round(input.monthlyFee)),
    seasonsTotal: seasons,
    seasonsRemaining: seasons,
    startSeason: input.startSeason,
    paymentDay: clampPaymentDay(input.paymentDay ?? 5),
    minLeaguePosition:
      input.minLeaguePosition != null && input.minLeaguePosition > 0
        ? Math.round(input.minLeaguePosition)
        : undefined,
    terminationFee: Math.max(0, Math.round(input.terminationFee ?? 0)),
    bonuses: (input.bonuses ?? []).map(b => ({
      ...b,
      id: uid(),
      amount: Math.max(0, Math.round(b.amount)),
      threshold: b.threshold != null ? Math.round(b.threshold) : undefined,
    })),
    status: 'active',
  };
}

export function migrateClubSponsor(
  raw: Partial<ClubSponsor> & { id?: string },
): ClubSponsor {
  const seasons = Math.max(1, Math.round(raw.seasonsTotal ?? raw.seasonsRemaining ?? 1));
  return {
    id: raw.id ?? uid(),
    brand: raw.brand?.trim() || 'Patrocinador',
    tier: raw.tier === 'sleeve' ? 'sleeve' : 'master',
    monthlyFee: Math.max(0, Math.round(raw.monthlyFee ?? 0)),
    seasonsTotal: seasons,
    seasonsRemaining: Math.max(0, Math.round(raw.seasonsRemaining ?? seasons)),
    startSeason: raw.startSeason ?? new Date().getFullYear(),
    paymentDay: clampPaymentDay(raw.paymentDay ?? 5),
    minLeaguePosition: raw.minLeaguePosition,
    terminationFee: Math.max(0, Math.round(raw.terminationFee ?? 0)),
    bonuses: (raw.bonuses ?? []).map(b => ({
      ...b,
      id: b.id ?? uid(),
      amount: Math.max(0, Math.round(b.amount)),
    })),
    status: raw.status === 'expired' || raw.status === 'terminated' ? raw.status : 'active',
    lastPaidMonth: raw.lastPaidMonth,
  };
}

export function activeSponsors(sponsors: ClubSponsor[] | undefined): ClubSponsor[] {
  return (sponsors ?? []).filter(s => s.status === 'active');
}

export function hasActiveTier(
  sponsors: ClubSponsor[] | undefined,
  tier: SponsorTier,
): boolean {
  return activeSponsors(sponsors).some(s => s.tier === tier);
}

export function applyMonthlySponsorPayments(
  sponsors: ClubSponsor[],
  gameDate: string,
  season: number,
): { sponsors: ClubSponsor[]; entries: FinanceLedgerEntry[] } {
  const ym = yearMonth(gameDate);
  const entries: FinanceLedgerEntry[] = [];
  const next = sponsors.map(s => {
    if (s.status !== 'active' || s.monthlyFee <= 0 || s.lastPaidMonth === ym) {
      return s;
    }
    if (!isPaymentDay(gameDate, s.paymentDay ?? 5)) return s;
    entries.push(
      newLedgerEntry(
        'sponsor',
        s.monthlyFee,
        `Patrocínio ${sponsorTierLabel(s.tier)}: ${s.brand}`,
        season,
        undefined,
        gameDate,
      ),
    );
    return { ...s, lastPaidMonth: ym };
  });
  return { sponsors: next, entries };
}

function primaryLeagueName(competitions: SeasonCompetition[]): string | null {
  const league = competitions.find(c => c.type === 'league');
  return league?.name ?? competitions.find(c => c.type !== 'friendly')?.name ?? null;
}

function teamLeaguePosition(
  teamName: string,
  matches: Match[],
  competitions: SeasonCompetition[],
  season: number,
  competitionName?: string,
): number | null {
  const name = competitionName ?? primaryLeagueName(competitions);
  if (!name) return null;
  const table = buildCompetitionStandings(teamName, matches, name, season);
  if (!table.length) return null;
  const idx = table.findIndex(e => e.teamName === teamName);
  return idx >= 0 ? idx + 1 : null;
}

function clubTopScorerGoals(players: Player[]): number {
  return players.reduce((max, p) => Math.max(max, p.stats?.goals ?? 0), 0);
}

export function settleSponsorsForSeason(input: {
  sponsors: ClubSponsor[];
  teamName: string;
  season: number;
  matches: Match[];
  competitions: SeasonCompetition[];
  players: Player[];
  titlesWon: string[];
  gameDate: string;
}): { sponsors: ClubSponsor[]; entries: FinanceLedgerEntry[] } {
  const entries: FinanceLedgerEntry[] = [];
  const position = teamLeaguePosition(
    input.teamName,
    input.matches,
    input.competitions,
    input.season,
  );
  const topGoals = clubTopScorerGoals(input.players);

  const sponsors = input.sponsors.map(s => {
    if (s.status !== 'active') return s;

    const next: ClubSponsor = { ...s, bonuses: s.bonuses.map(b => ({ ...b })) };

    for (const bonus of next.bonuses) {
      let hit = false;
      if (bonus.kind === 'league_position') {
        const maxPos = bonus.threshold ?? 1;
        hit = position != null && position <= maxPos;
      } else if (bonus.kind === 'title') {
        hit = bonus.competition
          ? input.titlesWon.includes(bonus.competition)
          : input.titlesWon.length > 0;
      } else if (bonus.kind === 'club_top_scorer') {
        const minGoals = bonus.threshold ?? 1;
        hit = topGoals >= minGoals;
      }
      if (hit && bonus.amount > 0) {
        entries.push(
          newLedgerEntry(
            'sponsor',
            bonus.amount,
            `Bônus ${sponsorTierLabel(next.tier)} (${bonus.kind}): ${next.brand}`,
            input.season,
            undefined,
            input.gameDate,
          ),
        );
      }
    }

    if (
      next.minLeaguePosition != null &&
      position != null &&
      position > next.minLeaguePosition
    ) {
      if (next.terminationFee > 0) {
        entries.push(
          newLedgerEntry(
            'other_out',
            -next.terminationFee,
            `Rescisão patrocínio ${sponsorTierLabel(next.tier)}: ${next.brand}`,
            input.season,
            undefined,
            input.gameDate,
          ),
        );
      }
      return { ...next, status: 'terminated' as const, seasonsRemaining: 0 };
    }

    const remaining = Math.max(0, next.seasonsRemaining - 1);
    return {
      ...next,
      seasonsRemaining: remaining,
      status: remaining <= 0 ? ('expired' as const) : ('active' as const),
    };
  });

  return { sponsors, entries };
}

export function renewSponsor(sponsor: ClubSponsor, extraSeasons = 1): ClubSponsor {
  const add = Math.max(1, Math.round(extraSeasons));
  return {
    ...sponsor,
    seasonsRemaining: Math.max(0, sponsor.seasonsRemaining) + add,
    seasonsTotal: sponsor.seasonsTotal + add,
    status: 'active',
  };
}
