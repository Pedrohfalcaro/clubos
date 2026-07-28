/**
 * PlayerDataProvider — Phase E adapter interface
 *
 * V1: stub only. No API calls are made; ClubOS is fully playable offline.
 * Phase E will implement ApiFootballProvider backed by VITE_API_FOOTBALL_KEY.
 *
 * Usage (future):
 *   const provider = new ApiFootballProvider(import.meta.env.VITE_API_FOOTBALL_KEY);
 *   const results = await provider.searchPlayers({ name: 'Messi' });
 */

import type { WatchlistPlayer } from '../types/Transfer';

export interface ExternalPlayerFilter {
  name?: string;
  position?: string;
  minAge?: number;
  maxAge?: number;
  nationality?: string;
}

export interface ExternalPlayer {
  /** Provider-specific ID */
  id: string;
  provider: string;
  name: string;
  position: string;
  age?: number;
  /** Estimated from provider or user-provided heuristic */
  overallEstimate?: number;
  clubName: string;
  nationality?: string;
  marketValue?: number;
}

export interface PlayerDataProvider {
  /**
   * Search for players matching the given filters.
   * Returns at most 20 results.
   */
  searchPlayers(filters: ExternalPlayerFilter): Promise<ExternalPlayer[]>;

  /**
   * Fetch detailed data for a single player.
   */
  getPlayer(id: string): Promise<ExternalPlayer | null>;
}

/**
 * Convert an ExternalPlayer to a WatchlistPlayer draft.
 * The ID is intentionally not carried over — a new WatchlistPlayer id is assigned at insertion.
 */
export function externalToWatchlist(ext: ExternalPlayer): Omit<WatchlistPlayer, 'id'> {
  return {
    name: ext.name,
    position: ext.position,
    age: ext.age,
    overall: ext.overallEstimate,
    clubName: ext.clubName,
    marketValue: ext.marketValue,
    externalRef: { provider: ext.provider, id: ext.id },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Null provider (default offline stub)
// ─────────────────────────────────────────────────────────────────────────────

export class NullPlayerDataProvider implements PlayerDataProvider {
  async searchPlayers(_filters: ExternalPlayerFilter): Promise<ExternalPlayer[]> {
    return [];
  }

  async getPlayer(_id: string): Promise<ExternalPlayer | null> {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase E: API-Football provider skeleton (not wired up)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * To activate:
 * 1. Set VITE_API_FOOTBALL_KEY in your .env
 * 2. Replace NullPlayerDataProvider with ApiFootballProvider in the Transfers watchlist UI
 *
 * Free tier limits: 100 requests/day on api-sports.io
 */
export class ApiFootballProvider implements PlayerDataProvider {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://v3.football.api-sports.io';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchPlayers(filters: ExternalPlayerFilter): Promise<ExternalPlayer[]> {
    if (!this.apiKey || !filters.name) return [];
    const url = `${this.baseUrl}/players?search=${encodeURIComponent(filters.name ?? '')}&league=71&season=2024`;
    const res = await fetch(url, { headers: { 'x-apisports-key': this.apiKey } });
    if (!res.ok) return [];
    const data = await res.json() as { response?: Array<{ player: { id: number; name: string; age: number; nationality: string }; statistics: Array<{ team: { name: string }; games: { position: string } }> }> };
    return (data.response ?? []).slice(0, 20).map(item => ({
      id: String(item.player.id),
      provider: 'api-football',
      name: item.player.name,
      position: item.statistics[0]?.games?.position ?? 'Forward',
      age: item.player.age,
      clubName: item.statistics[0]?.team?.name ?? '',
      nationality: item.player.nationality,
    }));
  }

  async getPlayer(id: string): Promise<ExternalPlayer | null> {
    if (!this.apiKey) return null;
    const url = `${this.baseUrl}/players?id=${id}&season=2024`;
    const res = await fetch(url, { headers: { 'x-apisports-key': this.apiKey } });
    if (!res.ok) return null;
    const data = await res.json() as { response?: Array<{ player: { id: number; name: string; age: number; nationality: string }; statistics: Array<{ team: { name: string }; games: { position: string } }> }> };
    const item = data.response?.[0];
    if (!item) return null;
    return {
      id: String(item.player.id),
      provider: 'api-football',
      name: item.player.name,
      position: item.statistics[0]?.games?.position ?? 'Forward',
      age: item.player.age,
      clubName: item.statistics[0]?.team?.name ?? '',
      nationality: item.player.nationality,
    };
  }
}
