import type { Match, MatchMinute } from '../types/Match';
import { formatMinute, minuteSortValue } from './matchEvents';

export type TimelinePitchSide = 'home' | 'away';

export interface MatchTimelineEvent {
  id: string;
  minute: MatchMinute;
  pitchSide: TimelinePitchSide;
  icon: string;
  title: string;
  assist?: string;
}

function toMinute(base: number, stoppage?: number): MatchMinute {
  return stoppage && stoppage > 0 ? { base, stoppage } : { base };
}

/** Monta a cronologia a partir do Match persistido (gols, cartões, subs, lesões). */
export function buildMatchTimeline(
  match: Match,
  ourPitchSide: TimelinePitchSide = match.location === 'away' ? 'away' : 'home',
): MatchTimelineEvent[] {
  const theirPitchSide: TimelinePitchSide = ourPitchSide === 'home' ? 'away' : 'home';
  const list: MatchTimelineEvent[] = [];

  for (let i = 0; i < (match.goals ?? []).length; i++) {
    const g = match.goals[i];
    const minute = toMinute(g.minute, g.stoppage);
    if (g.isOwnGoal) {
      // Autogol do adversário a nosso favor — conta no NOSSO placar, então
      // aparece do NOSSO lado da cronologia (com ícone distinto de "contra").
      list.push({
        id: `og-${i}`,
        minute,
        pitchSide: ourPitchSide,
        icon: '🔴⚽',
        title: `${g.opponentScorerName?.trim() || 'Gol contra'} (contra)`,
      });
    } else {
      list.push({
        id: `g-${i}`,
        minute,
        pitchSide: ourPitchSide,
        icon: g.isPenalty ? '🎯' : '⚽',
        title: g.isPenalty ? `${g.playerName || '—'} (P)` : (g.playerName || '—'),
        assist: g.assistPlayerName?.trim() || undefined,
      });
    }
  }

  // Gols do adversário — estruturados (minuto real), com fallback pro texto legado sem minuto
  if (match.opponentGoals?.length) {
    match.opponentGoals.forEach((g, i) => {
      list.push({
        id: `opp-${i}`,
        minute: g.minute,
        pitchSide: theirPitchSide,
        icon: '⚽',
        title: g.scorerName || '—',
        assist: g.assistName?.trim() || undefined,
      });
    });
  } else {
    const oppText = match.opponentGoalScorers?.trim();
    if (oppText) {
      const names = oppText.split(/[,;]/).map(s => s.trim()).filter(Boolean);
      names.forEach((name, i) => {
        list.push({
          id: `opp-${i}`,
          minute: { base: 0 },
          pitchSide: theirPitchSide,
          icon: '⚽',
          title: name,
        });
      });
    }
  }

  for (let i = 0; i < (match.cards ?? []).length; i++) {
    const c = match.cards[i];
    list.push({
      id: `c-${i}`,
      minute: toMinute(c.minute, c.stoppage),
      pitchSide: ourPitchSide,
      icon: c.type === 'yellow' ? '🟨' : '🟥',
      title: c.playerName,
    });
  }

  for (let i = 0; i < (match.opponentCards ?? []).length; i++) {
    const c = match.opponentCards![i];
    list.push({
      id: `opp-c-${i}`,
      minute: c.minute,
      pitchSide: theirPitchSide,
      icon: c.type === 'yellow' ? '🟨' : '🟥',
      title: c.playerName || '—',
    });
  }

  for (let i = 0; i < (match.opponentSubs ?? []).length; i++) {
    const s = match.opponentSubs![i];
    list.push({
      id: `opp-s-${i}`,
      minute: s.minute,
      pitchSide: theirPitchSide,
      icon: '⇅',
      title: `${s.playerIn || '—'} ← ${s.playerOut || '—'}`,
    });
  }

  for (const s of match.substitutions ?? []) {
    if (s.side === 'team') {
      list.push({
        id: s.id,
        minute: s.minute,
        pitchSide: ourPitchSide,
        icon: '⇅',
        title: `${s.playerInName} ← ${s.playerOutName}`,
      });
    } else {
      list.push({
        id: s.id,
        minute: s.minute,
        pitchSide: theirPitchSide,
        icon: '⇅',
        title: `${s.opponentPlayerIn ?? s.playerInName} ← ${s.opponentPlayerOut ?? s.playerOutName}`,
      });
    }
  }

  for (const inj of match.injuries ?? []) {
    list.push({
      id: inj.id,
      minute: inj.minute,
      pitchSide: ourPitchSide,
      icon: '✚',
      title: inj.note ? `${inj.playerName} · ${inj.note}` : inj.playerName,
    });
  }

  return list.sort((a, b) => {
    // Sem minuto (0) vai pro fim entre eventos sem tempo
    const am = a.minute.base === 0 && !a.minute.stoppage ? 99999 : minuteSortValue(a.minute);
    const bm = b.minute.base === 0 && !b.minute.stoppage ? 99999 : minuteSortValue(b.minute);
    return am - bm;
  });
}

export function formatTimelineMinute(m: MatchMinute): string {
  if (m.base === 0 && !m.stoppage) return '—';
  return formatMinute(m);
}

export function resultLetter(result: Match['result']): string {
  if (result === 'win') return 'V';
  if (result === 'draw') return 'E';
  if (result === 'loss') return 'D';
  return '';
}
