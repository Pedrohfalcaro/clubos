import type { Currency, PrizeTableEntry, StadiumConfig, ClubFinance } from '../types/Finance';
import type { SeasonCompetition, CompetitionType } from '../types/Competition';
import type { Player } from '../types/Player';
import type { Team } from '../types/Team';
import { isStadiumConfigured } from './finance';

/** Multiplicador relativo ao Real para templates “realistas”. */
const CURRENCY_SCALE: Record<Currency, number> = {
  BRL: 1,
  EUR: 0.18,
  GBP: 0.15,
  USD: 0.2,
};

function scale(amountBrl: number, currency: Currency): number {
  const scaled = Math.round(amountBrl * CURRENCY_SCALE[currency]);
  if (scaled <= 0) return amountBrl >= 1 ? 1 : 0;
  // Arredonda para milhares em valores altos
  if (scaled >= 10_000) return Math.round(scaled / 1000) * 1000;
  if (scaled >= 1000) return Math.round(scaled / 100) * 100;
  return scaled;
}

export function stadiumTemplate(currency: Currency = 'BRL'): StadiumConfig {
  switch (currency) {
    case 'EUR':
      return {
        capacity: 35_000,
        ticketPriceHome: 25,
        ticketPriceAway: 12,
        maintenanceCostPerMatch: 45_000,
        travelCostAverage: 30_000,
      };
    case 'GBP':
      return {
        capacity: 32_000,
        ticketPriceHome: 30,
        ticketPriceAway: 15,
        maintenanceCostPerMatch: 40_000,
        travelCostAverage: 25_000,
      };
    case 'USD':
      return {
        capacity: 40_000,
        ticketPriceHome: 35,
        ticketPriceAway: 18,
        maintenanceCostPerMatch: 55_000,
        travelCostAverage: 35_000,
      };
    case 'BRL':
    default:
      return {
        capacity: 40_000,
        ticketPriceHome: 40,
        ticketPriceAway: 20,
        maintenanceCostPerMatch: 80_000,
        travelCostAverage: 50_000,
      };
  }
}

/** Premiação template por tipo de competição (valores base em BRL, convertidos). */
export function prizeTemplate(
  currency: Currency,
  type: CompetitionType = 'league',
): PrizeTableEntry {
  const base: Record<CompetitionType, Required<PrizeTableEntry>> = {
    league: { win: 500_000, draw: 200_000, knockout: 0, champion: 8_000_000 },
    cup: { win: 350_000, draw: 120_000, knockout: 1_500_000, champion: 6_000_000 },
    continental: { win: 800_000, draw: 300_000, knockout: 3_000_000, champion: 15_000_000 },
    state: { win: 120_000, draw: 40_000, knockout: 400_000, champion: 1_500_000 },
    friendly: { win: 50_000, draw: 20_000, knockout: 0, champion: 0 },
    other: { win: 200_000, draw: 80_000, knockout: 500_000, champion: 2_000_000 },
  };
  const b = base[type] ?? base.other;
  const entry: PrizeTableEntry = {
    win: scale(b.win, currency),
    draw: scale(b.draw, currency),
  };
  if (b.knockout > 0) entry.knockout = scale(b.knockout, currency);
  if (b.champion > 0) entry.champion = scale(b.champion, currency);
  return entry;
}

export function buildPrizeTableForCompetitions(
  competitions: SeasonCompetition[],
  currency: Currency,
  existing?: Record<string, PrizeTableEntry>,
): Record<string, PrizeTableEntry> {
  const table: Record<string, PrizeTableEntry> = { ...(existing ?? {}) };
  for (const comp of competitions) {
    const cur = table[comp.name];
    const hasAny =
      cur &&
      ((cur.win ?? 0) > 0 ||
        (cur.draw ?? 0) > 0 ||
        (cur.knockout ?? 0) > 0 ||
        (cur.champion ?? 0) > 0);
    if (!hasAny) {
      table[comp.name] = prizeTemplate(currency, comp.type);
    }
  }
  return table;
}

