import type { Team, World } from './types.ts';

export interface TeamStats {
  /** finalizações (total e no alvo) */
  shots: number;
  shotsOn: number;
  /** passes tentados e certos */
  passes: number;
  passesOk: number;
  /** posse de bola, em % */
  possession: number;
  corners: number;
  fouls: number;
  yellows: number;
  reds: number;
  offsides: number;
}

/** Estatísticas coletivas, somando quem está em campo e quem já saiu. */
export function teamStats(w: World): Record<Team, TeamStats> {
  const total = w.possTime.a + w.possTime.b;
  const out = {} as Record<Team, TeamStats>;
  for (const team of ['a', 'b'] as const) {
    const s: TeamStats = {
      shots: 0,
      shotsOn: 0,
      passes: 0,
      passesOk: 0,
      possession: total > 0 ? Math.round((w.possTime[team] / total) * 100) : 50,
      corners: w.events.filter(e => e.type === 'corner' && e.team === team).length,
      fouls: 0,
      yellows: 0,
      reds: 0,
      offsides: 0,
    };
    for (const a of [...w.byTeam[team], ...w.subbedOut.filter(o => o.team === team)]) {
      s.shots += a.stats.shotsOn + a.stats.shotsOff;
      s.shotsOn += a.stats.shotsOn;
      s.passes += a.stats.passesOk + a.stats.passesBad;
      s.passesOk += a.stats.passesOk;
      s.fouls += a.stats.fouls;
      s.yellows += a.stats.yellows;
      s.reds += a.stats.reds;
      s.offsides += a.stats.offsides;
    }
    out[team] = s;
  }
  return out;
}
