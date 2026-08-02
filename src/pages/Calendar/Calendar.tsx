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
import { clampPaymentDay } from '../../utils/clubDebts';
import { sponsorTierLabel } from '../../utils/sponsors';
import { formatMoney } from '../../utils/finance';
import { resultLetter } from '../../utils/matchTimeline';
import {
  formatWindowRange,
  getActiveTransferWindow,
  isDateInTransferWindow,
} from '../../utils/transferWindow';
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

function letterClass(result: Match['result']): string {
  if (result === 'win') return styles.letterWin;
  if (result === 'draw') return styles.letterDraw;
  if (result === 'loss') return styles.letterLoss;
  return '';
}

export default function Calendar() {
  const navigate = useNavigate();
  const { state, scheduleMatch } = useGame();
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
      const key = m.date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return map;
  }, [state.matches]);

  const paymentsByDate = useMemo(() => {
    const map = new Map<string, typeof state.transfers.pendingPayments>();
    for (const p of state.transfers.pendingPayments ?? []) {
      if (p.status !== 'pending') continue;
      const key = p.dueDate.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return map;
  }, [state.transfers.pendingPayments]);

  const loanPaysByDate = useMemo(() => {
    const map = new Map<string, NonNullable<typeof state.finance.loanPayments>>();
    for (const p of state.finance.loanPayments ?? []) {
      if (p.status !== 'pending') continue;
      const key = p.dueDate.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return map;
  }, [state.finance.loanPayments]);

  const presentationsByDate = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const p of state.players) {
      if (!p.availableFrom) continue;
      const key = p.availableFrom.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push({ id: p.id, name: p.name });
      map.set(key, list);
    }
    return map;
  }, [state.players]);

  const debtsByDay = useMemo(() => {
    const map = new Map<number, NonNullable<typeof state.finance.debts>>();
    for (const d of state.finance.debts ?? []) {
      if (d.status !== 'active' || d.remaining <= 0) continue;
      const day = clampPaymentDay(d.paymentDay);
      const list = map.get(day) ?? [];
      list.push(d);
      map.set(day, list);
    }
    return map;
  }, [state.finance.debts]);

  const sponsorsByDay = useMemo(() => {
    const map = new Map<number, NonNullable<typeof state.finance.sponsors>>();
    for (const s of state.finance.sponsors ?? []) {
      if (s.status !== 'active' || s.monthlyFee <= 0) continue;
      const day = clampPaymentDay(s.paymentDay);
      const list = map.get(day) ?? [];
      list.push(s);
      map.set(day, list);
    }
    return map;
  }, [state.finance.sponsors]);

  const gameToday = state.currentDate?.slice(0, 10) ?? null;

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
        <p className={styles.sub}>
          Partidas, folha (dia 5), janela de mercado, transferências, empréstimos e apresentações
          {gameToday ? ` · dia atual ${gameToday}` : ''}
        </p>
      </header>

      <div className={styles.calendarNav}>
        <button type="button" className={styles.navBtn} onClick={() => setViewDate(new Date(year, month - 1, 1))} aria-label="Mês anterior">←</button>
        <h2 className={styles.monthLabel}>{MONTHS[month]} {year}</h2>
        <button type="button" className={styles.navBtn} onClick={() => setViewDate(new Date(year, month + 1, 1))} aria-label="Próximo mês">→</button>
      </div>

      <div className={styles.calendar}>
        {WEEKDAYS.map(d => (
          <span key={d} className={styles.weekday}>{d}</span>
        ))}
        {calendarDays.map(({ date, key }) => {
          if (!date) return <div key={key} className={styles.dayEmpty} aria-hidden />;

          const dateKey = toDateKey(date);
          const dayMatches = matchesByDate.get(dateKey) ?? [];
          const dayPays = paymentsByDate.get(dateKey) ?? [];
          const dayLoans = loanPaysByDate.get(dateKey) ?? [];
          const dayPresent = presentationsByDate.get(dateKey) ?? [];
          const dayDebts = debtsByDay.get(date.getDate()) ?? [];
          const daySponsors = sponsorsByDay.get(date.getDate()) ?? [];
          const isPayrollDay = date.getDate() === 5;
          const windowOpenDay = isDateInTransferWindow(dateKey);
          const windowInfo = getActiveTransferWindow(dateKey);
          const isWindowStart =
            windowOpenDay &&
            !isDateInTransferWindow(
              toDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)),
            );
          const isRealToday = dateKey === toDateKey(new Date());
          const isGameDay = gameToday === dateKey;
          const hasEvents =
            dayMatches.length > 0 ||
            dayPays.length > 0 ||
            dayLoans.length > 0 ||
            dayPresent.length > 0 ||
            dayDebts.length > 0 ||
            daySponsors.length > 0 ||
            isPayrollDay ||
            isWindowStart;

          return (
            <div
              key={key}
              className={[
                styles.day,
                isGameDay ? styles.dayGameClock : '',
                isRealToday ? styles.dayToday : '',
                hasEvents ? styles.dayHasMatch : '',
                windowOpenDay ? styles.dayWindow : '',
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
                {isPayrollDay && (
                  <button
                    type="button"
                    className={styles.payrollCard}
                    onClick={() => navigate('/financas')}
                    title="Folha salarial — dia 5"
                  >
                    <span className={styles.payrollTag}>Folha</span>
                    <span className={styles.transferName}>Pagamento salarial</span>
                    <span className={styles.transferMeta}>Todo dia 5</span>
                  </button>
                )}
                {isWindowStart && windowInfo && (
                  <button
                    type="button"
                    className={styles.windowCard}
                    onClick={() => navigate('/transferencias')}
                    title={windowInfo.label}
                  >
                    <span className={styles.windowTag}>Mercado</span>
                    <span className={styles.transferName}>{windowInfo.label}</span>
                    <span className={styles.transferMeta}>{formatWindowRange(windowInfo)}</span>
                  </button>
                )}
                {dayPays.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={styles.transferCard}
                    onClick={() => navigate('/transferencias')}
                    title={p.label}
                  >
                    <span className={styles.transferTag}>
                      {p.direction === 'out' ? 'Pagamento' : 'Recebimento'}
                    </span>
                    <span className={styles.transferName}>{p.playerName}</span>
                    <span className={styles.transferMeta}>
                      {p.installmentTotal > 1
                        ? `${p.installmentIndex}/${p.installmentTotal}`
                        : 'à vista'}
                    </span>
                  </button>
                ))}
                {dayLoans.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={styles.loanCard}
                    onClick={() => navigate('/financas')}
                    title={p.label}
                  >
                    <span className={styles.loanTag}>Empréstimo</span>
                    <span className={styles.transferName}>{p.label}</span>
                    <span className={styles.transferMeta}>
                      {p.installmentTotal > 1
                        ? `${p.installmentIndex}/${p.installmentTotal}`
                        : 'única'}
                    </span>
                  </button>
                ))}
                {dayDebts.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    className={styles.debtCard}
                    onClick={() => navigate('/financas')}
                    title={d.label}
                  >
                    <span className={styles.debtTag}>Dívida</span>
                    <span className={styles.transferName}>{d.label}</span>
                    <span className={styles.transferMeta}>
                      {formatMoney(-Math.min(d.remaining, d.monthlyInstallment), state.finance.currency)}
                    </span>
                  </button>
                ))}
                {daySponsors.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className={styles.sponsorCard}
                    onClick={() => navigate('/financas')}
                    title={s.brand}
                  >
                    <span className={styles.sponsorTag}>Patrocínio</span>
                    <span className={styles.transferName}>
                      {sponsorTierLabel(s.tier)} · {s.brand}
                    </span>
                    <span className={styles.transferMeta}>
                      {formatMoney(s.monthlyFee, state.finance.currency)}
                    </span>
                  </button>
                ))}
                {dayPresent.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={styles.presentCard}
                    onClick={() => navigate('/squad')}
                    title={`Apresentação: ${p.name}`}
                  >
                    <span className={styles.presentTag}>Apresentação</span>
                    <span className={styles.transferName}>{p.name}</span>
                    <span className={styles.transferMeta}>Disponível no elenco</span>
                  </button>
                ))}
                {!hasEvents && (
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
        </div>
        <div className={styles.legendGroup}>
          <span className={styles.legendTitle}>Resultado</span>
          <span className={styles.legendItem}>
            <span className={styles.legendScore}>
              <span className={styles.legendScoreNums}>2×1</span>
              <span className={styles.letterWin}>V</span>
            </span>
            Vitória
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendScore}>
              <span className={styles.legendScoreNums}>1×1</span>
              <span className={styles.letterDraw}>E</span>
            </span>
            Empate
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendScore}>
              <span className={styles.legendScoreNums}>0×2</span>
              <span className={styles.letterLoss}>D</span>
            </span>
            Derrota
          </span>
        </div>
        <div className={styles.legendGroup}>
          <span className={styles.legendTitle}>Local</span>
          <span className={styles.legendItem}>🏠 Casa</span>
          <span className={styles.legendItem}>✈️ Fora</span>
          <span className={styles.legendItem}>— Neutro</span>
        </div>
        <div className={styles.legendGroup}>
          <span className={styles.legendTitle}>Outros</span>
          <span className={styles.legendItem}>
            <span className={styles.legendPayroll}>FOLHA</span>
            Folha (dia 5)
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendTransfer}>$ TRF</span>
            Transferência
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendWindow}>JANELA</span>
            Mercado aberto
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendLoan}>EMP</span>
            Empréstimo
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendPresent}>APR</span>
            Apresentação
          </span>
        </div>
      </div>

      <MatchScheduleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={data => scheduleMatch(data)}
        competitions={competitionNames(comps)}
        initialDate={selectedDate || state.currentDate || undefined}
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
