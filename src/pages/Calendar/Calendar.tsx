import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MatchRecapModal from '../../components/MatchRecapModal/MatchRecapModal';
import MatchScheduleModal from '../../components/MatchScheduleModal/MatchScheduleModal';
import { useGame } from '../../context/GameContext';
import type { Match } from '../../types/Match';
import {
  competitionLabel,
  getInitialCalendarDate,
  locationIcon,
  shortLocation,
} from '../../utils/calendarHelpers';
import { competitionNames, resolveCompetitionColor } from '../../utils/competitions';
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

function scoreResultClass(result: Match['result']): string {
  if (result === 'win') return styles.scoreWin;
  if (result === 'draw') return styles.scoreDraw;
  if (result === 'loss') return styles.scoreLoss;
  return '';
}

export default function Calendar() {
  const navigate = useNavigate();
  const { state, scheduleMatch } = useGame();
  const [viewDate, setViewDate] = useState(() => getInitialCalendarDate(state.matches));
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

  const legendComps = useMemo(() => {
    const used = new Set(state.matches.map(m => m.competition));
    const fromSeason = comps.filter(c => used.has(c.name) || comps.length <= 8);
    if (fromSeason.length) return fromSeason;
    return comps;
  }, [comps, state.matches]);

  function openSchedule(dateKey: string) {
    setSelectedDate(dateKey);
    setModalOpen(true);
  }

  function handleMatchClick(match: Match) {
    if (match.status === 'completed') {
      setRecapMatch(match);
      return;
    }
    navigate(`/match/${match.id}/pulse`);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Calendário</h1>
        <p className={styles.sub}>Partidas agendadas e realizadas por mês</p>
      </header>

      <div className={styles.calendarNav}>
        <button type="button" className={styles.navBtn} onClick={() => setViewDate(new Date(year, month - 1, 1))} aria-label="Mês anterior">
          ←
        </button>
        <h2 className={styles.monthLabel}>{MONTHS[month]} {year}</h2>
        <button type="button" className={styles.navBtn} onClick={() => setViewDate(new Date(year, month + 1, 1))} aria-label="Próximo mês">
          →
        </button>
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
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={styles.matchCard}
                      style={{ borderLeftColor: color }}
                      onClick={() => handleMatchClick(m)}
                      title={done ? 'Ver resumo' : 'Jogar partida'}
                    >
                      <span className={styles.matchComp} style={{ color }}>
                        {competitionLabel(comps, m.competition)}
                      </span>
                      <span className={styles.matchLoc}>
                        {locationIcon(m.location)} {shortLocation(m.location)}
                      </span>
                      <span className={styles.matchOpp}>{m.opponent}</span>
                      {done ? (
                        <span className={`${styles.matchScore} ${scoreResultClass(m.result)}`}>
                          {m.goalsFor}×{m.goalsAgainst}
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

      <div className={styles.legend}>
        <div className={styles.legendGroup}>
          <span className={styles.legendTitle}>Competições</span>
          {legendComps.map(comp => (
            <span key={comp.id} className={styles.legendItem}>
              <span className={styles.legendMarker} style={{ background: comp.color }} />
              {comp.shortName || comp.name}
            </span>
          ))}
          {legendComps.length === 0 && (
            <span className={styles.legendItem}>Nenhuma competição cadastrada</span>
          )}
        </div>
        <div className={styles.legendGroup}>
          <span className={styles.legendTitle}>Resultado</span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendScore} ${styles.scoreWin}`}>2×1</span>
            Vitória
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendScore} ${styles.scoreDraw}`}>1×1</span>
            Empate
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendScore} ${styles.scoreLoss}`}>0×2</span>
            Derrota
          </span>
        </div>
      </div>

      <MatchScheduleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={data => scheduleMatch(data)}
        competitions={competitionNames(comps)}
        initialDate={selectedDate}
        title="Agendar Partida"
      />

      <MatchRecapModal
        open={!!recapMatch}
        match={recapMatch}
        players={state.players}
        teamName={state.team?.name}
        onClose={() => setRecapMatch(null)}
        onEdit={
          recapMatch
            ? () => {
                const id = recapMatch.id;
                setRecapMatch(null);
                navigate(`/match/${id}/play`);
              }
            : undefined
        }
      />
    </div>
  );
}
