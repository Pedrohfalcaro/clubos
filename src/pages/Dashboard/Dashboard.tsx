import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Tutorial from '../../components/Tutorial/Tutorial';
import ClubCrest from '../../components/ClubCrest/ClubCrest';
import { useGame } from '../../context/GameContext';
import { calcPlayerAverageRating, getHomeAway, locationLabel } from '../../utils/matchStats';
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY } from '../../utils/clubColors';
import { WELCOME_TUTORIAL, hasSeenWelcome, markWelcomeSeen } from '../../utils/tutorials';
import { formatMoney, wageBill, runwayMonths } from '../../utils/finance';
import { suggestPayrollBridgeLoan } from '../../utils/clubLoans';
import {
  debtsWithInstallmentDue,
  DEBT_SKIP_INTEREST_RATE,
  PAYROLL_DELAY_MORALE_HIT,
} from '../../utils/clubDebts';
import { analyzeLiveLifeGaps } from '../../utils/livelifeTemplates';
import { boardStatus } from '../../types/Board';
import { findMatchOnDate, formatGameDate } from '../../livelife';
import { CATEGORIA_LABELS, RARIDADE_LABELS } from '../../pulse';
import { paymentsDueOnDate } from '../../utils/transferPayments';
import { loanPaymentsDueOnDate } from '../../utils/clubLoans';
import {
  findCallupPressOpportunity,
  findFinancePressOpportunity,
  findInjuryPressOpportunity,
} from '../../utils/pressTriggers';
import {
  scopeOptions,
  teamStatsForScope,
  matchesForScope,
  playerStatsForScope,
  financeForScope,
  transfersForScope,
  ledgerForScope,
  type HistoryScope,
} from '../../utils/historyScope';
import styles from './Dashboard.module.css';
import pulseStyles from '../PulseMatch/PulseMatch.module.css';

function resultLabel(result: string | null): { text: string; className: string } {
  if (result === 'win') return { text: 'V', className: styles.resWin };
  if (result === 'draw') return { text: 'E', className: styles.resDraw };
  if (result === 'loss') return { text: 'D', className: styles.resLoss };
  return { text: '—', className: '' };
}

function transferTypeLabel(type: string): string {
  switch (type) {
    case 'buy': return 'Contrat.';
    case 'sell': return 'Venda';
    case 'loan_in': return 'Emprést.';
    case 'loan_out': return 'Emprést.↗';
    case 'free': return 'Livre';
    default: return type;
  }
}

