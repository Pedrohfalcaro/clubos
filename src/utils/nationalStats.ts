/**
 * Estatísticas consolidadas da Seleção Nacional (v1.4, Fase 6).
 * `recomputeNationalPlayerStats` segue a mesma disciplina de `recomputeNationalDuty`
 * (utils/nationalWindows.ts): recálculo integral a partir da fonte de verdade
 * (`windows[].games[].performances`), nunca incremento — editar um jogo já
 * registrado recalcula certo, sem duplicar.
 */

import type { PlayerPosition } from '../types/Player';
import type { MatchLocation } from '../types/Match';
import type { NationalPlayerStats, NationalTeamState } from '../types/NationalTeam';
import { emptyNationalPlayerStats } from '../types/NationalTeam';
import type { NationalPlayer, NationalMatchPerformance } from '../types/NationalTeam';
import { calcResult } from './matchStats';

function accumulate(stats: NationalPlayerStats, perf: NationalMatchPerformance): NationalPlayerStats {
  return {
    matches: stats.matches + 1,
    minutes: stats.minutes + perf.minutes,
    goals: stats.goals + perf.goals,
    assists: stats.assists + perf.assists,
    ratingSum: stats.ratingSum + (perf.rating ?? 0),
    ratingCount: stats.ratingCount + (perf.rating != null ? 1 : 0),
  };
}

/** Recalcula `NationalPlayer.stats` de todo o banco de talentos a partir de todos os jogos jogados. */
export function recomputeNationalPlayerStats(nationalTeam: NationalTeamState): NationalPlayer[] {
  const agg = new Map<string, NationalPlayerStats>();
  for (const w of nationalTeam.windows) {
    for (const g of w.games) {
      if (!g.played || !g.performances) continue;
      for (const perf of g.performances) {
        agg.set(perf.nationalPlayerId, accumulate(agg.get(perf.nationalPlayerId) ?? emptyNationalPlayerStats(), perf));
      }
    }
  }
  return nationalTeam.talentPool.map(p => {
    const stats = agg.get(p.id) ?? emptyNationalPlayerStats();
    if (
      stats.matches === p.stats.matches &&
      stats.minutes === p.stats.minutes &&
      stats.goals === p.stats.goals &&
      stats.assists === p.stats.assists &&
      stats.ratingSum === p.stats.ratingSum &&
      stats.ratingCount === p.stats.ratingCount
    ) {
      return p;
    }
    return { ...p, stats };
  });
}

export interface CallUpOverviewRow {
  nationalPlayerId: string;
  name: string;
  position: PlayerPosition;
  club: string;
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  avgRating: number | null;
}

function toRow(p: NationalPlayer, stats: NationalPlayerStats): CallUpOverviewRow {
  return {
    nationalPlayerId: p.id,
    name: p.name,
    position: p.position,
    club: p.club,
    matches: stats.matches,
    minutes: stats.minutes,
    goals: stats.goals,
    assists: stats.assists,
    avgRating: stats.ratingCount > 0 ? stats.ratingSum / stats.ratingCount : null,
  };
}

/**
 * Tabela consolidada para a "Visão Geral de Convocados".
 * Sem `windowId`: totais acumulados na era do treinador (`NationalPlayer.stats`).
 * Com `windowId`: recalcula só a partir dos jogos daquela Data FIFA.
 */
export function aggregateCallUpOverview(
  nationalTeam: NationalTeamState,
  windowId?: string | null,
): CallUpOverviewRow[] {
  if (!windowId) {
    return nationalTeam.talentPool
      .filter(p => p.stats.matches > 0)
      .map(p => toRow(p, p.stats));
  }
  const window = nationalTeam.windows.find(w => w.id === windowId);
  if (!window) return [];
  const agg = new Map<string, NationalPlayerStats>();
  for (const g of window.games) {
    if (!g.played || !g.performances) continue;
    for (const perf of g.performances) {
      agg.set(perf.nationalPlayerId, accumulate(agg.get(perf.nationalPlayerId) ?? emptyNationalPlayerStats(), perf));
    }
  }
  return nationalTeam.talentPool
    .filter(p => agg.has(p.id))
    .map(p => toRow(p, agg.get(p.id)!));
}

export interface NationalPlayerMatchHistoryEntry {
  gameId: string;
  windowId: string;
  windowLabel: string;
  date: string;
  opponent: string;
  location: MatchLocation;
  goalsFor: number;
  goalsAgainst: number;
  result: 'win' | 'draw' | 'loss';
  /** Teve participação registrada (`performances`) — convocado sem entrar em campo fica com `false`. */
  played: boolean;
  rating: number | null;
  minutes: number;
  goals: number;
  assists: number;
  yellowCard: boolean;
  redCard: boolean;
}

/**
 * Histórico de jogos pela Seleção de um convocado — todos os jogos já disputados nas
 * Datas FIFA em que ele esteve na lista (`callUpIds`), mais recente primeiro. Jogos em
 * que ele foi convocado mas não tem `performance` registrada entram com `played: false`.
 */
export function getNationalPlayerMatchHistory(
  nationalPlayerId: string,
  nationalTeam: NationalTeamState,
): NationalPlayerMatchHistoryEntry[] {
  const entries: NationalPlayerMatchHistoryEntry[] = [];
  for (const w of nationalTeam.windows) {
    if (!w.callUpIds.includes(nationalPlayerId)) continue;
    for (const g of w.games) {
      if (!g.played) continue;
      const perf = g.performances?.find(p => p.nationalPlayerId === nationalPlayerId);
      const ratingEntry = g.playerRatings?.find(r => r.playerId === nationalPlayerId);
      const goalsFor = g.goalsFor ?? 0;
      const goalsAgainst = g.goalsAgainst ?? 0;
      entries.push({
        gameId: g.id,
        windowId: w.id,
        windowLabel: w.label,
        date: g.date,
        opponent: g.opponent,
        location: g.location,
        goalsFor,
        goalsAgainst,
        result: calcResult(goalsFor, goalsAgainst),
        played: !!perf,
        rating: ratingEntry?.rating ?? null,
        minutes: perf?.minutes ?? 0,
        goals: perf?.goals ?? 0,
        assists: perf?.assists ?? 0,
        yellowCard: perf?.yellowCard ?? false,
        redCard: perf?.redCard ?? false,
      });
    }
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