/** Garante estádio + premiações template quando vazios. */
export function seedLiveLifeFinance(
  finance: ClubFinance,
  competitions: SeasonCompetition[],
): ClubFinance {
  const currency = finance.currency ?? 'BRL';
  const stadiumConfig = isStadiumConfigured(finance.stadiumConfig)
    ? finance.stadiumConfig
    : stadiumTemplate(currency);
  const prizeTable = buildPrizeTableForCompetitions(
    competitions,
    currency,
    finance.prizeTable,
  );
  return {
    ...finance,
    currency,
    stadiumConfig,
    prizeTable,
  };
}

export type LiveLifeGapId = 'stadium' | 'prizes' | 'salaries' | 'fans' | 'calendar';

export interface LiveLifeGap {
  id: LiveLifeGapId;
  title: string;
  detail: string;
  href: string;
  ok: boolean;
}

export function analyzeLiveLifeGaps(input: {
  finance: ClubFinance;
  competitions: SeasonCompetition[];
  players: Player[];
  team: Team | null;
  currentDate: string | null;
}): LiveLifeGap[] {
  const { finance, competitions, players, team, currentDate } = input;
  const stadiumOk = isStadiumConfigured(finance.stadiumConfig);

  const compsWithoutPrize = competitions.filter(c => {
    const p = finance.prizeTable[c.name];
    if (!p) return true;
    return !((p.win ?? 0) > 0 || (p.draw ?? 0) > 0 || (p.knockout ?? 0) > 0 || (p.champion ?? 0) > 0);
  });

  const unpaid = players.filter(p => p.status !== 'Aposentado' && !(p.salary && p.salary > 0));
  const fansOk = (team?.fans ?? 0) > 0;

  return [
    {
      id: 'calendar',
      title: 'Calendário LiveLife',
      detail: currentDate
        ? `Ativo desde ${currentDate.split('-').reverse().join('/')}`
        : 'Ative a data base da carreira na Diretoria',
      href: '/diretoria',
      ok: !!currentDate,
    },
    {
      id: 'stadium',
      title: 'Estádio / bilheteria',
      detail: stadiumOk
        ? `Capacidade ${finance.stadiumConfig!.capacity.toLocaleString('pt-BR')}`
        : 'Configure capacidade e preços na aba Estádio',
      href: '/financas',
      ok: stadiumOk,
    },
    {
      id: 'prizes',
      title: 'Premiações',
      detail:
        compsWithoutPrize.length === 0
          ? `${competitions.length} competição(ões) com valores`
          : `Falta premiação em: ${compsWithoutPrize.map(c => c.name).join(', ')}`,
      href: '/financas',
      ok: competitions.length > 0 && compsWithoutPrize.length === 0,
    },
    {
      id: 'salaries',
      title: 'Salários do elenco',
      detail:
        unpaid.length === 0
          ? 'Todos os atletas ativos têm salário'
          : `${unpaid.length} jogador(es) sem salário — necessário para a folha do dia 5`,
      href: '/squad',
      ok: unpaid.length === 0,
    },
    {
      id: 'fans',
      title: 'Torcida (público)',
      detail: fansOk
        ? `${(team!.fans ?? 0).toLocaleString('pt-BR')} torcedores`
        : 'Defina o número de torcedores na Diretoria — impacta a bilheteria',
      href: '/diretoria',
      ok: fansOk,
    },
  ];
}

/** Minutos por participação em gol: minutos ÷ (G+A), 1 casa decimal. */
export function formatMinutesPerParticipation(
  goals: number,
  assists: number,
  minutes: number,
): string {
  const parts = goals + assists;
  if (minutes <= 0 || parts <= 0) return '—';
  return (minutes / parts).toFixed(1).replace('.', ',');
}

/** % de jogos sem sofrer gol: SG ÷ jogos × 100, 1 casa decimal. */
export function formatCleanSheetPct(cleanSheets: number, matches: number): string {
  if (matches <= 0) return '—';
  return ((cleanSheets / matches) * 100).toFixed(1).replace('.', ',');
}
