import { PLAYER_POSITIONS } from '../types/Player';
import type { PlayerPosition } from '../types/Player';

/** Um jogador dentro do JSON de importação — só `name`/`position` são obrigatórios. */
export interface SeasonImportPlayer {
  name: string;
  position: PlayerPosition;
  age?: number;
  overall?: number;
  matches?: number;
  minutes?: number;
  goals?: number;
  assists?: number;
  cleanSheets?: number;
  yellowCards?: number;
  redCards?: number;
}

/** Dados de time da temporada — tudo opcional. */
export interface SeasonImportTeam {
  matches?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  boardConfidence?: number;
  supporterConfidence?: number;
  balance?: number;
  income?: number;
  expense?: number;
  transferCount?: number;
}

export interface SeasonImportPayload {
  season: number;
  team?: SeasonImportTeam;
  players: SeasonImportPlayer[];
}

export interface SeasonImportError {
  path: string;
  message: string;
}

const POSITION_SET = new Set<string>(PLAYER_POSITIONS);
const TEAM_NUMERIC_FIELDS = [
  'matches', 'wins', 'draws', 'losses', 'goalsFor', 'goalsAgainst',
  'boardConfidence', 'supporterConfidence', 'balance', 'income', 'expense', 'transferCount',
] as const satisfies readonly (keyof SeasonImportTeam)[];
const PLAYER_NUMERIC_FIELDS = [
  'age', 'overall', 'matches', 'minutes', 'goals', 'assists', 'cleanSheets', 'yellowCards', 'redCards',
] as const satisfies readonly (keyof SeasonImportPlayer)[];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Valida e normaliza o JSON colado/enviado pelo usuário. Não lança — devolve os erros
 * encontrados (um por campo problemático) para exibir na UI, ou o payload já validado.
 */
export function parseSeasonImport(
  raw: unknown,
): { payload: SeasonImportPayload; errors: [] } | { payload: null; errors: SeasonImportError[] } {
  const errors: SeasonImportError[] = [];

  if (!isRecord(raw)) {
    return { payload: null, errors: [{ path: '$', message: 'O arquivo precisa ser um objeto JSON.' }] };
  }

  const season = raw.season;
  if (typeof season !== 'number' || !Number.isFinite(season) || season < 1900 || season > 3000) {
    errors.push({ path: 'season', message: '"season" é obrigatório e deve ser um número de temporada (ex: 2026).' });
  }

  let team: SeasonImportTeam | undefined;
  if (raw.team !== undefined) {
    if (!isRecord(raw.team)) {
      errors.push({ path: 'team', message: '"team", se presente, precisa ser um objeto.' });
    } else {
      team = {};
      for (const field of TEAM_NUMERIC_FIELDS) {
        const v = raw.team[field];
        if (v === undefined || v === null) continue;
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          errors.push({ path: `team.${field}`, message: 'deve ser um número.' });
          continue;
        }
        team[field] = v;
      }
    }
  }

  const rawPlayers = raw.players;
  if (rawPlayers !== undefined && !Array.isArray(rawPlayers)) {
    errors.push({ path: 'players', message: '"players", se presente, precisa ser uma lista.' });
  }

  const players: SeasonImportPlayer[] = [];
  if (Array.isArray(rawPlayers)) {
    rawPlayers.forEach((rawPlayer, i) => {
      if (!isRecord(rawPlayer)) {
        errors.push({ path: `players[${i}]`, message: 'cada jogador precisa ser um objeto.' });
        return;
      }
      const name = typeof rawPlayer.name === 'string' ? rawPlayer.name.trim() : '';
      if (!name) {
        errors.push({ path: `players[${i}].name`, message: '"name" é obrigatório.' });
      }
      const positionRaw = typeof rawPlayer.position === 'string' ? rawPlayer.position.trim().toUpperCase() : '';
      if (!POSITION_SET.has(positionRaw)) {
        errors.push({
          path: `players[${i}].position`,
          message: `"position" é obrigatório e deve ser uma destas: ${PLAYER_POSITIONS.join(', ')}.`,
        });
      }
      if (!name || !POSITION_SET.has(positionRaw)) return;

      const numeric: Partial<Record<(typeof PLAYER_NUMERIC_FIELDS)[number], number>> = {};
      for (const field of PLAYER_NUMERIC_FIELDS) {
        const v = rawPlayer[field];
        if (v === undefined || v === null) continue;
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          errors.push({ path: `players[${i}].${field}`, message: 'deve ser um número.' });
          continue;
        }
        numeric[field] = v;
      }
      players.push({ name, position: positionRaw as PlayerPosition, ...numeric });
    });
  }

  if (errors.length) return { payload: null, errors };

  return { payload: { season: season as number, team, players }, errors: [] };
}

export const SEASON_IMPORT_EXAMPLE: SeasonImportPayload = {
  season: 2026,
  team: {
    matches: 30,
    wins: 18,
    draws: 6,
    losses: 6,
    goalsFor: 55,
    goalsAgainst: 30,
    boardConfidence: 70,
    supporterConfidence: 65,
    balance: 1_200_000,
    income: 5_000_000,
    expense: 4_000_000,
    transferCount: 4,
  },
  players: [
    {
      name: 'João Silva',
      position: 'ST',
      age: 24,
      overall: 78,
      matches: 28,
      minutes: 2400,
      goals: 20,
      assists: 5,
      cleanSheets: 0,
      yellowCards: 3,
      redCards: 0,
    },
    {
      name: 'Carlos Souza',
      position: 'GK',
    },
  ],
};

export function downloadSeasonImportTemplate(): void {
  const blob = new Blob([JSON.stringify(SEASON_IMPORT_EXAMPLE, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clubos-modelo-temporada.json';
  a.click();
  URL.revokeObjectURL(url);
}
