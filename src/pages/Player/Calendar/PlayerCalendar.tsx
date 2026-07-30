import { useMemo, useState } from 'react';
import MatchScheduleModal from '../../../components/MatchScheduleModal/MatchScheduleModal';
import { useGame } from '../../../context/GameContext';
import {
  dayPrimaryResult,
  formatMatchDayTitle,
  getInitialCalendarDate,
  locationIcon,
} from '../../../utils/calendarHelpers';
import { competitionNames, resolveCompetitionColor } from '../../../utils/competitions';
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

export default function PlayerCalendar() {
  const { state, schedulePlayerMatch } = useGame();
  const [viewDate, setViewDate] = useState(() => getInitialCalendarDate(state.matches));
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const comps = state.seasonCompetitions;

  const matchesByDate = useMemo(() => {
    const map = new Map<string, typeof state.matches>();
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

  function dayResultClass(result: ReturnType<typeof dayPrimaryResult>): string {
    if (result === 'win') return styles.dayResultWin;
    if (result === 'draw') return styles.dayResultDraw;
    if (result === 'loss') return styles.dayResultLoss;
    return '';
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
          const primaryMatch = dayMatches[0];
          const result = dayPrimaryResult(dayMatches);
          const resultClass = dayResultClass(result);
          const completedPrimary = dayMatches.find(m => m.status === 'completed' && m.result);

          return (
            <button
              key={key}
              type="button"
              className={[
                styles.day,
                isToday ? styles.dayToday : '',
                dayMatches.length && !result ? styles.dayHasMatch : '',
                resultClass,
              ].filter(Boolean).join(' ')}
              onClick={() => { setSelectedDate(dateKey); setModalOpen(true); }}
            >
              <div className={styles.dayHeader}>
                {primaryMatch && (
                  <span className={styles.locationIcon}>{locationIcon(primaryMatch.location)}</span>
                )}
                <span className={styles.dayNum}>{date.getDate()}</span>
              </div>
              {completedPrimary && (
                <span className={styles.dayScore}>
                  {completedPrimary.goalsFor}×{completedPrimary.goalsAgainst}
                </span>
              )}
              {dayMatches.length > 0 && (
                <div className={styles.dayMatches}>
                  {dayMatches.slice(0, 3).map(m => (
                    <span
                      key={m.id}
                      className={styles.matchMarker}
                      style={{ background: resolveCompetitionColor(comps, m.competition) }}
                      title={formatMatchDayTitle(m)}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.legend}>
        <div className={styles.legendGroup}>
          <span className={styles.legendTitle}>Competições</span>
          {comps.map(comp => (
            <span key={comp.id} className={styles.legendItem}>
              <span className={styles.legendMarker} style={{ background: comp.color }} />
              {comp.shortName || comp.name}
            </span>
          ))}
        </div>
        <div className={styles.legendGroup}>
          <span className={styles.legendTitle}>Resultado</span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles.dayResultWin}`} />
            Vitória
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles.dayResultDraw}`} />
            Empate
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles.dayResultLoss}`} />
            Derrota
          </span>
        </div>
      </div>

      <MatchScheduleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={data => schedulePlayerMatch(data)}
        competitions={competitionNames(comps)}
        initialDate={selectedDate}
        title="Agendar Partida"
      />
    </div>
  );
}
