import { useMemo, useState } from 'react';
import MatchScheduleModal from '../../components/MatchScheduleModal/MatchScheduleModal';
import { useGame } from '../../context/GameContext';
import styles from './Calendar.module.css';

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

export default function Calendar() {
  const { state, scheduleMatch } = useGame();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

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

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1));
  }

  function openDay(dateKey: string) {
    setSelectedDate(dateKey);
    setModalOpen(true);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Calendário</h1>
        <p className={styles.sub}>Partidas agendadas e realizadas por mês</p>
      </header>

      <div className={styles.calendarNav}>
        <button type="button" className={styles.navBtn} onClick={prevMonth} aria-label="Mês anterior">
          ←
        </button>
        <h2 className={styles.monthLabel}>{MONTHS[month]} {year}</h2>
        <button type="button" className={styles.navBtn} onClick={nextMonth} aria-label="Próximo mês">
          →
        </button>
      </div>

      <div className={styles.calendar}>
        <div className={styles.weekdays}>
          {WEEKDAYS.map(d => (
            <span key={d} className={styles.weekday}>{d}</span>
          ))}
        </div>
        <div className={styles.days}>
          {calendarDays.map(({ date, key }) => {
            if (!date) return <div key={key} className={styles.dayEmpty} />;
            const dateKey = toDateKey(date);
            const dayMatches = matchesByDate.get(dateKey) ?? [];
            const isToday = dateKey === toDateKey(new Date());

            return (
              <button
                key={key}
                type="button"
                className={`${styles.day} ${isToday ? styles.dayToday : ''} ${dayMatches.length ? styles.dayHasMatch : ''}`}
                onClick={() => openDay(dateKey)}
              >
                <span className={styles.dayNum}>{date.getDate()}</span>
                {dayMatches.length > 0 && (
                  <div className={styles.dayMatches}>
                    {dayMatches.slice(0, 2).map(m => (
                      <span
                        key={m.id}
                        className={`${styles.matchDot} ${m.status === 'completed' ? styles.matchDone : styles.matchScheduled}`}
                        title={`${m.opponent} · ${m.competition}`}
                      />
                    ))}
                    {dayMatches.length > 2 && (
                      <span className={styles.more}>+{dayMatches.length - 2}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.legend}>
        <span><span className={`${styles.legendDot} ${styles.matchScheduled}`} /> Agendada</span>
        <span><span className={`${styles.legendDot} ${styles.matchDone}`} /> Realizada</span>
      </div>

      <MatchScheduleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={data => scheduleMatch(data)}
        competitions={state.seasonCompetitions}
        initialDate={selectedDate}
        title="Agendar Partida"
      />
    </div>
  );
}