function ConfidenceMeter({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  const tone =
    value >= 70 ? styles.meterHigh : value >= 40 ? styles.meterMid : styles.meterLow;
  return (
    <button
      type="button"
      className={`${styles.meter} ${onClick ? styles.meterClickable : ''}`}
      onClick={onClick}
      title={onClick ? 'Abrir Diretoria' : undefined}
    >
      <div className={styles.meterTop}>
        <span className={styles.meterLabel}>{label}</span>
        <span className={`${styles.meterValue} ${tone}`}>{value}%</span>
      </div>
      <div className={styles.meterTrack}>
        <div className={`${styles.meterFill} ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </button>
  );
}

const BOARD_STATUS_LABEL = {
  stable: 'Estável',
  watchful: 'Vigilante',
  crisis: 'Crise',
};

export default function Dashboard() {
  const {
    state,
    advanceDay,
    rewindDay,
    payWages,
    payWagesWithBridgeLoan,
    dismissPayroll,
    dismissLiveLifePrompt,
    dismissDailyPulse,
    payTransferPayment,
    dismissTransferPayments,
    payLoanPayment,
    dismissLoanPayments,
    payClubDebt,
    dismissDebtPayments,
  } = useGame();
  const navigate = useNavigate();
  const {
    team, matches, manager, finance, board, transfers, players, seasonHistory, currentDate, payrollDue,
    liveLifePromptPending, seasonCompetitions, pendingDailyPulse, transferPaymentsDue, loanPaymentsDue,
    debtPaymentsDue,
  } = state;
  const dueTransferPayments = useMemo(
    () =>
      currentDate
        ? paymentsDueOnDate(transfers.pendingPayments ?? [], currentDate)
        : [],
    [currentDate, transfers.pendingPayments],
  );
  const dueLoanPayments = useMemo(
    () =>
      currentDate
        ? loanPaymentsDueOnDate(finance.loanPayments ?? [], currentDate)
        : [],
    [currentDate, finance.loanPayments],
  );
  const dueDebtInstallments = useMemo(
    () =>
      currentDate ? debtsWithInstallmentDue(finance.debts ?? [], currentDate) : [],
    [currentDate, finance.debts],
  );
  const [showWelcome, setShowWelcome] = useState(() => !hasSeenWelcome());
  const [histScope, setHistScope] = useState<HistoryScope>('current');

  const scopes = useMemo(
    () => scopeOptions(state.season, seasonHistory),
    [state.season, seasonHistory],
  );
  const isCurrentScope = histScope === 'current' || histScope === state.season;

  const scopedMatches = useMemo(
    () => matchesForScope(matches, histScope, state.season),
    [matches, histScope, state.season],
  );
  const recentMatches = useMemo(
    () => [...scopedMatches].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [scopedMatches],
  );
  const nextMatch = useMemo(
    () =>
      matches
        .filter(m => m.status === 'scheduled')
        .sort((a, b) => a.date.localeCompare(b.date))[0],
    [matches],
  );
  const todayMatch = useMemo(
    () => (currentDate ? findMatchOnDate(matches, currentDate) : null),
    [matches, currentDate],
  );
  const pressPreAvailable =
    !!todayMatch &&
    todayMatch.status === 'scheduled' &&
    !(state.livelife.pressPreDoneDates ?? []).includes(todayMatch.date.slice(0, 10));
  const postMatchPending = useMemo(() => {
    if (!currentDate) return null;
    const done = new Set(state.livelife.pressPostDoneMatchIds ?? []);
    return (
      matches
        .filter(
          m =>
            m.status === 'completed' &&
            m.date.slice(0, 10) === currentDate.slice(0, 10) &&
            !done.has(m.id),
        )
        .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
    );
  }, [matches, currentDate, state.livelife.pressPostDoneMatchIds]);

  const callupPress = useMemo(
    () =>
      findCallupPressOpportunity({
        matches,
        currentDate,
        livelife: state.livelife,
      }),
    [matches, currentDate, state.livelife],
  );
  const injuryPress = useMemo(
    () =>
      findInjuryPressOpportunity({
        players,
        currentDate,
        livelife: state.livelife,
      }),
    [players, currentDate, state.livelife],
  );
  const financePress = useMemo(
    () =>
      findFinancePressOpportunity({
        finance,
        players,
        currentDate,
        livelife: state.livelife,
      }),
    [finance, players, currentDate, state.livelife],
  );

  function handleAdvanceDay() {
    if (!currentDate) {
      navigate('/diretoria');
      return;
    }
    const result = advanceDay();
    if (result.matchId) {
      navigate(`/match/${result.matchId}/pulse`);
    }
  }

  function handleRewindDay() {
    if (!currentDate) {
      navigate('/diretoria');
      return;
    }
    rewindDay();
  }

  const topScorers = useMemo(
    () =>
      [...players]
        .map(p => ({ player: p, stats: playerStatsForScope(p, histScope, seasonHistory, state.season) }))
        .filter(r => r.stats.goals > 0)
        .sort((a, b) => b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists)
        .slice(0, 5),
    [players, histScope, seasonHistory, state.season],
  );

  const topAssists = useMemo(
    () =>
      [...players]
        .map(p => ({ player: p, stats: playerStatsForScope(p, histScope, seasonHistory, state.season) }))
        .filter(r => r.stats.assists > 0)
        .sort((a, b) => b.stats.assists - a.stats.assists || b.stats.goals - a.stats.goals)
        .slice(0, 5),
    [players, histScope, seasonHistory, state.season],
  );

  const topRatings = useMemo(() => {
    return [...players]
      .map(p => ({
        player: p,
        avg: calcPlayerAverageRating(p.id, scopedMatches),
      }))
      .filter((x): x is { player: typeof players[0]; avg: number } => x.avg != null)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  }, [players, scopedMatches]);

  const bill = useMemo(() => wageBill(players), [players]);
  const payrollBridge = useMemo(
    () =>
      suggestPayrollBridgeLoan({
        balance: finance.balance,
        wageBill: bill,
        gameDate: currentDate ?? new Date().toISOString().slice(0, 10),
      }),
    [finance.balance, bill, currentDate],
  );
  const runway = useMemo(() => runwayMonths(finance, players), [finance, players]);
  const liveLifeGaps = useMemo(
    () =>
      analyzeLiveLifeGaps({
        finance,
        competitions: seasonCompetitions,
        players,
        team,
        currentDate,
      }),
    [finance, seasonCompetitions, players, team, currentDate],
  );
  const pendingGaps = liveLifeGaps.filter(g => !g.ok);

  useEffect(() => {
    if (liveLifePromptPending && pendingGaps.length === 0) {
      dismissLiveLifePrompt();
    }
  }, [liveLifePromptPending, pendingGaps.length, dismissLiveLifePrompt]);

  const scopedFinance = useMemo(
    () => financeForScope(finance, histScope, seasonHistory, state.season),
    [finance, histScope, seasonHistory, state.season],
  );
  const recentLedger = useMemo(
    () => ledgerForScope(finance.ledger, histScope, state.season).slice(0, 4),
    [finance.ledger, histScope, state.season],
  );
  const scopedTransfers = useMemo(
    () => transfersForScope(transfers.history, histScope, state.season),
    [transfers.history, histScope, state.season],
  );
  const recentTransfers = useMemo(() => scopedTransfers.slice(0, 4), [scopedTransfers]);
  const activeGoals = useMemo(
    () => board.goals.filter(g => g.status === 'active').slice(0, 3),
    [board.goals],
  );

  if (!team) return null;

  const s = teamStatsForScope(team.statistics, histScope, seasonHistory, state.season);
  const gd = s.goalsFor - s.goalsAgainst;
  const gdText = gd > 0 ? `+${gd}` : String(gd);
  const archived = typeof histScope === 'number'
    ? seasonHistory.find(a => a.season === histScope)
    : undefined;
  const boardConf = archived?.boardConfidence ?? team.boardConfidence;
  const confStatus = boardStatus(boardConf);
  const scopeLabel =
    histScope === 'total'
      ? 'Carreira'
      : histScope === 'current'
        ? `Temporada ${state.season}`
        : `Temporada ${histScope}`;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden />
        <div className={styles.heroMain}>
          <div className={styles.heroBrand}>
            <ClubCrest
              primary={team.primaryColor ?? DEFAULT_PRIMARY}
              secondary={team.secondaryColor ?? DEFAULT_SECONDARY}
              size={44}
              title={team.name}
            />
            <div>
              <p className={styles.heroEyebrow}>
                Temporada {state.season}
                {manager ? ` · ${manager.name}` : ''}
              </p>
              <h1 className={styles.heroTitle}>{team.name}</h1>
              {currentDate ? (
                <p className={styles.dateBadge} title="Data atual do jogo">
                  {formatGameDate(currentDate, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              ) : (
                <p className={styles.dateBadgeMuted}>LiveLife inativo — defina a data na Diretoria</p>
              )}
            </div>
          </div>
          <button
            type="button"
            className={styles.heroBudgetBtn}
            onClick={() => navigate('/financas')}
            title="Abrir Financeiro"
          >
            {formatMoney(finance.balance, finance.currency)}
            <span className={styles.heroBudgetHint}>Financeiro →</span>
          </button>
        </div>
        <div className={styles.confidence}>
          <ConfidenceMeter
            label="Diretoria"
            value={team.boardConfidence}
            onClick={() => navigate('/diretoria')}
          />
          <ConfidenceMeter
            label="Torcida"
            value={team.supporterConfidence}
            onClick={() => navigate('/diretoria')}
          />
          <ConfidenceMeter
            label="Mídia"
            value={team.mediaConfidence ?? 50}
            onClick={() => navigate('/press-conference')}
          />
        </div>
      </header>

      <nav className={styles.quickNav} aria-label="Acessos rápidos">
        <button type="button" className={styles.quickBtn} onClick={() => navigate('/squad')}>
          <span className={styles.quickIcon}>◈</span>
          Elenco
        </button>
        <button type="button" className={styles.quickBtn} onClick={() => navigate('/matches')}>
          <span className={styles.quickIcon}>＋</span>
          Agendar
        </button>
        <button
          type="button"
          className={styles.quickBtn}
          onClick={handleRewindDay}
          disabled={!currentDate}
          title="Voltar um dia"
        >
          <span className={styles.quickIcon}>◀</span>
          Voltar Dia
        </button>
        <button
          type="button"
          className={`${styles.quickBtn} ${styles.quickBtnPrimary}`}
          onClick={handleAdvanceDay}
        >
          <span className={styles.quickIcon}>▶</span>
          Avançar Dia
        </button>
        <button type="button" className={styles.quickBtn} onClick={() => navigate('/financas')}>
          <span className={styles.quickIcon}>$</span>
          Finanças
        </button>
        <button type="button" className={styles.quickBtn} onClick={() => navigate('/diretoria')}>
          <span className={styles.quickIcon}>◎</span>
          Diretoria
        </button>
        <button type="button" className={styles.quickBtn} onClick={() => navigate('/transferencias')}>
          <span className={styles.quickIcon}>⇄</span>
          Transferências
        </button>
        <button type="button" className={styles.quickBtn} onClick={() => navigate('/tactics')}>
          <span className={styles.quickIcon}>▣</span>
          Tática
        </button>
        <button type="button" className={styles.quickBtn} onClick={() => navigate('/pulse')}>
          <span className={styles.quickIcon}>◉</span>
          Pulse
        </button>
      </nav>

      <div className={styles.scopeBar} role="tablist" aria-label="Período do histórico">
        {scopes.map(sOpt => (
          <button
            key={String(sOpt.value)}
            type="button"
            role="tab"
            aria-selected={histScope === sOpt.value}
            className={`${styles.scopeBtn} ${histScope === sOpt.value ? styles.scopeBtnActive : ''}`}
            onClick={() => setHistScope(sOpt.value)}
          >
            {sOpt.label}
          </button>
        ))}
      </div>

      {isCurrentScope && (
        <div className={styles.dayControls}>
          <button
            type="button"
            className={styles.rewindDayBtn}
            onClick={handleRewindDay}
            disabled={!currentDate}
            title="Voltar um dia no calendário"
          >
            ← Voltar Dia
          </button>
          <button
            type="button"
            className={styles.advanceDayBanner}
            onClick={handleAdvanceDay}
          >
            <div className={styles.nextMatchLeft}>
              <span className={styles.nextMatchLabel}>
                {currentDate ? 'LiveLife' : 'LiveLife — ativar'}
              </span>
              <span className={styles.nextMatchTeams}>
                {todayMatch
                  ? `Dia de jogo · ${todayMatch.opponent}`
                  : currentDate
                    ? 'Avançar Dia'
                    : 'Definir data base'}
              </span>
              <span className={styles.nextMatchMeta}>
                {currentDate
                  ? todayMatch
                    ? `Partida agendada para hoje · ${todayMatch.competition} · ${locationLabel(todayMatch.location)}`
                    : nextMatch
                      ? `Próximo jogo: ${nextMatch.opponent} em ${formatGameDate(nextMatch.date)}`
                      : 'Nenhuma partida agendada — avance o calendário ou agende um jogo'
                  : 'Abra a Diretoria e escolha a data inicial do calendário contínuo'}
              </span>
            </div>
            <span className={styles.nextMatchCta}>
              {todayMatch ? 'Jogar →' : currentDate ? 'Avançar →' : 'Ativar →'}
            </span>
          </button>
        </div>
      )}

      {isCurrentScope && !nextMatch && !todayMatch ? (
        <button
          type="button"
          className={styles.nextMatchEmpty}
          onClick={() => navigate('/matches')}
        >
          Nenhuma partida agendada — <strong>agendar agora</strong>
        </button>
      ) : null}

      {isCurrentScope && pressPreAvailable && todayMatch && (
        <button
          type="button"
          className={styles.pressCta}
          onClick={() =>
            navigate(`/press-conference?ctx=pre&matchId=${todayMatch.id}`)
          }
        >
          <span className={styles.pressCtaLabel}>Coletiva pré-jogo</span>
          <span className={styles.pressCtaMain}>
            vs <strong>{todayMatch.opponent}</strong> — falar com a imprensa
          </span>
          <span className={styles.pressCtaGo}>Abrir →</span>
        </button>
      )}

      {isCurrentScope && postMatchPending && (
        <button
          type="button"
          className={`${styles.pressCta} ${styles.pressCtaPost}`}
          onClick={() =>
            navigate(`/press-conference?ctx=post&matchId=${postMatchPending.id}`)
          }
        >
          <span className={styles.pressCtaLabel}>Coletiva pós-jogo</span>
          <span className={styles.pressCtaMain}>
            vs <strong>{postMatchPending.opponent}</strong> — declarar
          </span>
          <span className={styles.pressCtaGo}>Abrir →</span>
        </button>
      )}

      {isCurrentScope && callupPress && (
        <button
          type="button"
          className={`${styles.pressCta} ${styles.pressCtaSpecial}`}
          onClick={() =>
            navigate(
              `/press-conference?ctx=callup&matchId=${callupPress.match.id}&key=${encodeURIComponent(callupPress.key)}`,
            )
          }
        >
          <span className={styles.pressCtaLabel}>Coletiva · convocação</span>
          <span className={styles.pressCtaMain}>
            Lista para vs <strong>{callupPress.match.opponent}</strong>
          </span>
          <span className={styles.pressCtaGo}>Abrir →</span>
        </button>
      )}

      {isCurrentScope && injuryPress && (
        <button
          type="button"
          className={`${styles.pressCta} ${styles.pressCtaSpecial}`}
          onClick={() =>
            navigate(
              `/press-conference?ctx=injury&playerId=${injuryPress.player.id}&key=${encodeURIComponent(injuryPress.key)}`,
            )
          }
        >
          <span className={styles.pressCtaLabel}>Coletiva · lesão</span>
          <span className={styles.pressCtaMain}>
            <strong>{injuryPress.player.name}</strong>
            {injuryPress.player.injuryDaysRemaining != null
              ? ` · ~${injuryPress.player.injuryDaysRemaining} dias`
              : ''}
          </span>
          <span className={styles.pressCtaGo}>Abrir →</span>
        </button>
      )}

      {isCurrentScope && financePress && (
        <button
          type="button"
          className={`${styles.pressCta} ${styles.pressCtaSpecial}`}
          onClick={() =>
            navigate(
              `/press-conference?ctx=finance&key=${encodeURIComponent(financePress.key)}`,
            )
          }
        >
          <span className={styles.pressCtaLabel}>Coletiva · crise financeira</span>
          <span className={styles.pressCtaMain}>{financePress.reason}</span>
          <span className={styles.pressCtaGo}>Abrir →</span>
        </button>
      )}

      {isCurrentScope && state.social.activeArc?.pendingPress && (
        <button
          type="button"
          className={`${styles.pressCta} ${styles.pressCtaArc}`}
          onClick={() => {
            const arc = state.social.activeArc!;
            const ctx = arc.pendingPressContext ?? 'story_arc';
            if (ctx === 'injury' && arc.playerId) {
              navigate(
                `/press-conference?ctx=injury&playerId=${arc.playerId}&key=${encodeURIComponent(`arc-injury:${arc.id}`)}`,
              );
              return;
            }
            navigate(`/press-conference?ctx=${ctx === 'story_arc' ? 'arc' : ctx}`);
          }}
        >
          <span className={styles.pressCtaLabel}>Coletiva · arco</span>
          <span className={styles.pressCtaMain}>
            <strong>{state.social.activeArc.title}</strong> — a imprensa cobra resposta
          </span>
          <span className={styles.pressCtaGo}>Abrir →</span>
        </button>
      )}

      {isCurrentScope && state.social.activeArc && !state.social.activeArc.pendingPress && (
        <button
          type="button"
          className={`${styles.pressCta} ${styles.pressCtaArc}`}
          onClick={() => navigate('/social')}
        >
          <span className={styles.pressCtaLabel}>Story Arc</span>
          <span className={styles.pressCtaMain}>
            <strong>{state.social.activeArc.title}</strong>
            {' · '}
            capítulo em andamento no ClubOSocial
          </span>
          <span className={styles.pressCtaGo}>Ver feed →</span>
        </button>
      )}

      {/* Hub: Financeiro / Diretoria / Transferências */}
      <section className={styles.hubGrid} aria-label="Gestão do clube">
        <button type="button" className={styles.hubCard} onClick={() => navigate('/financas')}>
          <div className={styles.hubHead}>
            <h2 className={styles.hubTitle}>Financeiro</h2>
            <span className={styles.hubArrow}>→</span>
          </div>
          <p className={styles.hubBig}>
            {formatMoney(scopedFinance.balance ?? finance.balance, finance.currency)}
          </p>
          {isCurrentScope ? (
            <div className={styles.hubMeta}>
              <span>Folha {formatMoney(bill, finance.currency)}/mês</span>
              <span>
                Runway {runway === Infinity ? '∞' : `${runway}m`}
              </span>
            </div>
          ) : (
            <div className={styles.hubMeta}>
              <span>{scopeLabel}</span>
            </div>
          )}
          <div className={styles.hubMeta}>
            <span className={styles.hubIn}>+{formatMoney(scopedFinance.income, finance.currency)}</span>
            <span className={styles.hubOut}>{formatMoney(scopedFinance.expense, finance.currency)}</span>
          </div>
          {recentLedger.length > 0 && (
            <ul className={styles.hubList}>
              {recentLedger.map(e => (
                <li key={e.id}>
                  <span className={styles.hubListName}>{e.label}</span>
                  <span className={e.amount >= 0 ? styles.hubIn : styles.hubOut}>
                    {e.amount >= 0 ? '+' : ''}{formatMoney(e.amount, finance.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </button>

        <button type="button" className={styles.hubCard} onClick={() => navigate('/diretoria')}>
          <div className={styles.hubHead}>
            <h2 className={styles.hubTitle}>Diretoria</h2>
            <span className={styles.hubArrow}>→</span>
          </div>
          <p className={styles.hubBig}>{boardConf}%</p>
          <div className={styles.hubMeta}>
            <span className={styles[`hubStatus_${confStatus}`]}>
              {BOARD_STATUS_LABEL[confStatus]}
            </span>
            {isCurrentScope ? (
              <span>{activeGoals.length} meta{activeGoals.length !== 1 ? 's' : ''} ativa{activeGoals.length !== 1 ? 's' : ''}</span>
            ) : (
              <span>{scopeLabel}</span>
            )}
          </div>
          {isCurrentScope && activeGoals.length > 0 ? (
            <ul className={styles.hubList}>
              {activeGoals.map(g => (
                <li key={g.id}>
                  <span className={styles.hubListName}>{g.label}</span>
                  <span className={styles.hubListMuted}>{g.current}/{g.target}</span>
                </li>
              ))}
            </ul>
          ) : isCurrentScope ? (
            <p className={styles.hubEmpty}>Nenhuma meta definida.</p>
          ) : archived ? (
            <p className={styles.hubEmpty}>
              Torcida {archived.supporterConfidence}% no fechamento
            </p>
          ) : (
            <p className={styles.hubEmpty}>Confiança atual do clube.</p>
          )}
        </button>

        <button type="button" className={styles.hubCard} onClick={() => navigate('/transferencias')}>
          <div className={styles.hubHead}>
            <h2 className={styles.hubTitle}>Transferências</h2>
            <span className={styles.hubArrow}>→</span>
          </div>
          <p className={styles.hubBig}>{scopedTransfers.length}</p>
          <div className={styles.hubMeta}>
            {isCurrentScope ? (
              <>
                <span>{transfers.watchlist.length} na observação</span>
                <span>{players.filter(p => p.status === 'Transferível').length} transferíveis</span>
              </>
            ) : (
              <span>{scopeLabel}</span>
            )}
          </div>
          {recentTransfers.length > 0 ? (
            <ul className={styles.hubList}>
              {recentTransfers.map(t => (
                <li key={t.id}>
                  <span className={styles.hubListName}>
                    {transferTypeLabel(t.type)} · {t.playerSnapshot.name}
                  </span>
                  <span className={styles.hubListMuted}>
                    {t.fee > 0
                      ? formatMoney(
                          t.type === 'sell' || t.type === 'loan_out' ? t.fee : -t.fee,
                          finance.currency,
                        )
                      : 'Grátis'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.hubEmpty}>Nenhuma operação neste período.</p>
          )}
        </button>
      </section>

      <section className={styles.formStrip} aria-label={`Desempenho — ${scopeLabel}`}>
        <div className={styles.formBlock}>
          <span className={styles.formNum}>{s.matches}</span>
          <span className={styles.formLbl}>Jogos</span>
        </div>
        <div className={styles.formDivider} />
        <div className={styles.formVed}>
          <div className={styles.vedItem}>
            <span className={`${styles.vedNum} ${styles.resWin}`}>{s.wins}</span>
            <span className={styles.formLbl}>V</span>
          </div>
          <div className={styles.vedItem}>
            <span className={`${styles.vedNum} ${styles.resDraw}`}>{s.draws}</span>
            <span className={styles.formLbl}>E</span>
          </div>
          <div className={styles.vedItem}>
            <span className={`${styles.vedNum} ${styles.resLoss}`}>{s.losses}</span>
            <span className={styles.formLbl}>D</span>
          </div>
        </div>
        <div className={styles.formDivider} />
        <div className={styles.formGoals}>
          <div className={styles.goalCell}>
            <span className={styles.formNum}>{s.goalsFor}</span>
            <span className={styles.formLbl}>GF</span>
          </div>
          <div className={styles.goalCell}>
            <span className={styles.formNum}>{s.goalsAgainst}</span>
            <span className={styles.formLbl}>GC</span>
          </div>
          <div className={styles.goalCell}>
            <span
              className={`${styles.formNum} ${gd > 0 ? styles.resWin : gd < 0 ? styles.resLoss : ''}`}
            >
              {gdText}
            </span>
            <span className={styles.formLbl}>SG</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Destaques</h2>
          <button type="button" className={styles.sectionLink} onClick={() => navigate('/squad')}>
            Ver elenco →
          </button>
        </div>
        <div className={styles.leadersGrid}>
          <div className={styles.leaderCard}>
            <h3 className={styles.leaderTitle}>Artilharia</h3>
            {topScorers.length === 0 ? (
              <p className={styles.leaderEmpty}>Sem gols neste período.</p>
            ) : (
              <ol className={styles.leaderList}>
                {topScorers.map((row, i) => (
                  <li key={row.player.id}>
                    <span className={styles.leaderRank}>{i + 1}</span>
                    <span className={styles.leaderName}>{row.player.name}</span>
                    <span className={styles.leaderStat}>{row.stats.goals}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className={styles.leaderCard}>
            <h3 className={styles.leaderTitle}>Assistências</h3>
            {topAssists.length === 0 ? (
              <p className={styles.leaderEmpty}>Sem assistências neste período.</p>
            ) : (
              <ol className={styles.leaderList}>
                {topAssists.map((row, i) => (
                  <li key={row.player.id}>
                    <span className={styles.leaderRank}>{i + 1}</span>
                    <span className={styles.leaderName}>{row.player.name}</span>
                    <span className={styles.leaderStat}>{row.stats.assists}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className={styles.leaderCard}>
            <h3 className={styles.leaderTitle}>Nota média</h3>
            {topRatings.length === 0 ? (
              <p className={styles.leaderEmpty}>Sem notas neste período.</p>
            ) : (
              <ol className={styles.leaderList}>
                {topRatings.map((row, i) => (
                  <li key={row.player.id}>
                    <span className={styles.leaderRank}>{i + 1}</span>
                    <span className={styles.leaderName}>{row.player.name}</span>
                    <span className={styles.leaderStat}>{row.avg.toFixed(1)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Últimas partidas</h2>
          <button type="button" className={styles.sectionLink} onClick={() => navigate('/matches')}>
            Ver todas →
          </button>
        </div>
        {recentMatches.length === 0 ? (
          <div className={styles.empty}>
            {isCurrentScope
              ? 'Ainda sem jogos. Agende a primeira partida e registre o resultado.'
              : 'Nenhuma partida registrada neste período.'}
          </div>
        ) : (
          <div className={styles.matchList}>
            {recentMatches.map(match => {
              const res = resultLabel(match.result);
              const ha = getHomeAway(team.name, match);
              return (
                <button
                  key={match.id}
                  type="button"
                  className={styles.matchRow}
                  onClick={() => navigate(`/match/${match.id}/play`)}
                >
                  <span className={`${styles.matchResult} ${res.className}`}>{res.text}</span>
                  <span className={styles.matchInfo}>
                    <span className={styles.matchOpponent}>
                      {ha.homeTeam} × {ha.awayTeam}
                    </span>
                    <span className={styles.matchComp}>{match.competition}</span>
                  </span>
                  <span className={styles.matchScore}>
                    {ha.homeGoals}–{ha.awayGoals}
                  </span>
                  <span className={styles.matchDate}>
                    {new Date(match.date).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {pendingDailyPulse && (
        <div className={pulseStyles.overlayPage} role="dialog" aria-labelledby="daily-pulse-title">
          <div className={pulseStyles.shell}>
            <p className={pulseStyles.eyebrow}>Pulse do dia</p>
            <h1 className={pulseStyles.brand}>Pulse</h1>
            <p className={pulseStyles.slogan}>O pulso do clube entre as partidas</p>

            <article className={`${pulseStyles.card} ${pulseStyles.cardEvent}`}>
              <div className={pulseStyles.badges}>
                <span className={pulseStyles.cat}>
                  {CATEGORIA_LABELS[pendingDailyPulse.categoria] ?? pendingDailyPulse.categoria}
                </span>
                {pendingDailyPulse.raridade && (
                  <span className={pulseStyles.rar}>
                    {RARIDADE_LABELS[pendingDailyPulse.raridade] ?? pendingDailyPulse.raridade}
                  </span>
                )}
              </div>
              <h2 id="daily-pulse-title" className={pulseStyles.eventTitle}>
                {pendingDailyPulse.titulo}
              </h2>
              <p className={pulseStyles.desc}>{pendingDailyPulse.descricao}</p>
              {pendingDailyPulse.impactos.length > 0 && (
                <div className={pulseStyles.impacts}>
                  <p className={pulseStyles.impactsLabel}>O que isso impacta</p>
                  <ul>
                    {pendingDailyPulse.impactos.map((imp, i) => (
                      <li key={i}>{imp}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>

            <button type="button" className={pulseStyles.cta} onClick={dismissDailyPulse}>
              Continuar →
            </button>
          </div>
        </div>
      )}

      {liveLifePromptPending && pendingGaps.length > 0 && (
        <div className={styles.overlay}>
          <div className={`${styles.modal} ${styles.modalWide}`} role="dialog" aria-labelledby="livelife-gaps-title">
            <p id="livelife-gaps-title" className={styles.modalTitle}>LiveLife — dados do clube</p>
            <p className={styles.modalBody}>
              Complete os itens abaixo para o modo LiveLife render melhor (bilheteria, folha e calendário).
            </p>
            <ul className={styles.gapList}>
              {liveLifeGaps.map(gap => (
                <li key={gap.id} className={`${styles.gapItem} ${gap.ok ? styles.gapOk : styles.gapPending}`}>
                  <div className={styles.gapText}>
                    <strong>{gap.ok ? '✓' : '!'} {gap.title}</strong>
                    <span>{gap.detail}</span>
                  </div>
                  {!gap.ok && (
                    <button
                      type="button"
                      className={styles.gapLink}
                      onClick={() => {
                        dismissLiveLifePrompt();
                        navigate(gap.href);
                      }}
                    >
                      Preencher
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnSecondary} onClick={dismissLiveLifePrompt}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {payrollDue && (
        <div className={styles.overlay}>
          <div className={styles.modal} role="dialog" aria-labelledby="payroll-title">
            <p id="payroll-title" className={styles.modalTitle}>Folha salarial</p>
            <p className={styles.modalBody}>
              Chegou o dia 5 — hora de pagar a folha do mês.
            </p>
            <div className={styles.modalMeta}>
              <span>Total</span>
              <strong className={finance.balance < bill ? styles.modalDanger : undefined}>
                {formatMoney(bill, finance.currency)}
              </strong>
            </div>
            <div className={styles.modalMeta}>
              <span>Caixa atual</span>
              <strong>{formatMoney(finance.balance, finance.currency)}</strong>
            </div>
            {payrollBridge && (
              <>
                <p className={styles.modalWarn}>
                  O caixa não cobre a folha (faltam{' '}
                  {formatMoney(payrollBridge.shortfall, finance.currency)}). Você pode
                  contratar um empréstimo-ponte de{' '}
                  {formatMoney(payrollBridge.principal, finance.currency)} (120% da folha,
                  juros {payrollBridge.interestRatePercent}%,{' '}
                  {payrollBridge.installmentCount} parcelas) e pagar agora.
                </p>
                <div className={styles.modalMeta}>
                  <span>Total a devolver</span>
                  <strong>
                    {formatMoney(payrollBridge.totalToRepay, finance.currency)}
                  </strong>
                </div>
              </>
            )}
            {!payrollBridge && finance.balance < bill && (
              <p className={styles.modalWarn}>
                O caixa não cobre a folha. O saldo ficará negativo.
              </p>
            )}
            {payrollBridge && (
              <p className={styles.modalBody} style={{ fontSize: 12, opacity: 0.85 }}>
                Pagar sem empréstimo zera o caixa e o valor faltante vira <strong>dívida</strong>.
              </p>
            )}
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnSecondary} onClick={dismissPayroll}>
                Depois (−{PAYROLL_DELAY_MORALE_HIT} moral)
              </button>
              {payrollBridge && (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => payWagesWithBridgeLoan()}
                >
                  Emprestar e pagar
                </button>
              )}
              <button
                type="button"
                className={styles.btnDanger}
                onClick={payWages}
                disabled={bill <= 0}
              >
                {payrollBridge ? 'Pagar (vira dívida)' : 'Pagar folha'}
              </button>
            </div>
          </div>
        </div>
      )}

      {transferPaymentsDue && dueTransferPayments.length > 0 && !payrollDue && (
        <div className={styles.overlay}>
          <div className={styles.modal} role="dialog" aria-labelledby="trf-pay-title">
            <p id="trf-pay-title" className={styles.modalTitle}>Pagamento de transferência</p>
            <p className={styles.modalBody}>
              Há {dueTransferPayments.length} pagamento(s) vencido(s) no calendário.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '12px 0' }}>
              {dueTransferPayments.map(p => (
                <div key={p.id} className={styles.modalMeta} style={{ alignItems: 'center' }}>
                  <span>
                    {p.label}
                    <br />
                    <small style={{ opacity: 0.75 }}>venceu {p.dueDate}</small>
                  </span>
                  <strong className={p.direction === 'out' && finance.balance < p.amount ? styles.modalDanger : undefined}>
                    {formatMoney(p.direction === 'out' ? -p.amount : p.amount, finance.currency)}
                  </strong>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    style={{ marginLeft: 8 }}
                    onClick={() => payTransferPayment(p.id)}
                  >
                    {p.direction === 'out' ? 'Pagar' : 'Receber'}
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.modalMeta}>
              <span>Caixa atual</span>
              <strong>{formatMoney(finance.balance, finance.currency)}</strong>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnSecondary} onClick={dismissTransferPayments}>
                Depois
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => navigate('/transferencias')}
              >
                Ver transferências
              </button>
            </div>
          </div>
        </div>
      )}

      {debtPaymentsDue && dueDebtInstallments.length > 0 && !payrollDue && !transferPaymentsDue && !loanPaymentsDue && (
        <div className={styles.overlay}>
          <div className={styles.modal} role="dialog" aria-labelledby="debt-pay-title">
            <p id="debt-pay-title" className={styles.modalTitle}>Parcela de dívida</p>
            <p className={styles.modalBody}>
              Há {dueDebtInstallments.length} parcela(s) de dívida hoje. Ignorar aumenta o saldo
              em ~{Math.round(DEBT_SKIP_INTEREST_RATE * 100)}% de juros.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '12px 0' }}>
              {dueDebtInstallments.map(({ debt, amount }) => (
                <div key={debt.id} className={styles.modalMeta} style={{ alignItems: 'center' }}>
                  <span>
                    {debt.label}
                    <br />
                    <small style={{ opacity: 0.75 }}>
                      dia {debt.paymentDay} · resta{' '}
                      {formatMoney(debt.remaining, finance.currency)}
                    </small>
                  </span>
                  <strong className={finance.balance < amount ? styles.modalDanger : undefined}>
                    {formatMoney(-amount, finance.currency)}
                  </strong>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    style={{ marginLeft: 8 }}
                    onClick={() => payClubDebt(debt.id, amount, true)}
                  >
                    Pagar
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.modalMeta}>
              <span>Caixa atual</span>
              <strong>{formatMoney(finance.balance, finance.currency)}</strong>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnSecondary} onClick={dismissDebtPayments}>
                Ignorar (+juros)
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => navigate('/financas')}
              >
                Ver finanças
              </button>
            </div>
          </div>
        </div>
      )}

      {loanPaymentsDue && dueLoanPayments.length > 0 && !payrollDue && !transferPaymentsDue && (
        <div className={styles.overlay}>
          <div className={styles.modal} role="dialog" aria-labelledby="loan-pay-title">
            <p id="loan-pay-title" className={styles.modalTitle}>Parcela de empréstimo</p>
            <p className={styles.modalBody}>
              Há {dueLoanPayments.length} parcela(s) de empréstimo vencida(s).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '12px 0' }}>
              {dueLoanPayments.map(p => (
                <div key={p.id} className={styles.modalMeta} style={{ alignItems: 'center' }}>
                  <span>
                    {p.label}
                    <br />
                    <small style={{ opacity: 0.75 }}>venceu {p.dueDate}</small>
                  </span>
                  <strong className={finance.balance < p.amount ? styles.modalDanger : undefined}>
                    {formatMoney(-p.amount, finance.currency)}
                  </strong>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    style={{ marginLeft: 8 }}
                    onClick={() => payLoanPayment(p.id)}
                  >
                    Pagar
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.modalMeta}>
              <span>Caixa atual</span>
              <strong>{formatMoney(finance.balance, finance.currency)}</strong>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnSecondary} onClick={dismissLoanPayments}>
                Depois
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => navigate('/financas')}
              >
                Ver finanças
              </button>
            </div>
          </div>
        </div>
      )}

      {showWelcome && (
        <Tutorial
          steps={WELCOME_TUTORIAL}
          onComplete={() => {
            markWelcomeSeen();
            setShowWelcome(false);
          }}
        />
      )}
    </div>
  );
}
