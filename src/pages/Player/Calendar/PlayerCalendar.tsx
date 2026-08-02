import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MatchRecapModal from '../../../components/MatchRecapModal/MatchRecapModal';
import MatchScheduleModal from '../../../components/MatchScheduleModal/MatchScheduleModal';
import { useGame } from '../../../context/GameContext';
import type { Match } from '../../../types/Match';
import {
  competitionLabel,
  getInitialCalendarDate,
  locationIcon,
  shortLocation,
} from '../../../utils/calendarHelpers';
import { competitionNames, resolveCompetitionColor } from '../../../utils/competitions';
import { resultLetter } from '../../../utils/matchTimeline';
import styles from '../../Calendar/Calendar.module.css';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function letterClass(result: Match['result']): string {
  if (result === 'win') return styles.letterWin;
  if (result === 'draw') return styles.letterDraw;
  if (result === 'loss') return styles.letterLoss;
  return '';
}

export default function PlayerCalendar() {
  const navigate = useNavigate();
  const { state, schedulePlayerMatch } = useGame();
  const [viewDate, setViewDate] = useState(() =>
    getInitialCalendarDate(state.matches, state.currentDate),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [recapMatch, setRecapMatch] = useState<Match | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const comps = state.seasonCompetitions;

  const matchesByDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of state.matches) {
      const list = map.get(m.date) ?? [];
      list.push(m);
      map.set(m.date, list);
    }
    return map;
  }, [state.matches]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days: Array<{ date: Date | null; key: string }> = [];
    for (let i = 0; i < startPad; i++) days.push({ date: null, key: `pad-${i}` });
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      days.push({ date, key: toDateKey(date) });
    }
    return days;
  }, [year, month]);

  function openSchedule(dateKey: string) {
    setSelectedDate(dateKey);
    setModalOpen(true);
  }

  function handleMatchClick(match: Match) {
    if (match.status === 'completed') {
      setRecapMatch(match);
      return;
    }
    navigate(`/player/match/${match.id}/play`);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Calendário</h1>
        <p className={styles.sub}>Partidas da carreira</p>
      </header>

      <div className={styles.calendarNav}>
        <button type="button" className={styles.navBtn} onClick={() => setViewDate(new Date(year, month - 1, 1))}>←</button>
        <h2 className={styles.monthLabel}>{MONTHS[month]} {year}</h2>
        <button type="button" className={styles.navBtn} onClick={() => setViewDate(new Date(year, month + 1, 1))}>→</button>
      </div>

      <div className={styles.calendar}>
        {WEEKDAYS.map(d => (
          <span key={d} className={styles.weekday}>{d}</span>
        ))}
        {calendarDays.map(({ date, key }) => {
          if (!date) return <div key={key} className={styles.dayEmpty} aria-hidden />;
          const dateKey = toDateKey(date);
          const dayMatches = matchesByDate.get(dateKey) ?? [];
          const isToday = dateKey === toDateKey(new Date());
          const hasMatches = dayMatches.length > 0;

          return (
            <div
              key={key}
              className={[
                styles.day,
                isToday ? styles.dayToday : '',
                hasMatches ? styles.dayHasMatch : '',
              ].filter(Boolean).join(' ')}
            >
              <div className={styles.dayHeader}>
                <span className={styles.dayNum}>{date.getDate()}</span>
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => openSchedule(dateKey)}
                  title="Agendar partida"
                  aria-label={`Agendar em ${dateKey}`}
                >
                  +
                </button>
              </div>
              <div className={styles.dayBody}>
                {dayMatches.map(m => {
                  const color = resolveCompetitionColor(comps, m.competition);
                  const done = m.status === 'completed';
                  const letter = resultLetter(m.result);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={styles.matchCard}
                      style={{ borderLeftColor: color }}
                      onClick={() => handleMatchClick(m)}
                      title={done ? 'Ver resumo' : 'Registrar partida'}
                    >
                      <span className={styles.matchComp} style={{ color }}>
                        {competitionLabel(comps, m.competition)}
                      </span>
                      <span className={styles.matchLoc}>
                        {locationIcon(m.location)} {shortLocation(m.location)}
                      </span>
                      <span className={styles.matchOpp}>{m.opponent}</span>
                      {done ? (
                        <span className={styles.matchScoreRow}>
                          <span className={styles.matchScore}>
                            {m.goalsFor}×{m.goalsAgainst}
                          </span>
                          {letter && (
                            <span className={`${styles.resultLetter} ${letterClass(m.result)}`}>
                              {letter}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className={styles.matchPlayHint}>Jogar</span>
                      )}
                    </button>
                  );
                })}
                {!hasMatches && (
                  <button
                    type="button"
                    className={styles.emptyDayBtn}
                    onClick={() => openSchedule(dateKey)}
                    aria-label={`Agendar em ${dateKey}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <MatchScheduleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={data => schedulePlayerMatch(data)}
        competitions={competitionNames(comps)}
        initialDate={selectedDate || state.currentDate || undefined}
        title="Agendar Partida"
      />

      <MatchRecapModal
        open={!!recapMatch}
        match={recapMatch}
        players={[]}
        teamName={state.careerPlayer?.currentClub?.name}
        onClose={() => setRecapMatch(null)}
        onEdit={
          recapMatch
            ? () => {
                const id = recapMatch.id;
                setRecapMatch(null);
                navigate(`/player/match/${id}/play`);
              }
            : undefined
        }
      />
    </div>
  );
}
