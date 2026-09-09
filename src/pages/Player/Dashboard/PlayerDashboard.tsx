import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../../../components/StatCard/StatCard';
import Tutorial from '../../../components/Tutorial/Tutorial';
import { useGame } from '../../../context/GameContext';
import { formatGameDate } from '../../../livelife';
import { CATEGORIA_LABELS_PLAYER } from '../../../pulse/playerEvents';
import { RARIDADE_LABELS, formatPulseDate } from '../../../pulse';
import { getHomeAway, locationLabel } from '../../../utils/matchStats';
import { getPlayerMatchClubName } from '../../../utils/playerMatch';
import { calcAverageRating } from '../../../utils/playerStats';
import { isInjuryActive, daysUntil } from '../../../utils/playerClock';
import { findPlayerPreMatchOpportunity, findPlayerPostMatchOpportunity } from '../../../utils/playerPressTriggers';
import {
  metricForPosition,
  suggestedTarget,
  MONTHLY_GOAL_METRIC_LABELS,
} from '../../../utils/playerMonthlyGoals';
import type { MonthlyGoalMetric } from '../../../types/PlayerGoal';
import {
  PLAYER_WELCOME_TUTORIAL,
  PLAYER_WHATS_NEW_V16,
  hasSeenPlayerWelcome,
  markPlayerWelcomeSeen,
} from '../../../utils/playerTutorials';
import { CURRENT_UPDATE_VERSION } from '../../../types/LiveLife';
import shared from '../PlayerShared.module.css';
import styles from '../../Dashboard/Dashboard.module.css';
import pulseStyles from '../../PulseMatch/PulseMatch.module.css';

const POSITION_LABELS: Record<string, string> = {
  GK: 'Goleiro', CB: 'Zagueiro', RB: 'Lateral Dir.', LB: 'Lateral Esq.',
  CDM: 'Volante', CM: 'Meia', CAM: 'Meia Atac.', RW: 'Ponta Dir.',
  LW: 'Ponta Esq.', ST: 'Atacante', CF: 'Centroavante',
};

function formatSalary(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M/mês`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K/mês`;
  return value > 0 ? `R$ ${value}/mês` : 'Não informado';
}

function resultLabel(result: string | null): { text: string; color: string } {
  if (result === 'win') return { text: 'V', color: 'var(--success)' };
  if (result === 'draw') return { text: 'E', color: 'var(--warning)' };
  if (result === 'loss') return { text: 'D', color: 'var(--danger)' };
  return { text: '—', color: 'var(--text)' };
}

