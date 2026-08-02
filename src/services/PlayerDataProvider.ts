/**
 * PlayerDataProvider — API-Football (api-sports.io)
 *
 * URL: https://v3.football.api-sports.io/
 * Header: x-apisports-key
 * Ative com VITE_API_FOOTBALL_KEY no .env
 */

import type { WatchlistPlayer } from '../types/Transfer';
import type { PlayerPosition } from '../types/Player';

export interface ExternalPlayerFilter {
  name?: string;
  position?: string;
  minAge?: number;
  maxAge?: number;
  nationality?: string;
  team?: string;
  /** Ano da temporada do jogo. */
  seasonYear?: number;
  /** ID da liga API-Football (ex.: 71 = Brasileirão). */
  leagueId?: number;
}

export interface ExternalPlayer {
  id: string;
  provider: string;
  name: string;
  position: string;
  age?: number;
  birthDate?: string;
  overallEstimate?: number;
  clubName: string;
  nationality?: string;
  marketValue?: number;
  photoUrl?: string;
}

export interface PlayerDataProvider {
  searchPlayers(filters: ExternalPlayerFilter): Promise<ExternalPlayer[]>;
  getPlayer(id: string, seasonYear?: number): Promise<ExternalPlayer | null>;
}

const POS_MAP: Record<string, PlayerPosition> = {
  Goalkeeper: 'GK',
  goalkeeper: 'GK',
  Defender: 'CB',
  defender: 'CB',
  Midfielder: 'CM',
  midfielder: 'CM',
  Attacker: 'ST',
  attacker: 'ST',
  Forward: 'ST',
  forward: 'ST',
};

const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1h — poupa cota do plano free

export function mapApiPosition(raw?: string | null): string {
  if (!raw) return 'CM';
  return POS_MAP[raw] ?? POS_MAP[raw.toLowerCase()] ?? 'CM';
}

export function ageFromBirthDate(
  birthDate: string | undefined,
  seasonYear: number,
): number | undefined {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}/.test(birthDate)) return undefined;
  const birthYear = Number(birthDate.slice(0, 4));
  if (!birthYear) return undefined;
  return Math.max(14, Math.min(50, seasonYear - birthYear));
}

export function externalToWatchlist(ext: ExternalPlayer): Omit<WatchlistPlayer, 'id'> {
  return {
    name: ext.name,
    position: ext.position,
    age: ext.age,
    birthDate: ext.birthDate,
    overall: ext.overallEstimate,
    clubName: ext.clubName,
    marketValue: ext.marketValue,
    nationality: ext.nationality,
    photoUrl: ext.photoUrl,
    externalRef: { provider: ext.provider, id: ext.id },
  };
}

export class NullPlayerDataProvider implements PlayerDataProvider {
  async searchPlayers(_filters: ExternalPlayerFilter): Promise<ExternalPlayer[]> {
    return [];
  }

  async getPlayer(_id: string): Promise<ExternalPlayer | null> {
    return null;
  }
}

type ApiProfilePlayer = {
  id: number;
  name: string;
  age?: number;
  birth?: { date?: string };
  nationality?: string;
  photo?: string;
  position?: string;
};

type ApiSeasonPlayer = {
  player: {
    id: number;
    name: string;
    age?: number;
    birth?: { date?: string };
    nationality?: string;
    photo?: string;
  };
  statistics?: Array<{
    team?: { name?: string };
    games?: { position?: string };
  }>;
};

export class ApiFootballProvider implements PlayerDataProvider {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://v3.football.api-sports.io';

  constructor(apiKey: string) {
    this.apiKey = apiKey.trim();
  }

  private headers(): HeadersInit {
    return {
      'x-apisports-key': this.apiKey,
      Accept: 'application/json',
    };
  }

