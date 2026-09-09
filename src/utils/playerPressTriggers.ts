import type { Match } from '../types/Match';
import type { LiveLifeMeta } from '../types/LiveLife';

/** Partida de hoje sem coletiva pré-jogo ainda feita. */
export function findPlayerPreMatchOpportunity(input: {
  matches: Match[];
  currentDate: string | null | undefined;
  livelife: LiveLifeMeta;
}): Match | null {
  const today = input.currentDate?.slice(0, 10);
  if (!today) return null;
  const todayMatch = input.matches.find(
    m => m.status === 'scheduled' && m.date.slice(0, 10) === today,
  );
  if (!todayMatch) return null;
  const done = (input.livelife.pressPreDoneDates ?? []).includes(todayMatch.date.slice(0, 10));
  return done ? null : todayMatch;
}

/** Última partida concluída sem coletiva pós-jogo ainda feita. */
export function findPlayerPostMatchOpportunity(input: {
  matches: Match[];
  livelife: LiveLifeMeta;
}): Match | null {
  const lastCompleted = input.matches
    .filter(m => m.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!lastCompleted) return null;
  const done = (input.livelife.pressPostDoneMatchIds ?? []).includes(lastCompleted.id);
  return done ? null : lastCompleted;
}