export default function PlayerDashboard() {
  const { state, advanceDay, setCurrentDate, dismissDailyPulse, setMonthlyGoal, dismissMonthlyGoalPrompt, markUpdateSeen } = useGame();
  const navigate = useNavigate();
  const player = state.careerPlayer;
  const [showWelcome, setShowWelcome] = useState(() => !hasSeenPlayerWelcome());
  const [showWhatsNew, setShowWhatsNew] = useState(() => state.livelife.seenUpdateVersion !== CURRENT_UPDATE_VERSION);
  const defaultMetric = player ? metricForPosition(player.position) : 'goals';
  const [goalMetric, setGoalMetric] = useState<MonthlyGoalMetric>(defaultMetric);
  const [goalTarget, setGoalTarget] = useState(suggestedTarget(defaultMetric));
  const [goalRatingTarget, setGoalRatingTarget] = useState(7);
  const [useRatingTarget, setUseRatingTarget] = useState(true);

  const avgRating = useMemo(
    () => calcAverageRating(state.matches),
    [state.matches],
  );

  if (!player) return null;

  const recentMatches = state.matches.filter(m => m.status === 'completed').slice(-5).reverse();
  const nextMatch = state.matches
    .filter(m => m.status === 'scheduled')
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const s = player.seasonStats;
  const clubName = player.currentClub.name;

  function matchClub(match: typeof state.matches[0]) {
    return getPlayerMatchClubName(match, clubName);
  }

  const todayMatch = state.currentDate && nextMatch?.date.slice(0, 10) === state.currentDate.slice(0, 10)
    ? nextMatch
    : null;
  const activeInjury = state.currentDate
    ? player.injuries.find(i => isInjuryActive(i, state.currentDate!))
    : undefined;

  function handleAdvanceDay() {
    if (!state.currentDate) {
      setCurrentDate(new Date().toISOString().slice(0, 10));
      return;
    }
    const result = advanceDay();
    if (result.matchId) {
      navigate(`/player/match/${result.matchId}/play`);
    }
  }

  let dayMeta: string;
  if (!state.currentDate) {
    dayMeta = 'Ative o calendário contínuo para acompanhar lesões e o dia a dia da carreira';
  } else if (todayMatch) {
    dayMeta = `Partida agendada para hoje · ${todayMatch.competition} · ${locationLabel(todayMatch.location)}`;
  } else if (activeInjury) {
    const remaining = activeInjury.returnDate ? daysUntil(state.currentDate, activeInjury.returnDate) : null;
    dayMeta = remaining != null && remaining > 0
      ? `Lesionado (${activeInjury.type}) · volta em ${remaining} ${remaining === 1 ? 'dia' : 'dias'}`
      : `Lesionado (${activeInjury.type}) · sem previsão de retorno`;
  } else if (nextMatch) {
    const remaining = daysUntil(state.currentDate, nextMatch.date);
    dayMeta = `Próximo jogo: ${nextMatch.opponent} em ${remaining} ${remaining === 1 ? 'dia' : 'dias'}`;
  } else {
    dayMeta = 'Nenhuma partida agendada — avance o calendário ou agende um jogo';
  }

  const preMatchPress = findPlayerPreMatchOpportunity({
    matches: state.matches,
    currentDate: state.currentDate,
    livelife: state.livelife,
  });
  const postMatchPress = !preMatchPress
    ? findPlayerPostMatchOpportunity({ matches: state.matches, livelife: state.livelife })
    : null;
  const pressOpportunity = preMatchPress
    ? { match: preMatchPress, ctx: 'pre_match' as const }
    : postMatchPress
      ? { match: postMatchPress, ctx: 'post_match' as const }
      : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{player.name}</h1>
          <p className={styles.sub}>
            {POSITION_LABELS[player.position] ?? player.position} · {player.age} anos
            {' · '}{clubName}
          </p>
        </div>
        <div className={styles.budget}>OVR {player.overall}</div>
      </header>

      <div className={shared.ovrBar}>
        <div className={shared.ovrRow}>
          <span className={shared.ovrLabel}>OVR</span>
          <div className={shared.ovrTrack}>
            <div className={shared.ovrFill} style={{ width: `${player.overall}%` }} />
          </div>
          <span className={shared.ovrValue}>{player.overall}</span>
        </div>
        <div className={shared.ovrRow}>
          <span className={shared.ovrLabel}>POT</span>
          <div className={shared.ovrTrack}>
            <div className={`${shared.ovrFill} ${shared.ovrFillPot}`} style={{ width: `${player.potential}%` }} />
          </div>
          <span className={shared.ovrValue}>{player.potential}</span>
        </div>
      </div>

      <div className={styles.dayControls}>
        <button
          type="button"
          className={styles.advanceDayBanner}
          onClick={handleAdvanceDay}
        >
          <div className={styles.nextMatchLeft}>
            <span className={styles.nextMatchLabel}>
              {state.currentDate
                ? formatGameDate(state.currentDate, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
                : 'Calendário inativo'}
            </span>
            <span className={styles.nextMatchTeams}>
              {todayMatch ? `Dia de jogo · ${todayMatch.opponent}` : state.currentDate ? 'Avançar Dia' : 'Ativar calendário'}
            </span>
            <span className={styles.nextMatchMeta}>{dayMeta}</span>
          </div>
          <span className={styles.nextMatchCta}>
            {todayMatch ? 'Jogar →' : state.currentDate ? 'Avançar →' : 'Ativar →'}
          </span>
        </button>
      </div>

      {!nextMatch && !todayMatch && (
        <button
          type="button"
          className={styles.nextMatchEmpty}
          onClick={() => navigate('/player/matches')}
        >
          Nenhuma partida agendada — <strong>agendar agora</strong>
        </button>
      )}

      {pressOpportunity && (
        <button
          type="button"
          className={styles.nextMatchCard}
          onClick={() => navigate(`/player/press?ctx=${pressOpportunity.ctx}`)}
        >
          <div className={styles.nextMatchLabel}>Coletiva de imprensa</div>
          <div className={styles.nextMatchMain}>
            <span className={styles.nextMatchTeams}>
              {pressOpportunity.ctx === 'pre_match' ? 'Antes do jogo' : 'Depois do jogo'} vs {pressOpportunity.match.opponent}
            </span>
            <span className={styles.nextMatchMeta}>
              A imprensa quer falar com você.
            </span>
          </div>
          <span className={styles.nextMatchCta}>Falar com a imprensa →</span>
        </button>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Temporada {state.season}</h2>
        <div className={styles.statsGrid}>
          <StatCard label="Jogos" value={s.matches} accent />
          <StatCard label="Gols" value={s.goals} color="green" />
          <StatCard label="Assistências" value={s.assists} />
          <StatCard
            label="Nota média"
            value={avgRating != null ? avgRating.toFixed(1) : '—'}
            color={avgRating != null && avgRating >= 7 ? 'green' : 'default'}
          />
          <StatCard label="Cartões A" value={s.yellowCards} color="yellow" />
          <StatCard label="Cartões V" value={s.redCards} color="red" />
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className={shared.confidenceBar}>
          <p className={shared.confidenceLabel}>Confiança do técnico</p>
          <div className={shared.confidenceTrack}>
            <div className={shared.confidenceFill} style={{ width: `${player.coachConfidence}%` }} />
          </div>
          <p className={shared.confidenceValue}>{player.coachConfidence}%</p>
        </div>
        <div className={shared.contractCard}>
          <span className={shared.contractLabel}>Contrato</span>
          <span className={shared.contractValue}>
            {player.contractYearsLeft > 0
              ? `${player.contractYearsLeft} ${player.contractYearsLeft === 1 ? 'ano' : 'anos'}`
              : 'Expirado'}
          </span>
          <span className={shared.contractSub}>{formatSalary(player.salary)}</span>
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Últimas Partidas</h2>
        {recentMatches.length === 0 ? (
          <div className={styles.empty}>
            <p>Nenhuma partida registrada ainda.</p>
            <p>Agende em <strong>Registro de Partida</strong> ou <strong>Calendário</strong>.</p>
          </div>
        ) : (
          <div className={styles.matchList}>
            {recentMatches.map(match => {
              const res = resultLabel(match.result);
              const ha = getHomeAway(matchClub(match), match);
              const perf = match.playerPerformance;
              return (
                <div key={match.id} className={styles.matchRow}>
                  <div className={styles.matchResult} style={{ color: res.color }}>{res.text}</div>
                  <div className={styles.matchInfo}>
                    <span className={styles.matchOpponent}>
                      {ha.homeTeam} x {ha.awayTeam}
                    </span>
                    <span className={styles.matchComp}>
                      {match.competition}
                      {perf && perf.rating != null && ` · Nota ${perf.rating.toFixed(1)}`}
                      {perf && perf.goals > 0 && ` · ${perf.goals} gol${perf.goals > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <div className={styles.matchScore}>{ha.homeGoals} – {ha.awayGoals}</div>
                  <div className={styles.matchDate}>
                    {new Date(`${match.date.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Últimos eventos</h2>
        {state.pulse.history.length === 0 ? (
          <div className={styles.empty}>
            <p>Nada aconteceu ainda fora das partidas.</p>
            <p>Avance o dia para acompanhar o dia a dia da carreira.</p>
          </div>
        ) : (
          <div className={styles.matchList}>
            {state.pulse.history.slice(0, 6).map(entry => (
              <div key={entry.id} className={styles.matchRow}>
                <div className={styles.matchInfo}>
                  <span className={styles.matchOpponent}>{entry.titulo}</span>
                  <span className={styles.matchComp}>
                    {CATEGORIA_LABELS_PLAYER[entry.categoria] ?? entry.categoria}
                    {entry.raridade && ` · ${RARIDADE_LABELS[entry.raridade] ?? entry.raridade}`}
                  </span>
                </div>
                <div className={styles.matchDate}>{formatPulseDate(entry.data)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showWelcome && (
        <Tutorial
          steps={PLAYER_WELCOME_TUTORIAL}
          onComplete={() => {
            markPlayerWelcomeSeen();
            setShowWelcome(false);
            // Carreira novinha em folha não precisa de "o que há de novo" — já viu tudo agora.
            markUpdateSeen(CURRENT_UPDATE_VERSION);
          }}
        />
      )}

      {!showWelcome && showWhatsNew && (
        <Tutorial
          steps={PLAYER_WHATS_NEW_V16}
          onComplete={() => {
            markUpdateSeen(CURRENT_UPDATE_VERSION);
            setShowWhatsNew(false);
          }}
        />
      )}

      {state.pendingDailyPulse && (
        <div className={pulseStyles.overlayPage} role="dialog" aria-labelledby="player-daily-pulse-title">
          <div className={pulseStyles.shell}>
            <p className={pulseStyles.eyebrow}>Pulse do dia</p>
            <h1 className={pulseStyles.brand}>Pulse</h1>
            <p className={pulseStyles.slogan}>O pulso da sua carreira entre as partidas</p>

            <article className={`${pulseStyles.card} ${pulseStyles.cardEvent}`}>
              <div className={pulseStyles.badges}>
                <span className={pulseStyles.cat}>
                  {CATEGORIA_LABELS_PLAYER[state.pendingDailyPulse.categoria] ?? state.pendingDailyPulse.categoria}
                </span>
                {state.pendingDailyPulse.raridade && (
                  <span className={pulseStyles.rar}>
                    {RARIDADE_LABELS[state.pendingDailyPulse.raridade] ?? state.pendingDailyPulse.raridade}
                  </span>
                )}
              </div>
              <h2 id="player-daily-pulse-title" className={pulseStyles.eventTitle}>
                {state.pendingDailyPulse.titulo}
              </h2>
              <p className={pulseStyles.desc}>{state.pendingDailyPulse.descricao}</p>
              {state.pendingDailyPulse.impactos.length > 0 && (
                <div className={pulseStyles.impacts}>
                  <p className={pulseStyles.impactsLabel}>O que isso impacta</p>
                  <ul>
                    {state.pendingDailyPulse.impactos.map((imp, i) => (
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

      {state.pendingMonthlyGoalPrompt && !state.pendingDailyPulse && state.currentDate && (
        <div className={pulseStyles.overlayPage} role="dialog" aria-labelledby="player-monthly-goal-title">
          <div className={pulseStyles.shell}>
            <p className={pulseStyles.eyebrow}>Time</p>
            <h1 id="player-monthly-goal-title" className={pulseStyles.brand}>Meta do mês</h1>
            <p className={pulseStyles.slogan}>
              {new Date(state.currentDate).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              {' · '}{POSITION_LABELS[player.position] ?? player.position}
            </p>

            <article className={`${pulseStyles.card} ${pulseStyles.cardEvent}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label>
                  <span style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Meta principal</span>
                  <select
                    value={goalMetric}
                    onChange={e => {
                      const m = e.target.value as MonthlyGoalMetric;
                      setGoalMetric(m);
                      setGoalTarget(suggestedTarget(m));
                    }}
                    style={{ width: '100%', padding: 8 }}
                  >
                    {(Object.keys(MONTHLY_GOAL_METRIC_LABELS) as MonthlyGoalMetric[]).map(m => (
                      <option key={m} value={m}>{MONTHLY_GOAL_METRIC_LABELS[m]}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Alvo no mês</span>
                  <input
                    type="number"
                    min={1}
                    value={goalTarget}
                    onChange={e => setGoalTarget(Number(e.target.value))}
                    style={{ width: '100%', padding: 8 }}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={useRatingTarget}
                    onChange={e => setUseRatingTarget(e.target.checked)}
                  />
                  <span>Também definir nota média alvo</span>
                </label>
                {useRatingTarget && (
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step={0.1}
                    value={goalRatingTarget}
                    onChange={e => setGoalRatingTarget(Number(e.target.value))}
                    style={{ width: '100%', padding: 8 }}
                  />
                )}
              </div>
            </article>

            <button
              type="button"
              className={pulseStyles.cta}
              onClick={() => setMonthlyGoal(goalMetric, goalTarget, useRatingTarget ? goalRatingTarget : undefined)}
            >
              Definir meta →
            </button>
            <button
              type="button"
              className={styles.nextMatchEmpty}
              style={{ marginTop: 8 }}
              onClick={dismissMonthlyGoalPrompt}
            >
              Pular este mês
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