  private async getJson<T>(path: string): Promise<T> {
    const cached = cache.get(path);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.data as T;
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`API-Football HTTP ${res.status}`);
    }
    const data = (await res.json()) as T & { errors?: unknown };
    // API às vezes devolve 200 com errors no body
    const errors = (data as { errors?: Record<string, string> | string[] }).errors;
    if (errors && (Array.isArray(errors) ? errors.length : Object.keys(errors).length)) {
      const msg = Array.isArray(errors) ? errors.join(', ') : Object.values(errors).join(', ');
      throw new Error(msg || 'Erro API-Football');
    }
    cache.set(path, { at: Date.now(), data });
    return data;
  }

  async searchPlayers(filters: ExternalPlayerFilter): Promise<ExternalPlayer[]> {
    if (!this.apiKey) return [];
    const q = (filters.name ?? '').trim();
    if (q.length < 3) return [];

    const seasonYear = filters.seasonYear ?? new Date().getFullYear();

    // 1) Perfis por sobrenome/nome (não exige league)
    const path = `/players/profiles?search=${encodeURIComponent(q)}`;
    const data = await this.getJson<{ response?: Array<{ player: ApiProfilePlayer }> }>(path);
    let list = (data.response ?? []).map(item => this.fromProfile(item.player, seasonYear));

    // 2) Se tiver liga, tenta complementar via /players?search=&league=&season=
    if (filters.leagueId) {
      try {
        const seasonPath =
          `/players?search=${encodeURIComponent(q)}` +
          `&league=${filters.leagueId}&season=${seasonYear}`;
        const sdata = await this.getJson<{ response?: ApiSeasonPlayer[] }>(seasonPath);
        const byId = new Map(list.map(p => [p.id, p]));
        for (const item of sdata.response ?? []) {
          const mapped = this.fromSeason(item, seasonYear);
          byId.set(mapped.id, { ...byId.get(mapped.id), ...mapped });
        }
        list = [...byId.values()];
      } catch {
        // mantém perfis
      }
    }

    if (filters.nationality?.trim()) {
      const nat = filters.nationality.trim().toLowerCase();
      list = list.filter(p => (p.nationality ?? '').toLowerCase().includes(nat));
    }
    if (filters.position?.trim()) {
      const pos = filters.position.trim().toUpperCase();
      list = list.filter(p => p.position === pos || p.position.includes(pos));
    }
    if (filters.minAge != null) list = list.filter(p => (p.age ?? 99) >= filters.minAge!);
    if (filters.maxAge != null) list = list.filter(p => (p.age ?? 0) <= filters.maxAge!);
    if (filters.team?.trim()) {
      const t = filters.team.trim().toLowerCase();
      list = list.filter(p => p.clubName.toLowerCase().includes(t));
    }

    return list.slice(0, 20);
  }

  async getPlayer(id: string, seasonYear = new Date().getFullYear()): Promise<ExternalPlayer | null> {
    if (!this.apiKey) return null;

    let base: ExternalPlayer | null = null;
    try {
      const pdata = await this.getJson<{ response?: Array<{ player: ApiProfilePlayer }> }>(
        `/players/profiles?player=${encodeURIComponent(id)}`,
      );
      const p = pdata.response?.[0]?.player;
      if (p) base = this.fromProfile(p, seasonYear);
    } catch {
      /* ignore */
    }

    try {
      const sdata = await this.getJson<{ response?: ApiSeasonPlayer[] }>(
        `/players?id=${encodeURIComponent(id)}&season=${seasonYear}`,
      );
      const item = sdata.response?.[0];
      if (item) {
        const seasonPlayer = this.fromSeason(item, seasonYear);
        base = base ? { ...base, ...seasonPlayer, clubName: seasonPlayer.clubName || base.clubName } : seasonPlayer;
      }
    } catch {
      /* ignore */
    }

    return base;
  }

  private fromProfile(p: ApiProfilePlayer, seasonYear: number): ExternalPlayer {
    const birth = p.birth?.date;
    return {
      id: String(p.id),
      provider: 'api-football',
      name: p.name,
      position: mapApiPosition(p.position),
      birthDate: birth,
      age: ageFromBirthDate(birth, seasonYear) ?? p.age,
      clubName: '—',
      nationality: p.nationality,
      photoUrl: p.photo,
    };
  }

  private fromSeason(item: ApiSeasonPlayer, seasonYear: number): ExternalPlayer {
    const birth = item.player.birth?.date;
    return {
      id: String(item.player.id),
      provider: 'api-football',
      name: item.player.name,
      position: mapApiPosition(item.statistics?.[0]?.games?.position),
      birthDate: birth,
      age: ageFromBirthDate(birth, seasonYear) ?? item.player.age,
      clubName: item.statistics?.[0]?.team?.name ?? '—',
      nationality: item.player.nationality,
      photoUrl: item.player.photo,
    };
  }
}

export function createPlayerDataProvider(): PlayerDataProvider {
  const key = (import.meta.env.VITE_API_FOOTBALL_KEY as string | undefined)?.trim();
  if (key) return new ApiFootballProvider(key);
  return new NullPlayerDataProvider();
}

export function hasApiFootballKey(): boolean {
  return Boolean((import.meta.env.VITE_API_FOOTBALL_KEY as string | undefined)?.trim());
}
