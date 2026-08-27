import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ClubCrest from '../../../components/ClubCrest/ClubCrest';
import { useGame } from '../../../context/GameContext';
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY } from '../../../utils/clubColors';
import { formatGameDate } from '../../../livelife';
import { dayInWindow, windowTotalDays, isDateWithinWindow } from '../../../utils/nationalWindows';
import { aggregateCallUpOverview } from '../../../utils/nationalStats';
import { findNationalDeconvocationOpportunity } from '../../../pulse/nationalEvents';
import styles from './NationalDashboard.module.css';

export default function NationalDashboard() {
  const { state, resolveNationalDeconvocation } = useGame();
  const navigate = useNavigate();
  const nationalTeam = state.nationalTeam;

  const activeOrNextWindow = useMemo(() => {
    if (!nationalTeam || nationalTeam.windows.length === 0) return null;
    const today = state.currentDate?.slice(0, 10);
    const sorted = [...nationalTeam.windows].sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (!today) return sorted[0];
    return (
      sorted.find(w => isDateWithinWindow(w, today)) ??
      sorted.find(w => w.startDate.slice(0, 10) > today) ??
      sorted[sorted.length - 1]
    );
  }, [nationalTeam, state.currentDate]);

  const leaders = useMemo(() => {
    if (!nationalTeam) return null;
    const rows = aggregateCallUpOverview(nationalTeam, null);
    if (rows.length === 0) return null;
    const topScorer = [...rows].sort((a, b) => b.goals - a.goals)[0];
    const topAssist = [...rows].sort((a, b) => b.assists - a.assists)[0];
    const topRating = rows
      .filter(r => r.avgRating != null)
      .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))[0];
    return {
      topScorer: topScorer.goals > 0 ? topScorer : null,
      topAssist: topAssist.assists > 0 ? topAssist : null,
      topRating: topRating ?? null,
    };
  }, [nationalTeam]);

  const rankingChange = useMemo(() => {
    const hist = nationalTeam?.fifaRankingHistory ?? [];
    if (hist.length < 2) return null;
    return hist[hist.length - 1].value - hist[hist.length - 2].value;
  }, [nationalTeam]);

  const deconvocation = useMemo(() => {
    if (!nationalTeam) return null;
    return findNationalDeconvocationOpportunity(nationalTeam, state.players, state.currentDate);
  }, [nationalTeam, state.players, state.currentDate]);

  if (!nationalTeam) return null;

  const primary = nationalTeam.primaryColor ?? DEFAULT_PRIMARY;
  const secondary = nationalTeam.secondaryColor ?? DEFAULT_SECONDARY;
  const moodTone =
    nationalTeam.federationMood >= 65
      ? styles.moodHigh
      : nationalTeam.federationMood >= 35
        ? styles.moodMid
        : styles.moodLow;

  const isActive = activeOrNextWindow && state.currentDate
    ? isDateWithinWindow(activeOrNextWindow, state.currentDate)
    : false;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroBrand}>
          <ClubCrest primary={primary} secondary={secondary} size={44} title={nationalTeam.name} />
          <div>
            <p className={styles.heroEyebrow}>Modo Seleção · Dual Career</p>
            <h1 className={styles.heroTitle}>{nationalTeam.name}</h1>
            <p className={styles.heroSub}>
              Assumida em {formatGameDate(nationalTeam.onboardedAt, { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className={styles.rankingBadge}>
          <span className={styles.rankingLabel}>Ranking FIFA</span>
          <span className={styles.rankingValue}>
            #{nationalTeam.fifaRanking}
            {rankingChange != null && rankingChange !== 0 && (
              <span className={rankingChange < 0 ? styles.rankingUp : styles.rankingDown}>
                {' '}
                {rankingChange < 0 ? '↑' : '↓'}
                {Math.abs(rankingChange)}
              </span>
            )}
          </span>
        </div>
      </header>

      {deconvocation && (
        <div className={styles.pulseCard}>
          <div>
            <p className={styles.pulseEyebrow}>Pulse Internacional · Pedido do clube</p>
            <p className={styles.pulseText}>
              A diretoria do {state.team?.name ?? 'clube'} pede a liberação de{' '}
              <strong>{deconvocation.clubPlayerName}</strong> deste amistoso ({deconvocation.windowLabel}) —
              não vale o risco de lesão numa partida sem peso.
            </p>
          </div>
          <div className={styles.pulseActions}>
            <button
              type="button"
              className={styles.pulseBtnSecondary}
              onClick={() =>
                resolveNationalDeconvocation(deconvocation.windowId, deconvocation.nationalPlayerId, 'refuse')
              }
            >
              Recusar
            </button>
            <button
              type="button"
              className={styles.pulseBtnPrimary}
              onClick={() =>
                resolveNationalDeconvocation(deconvocation.windowId, deconvocation.nationalPlayerId, 'cede')
              }
            >
              Ceder
            </button>
          </div>
        </div>
      )}

      {activeOrNextWindow ? (
        <div className={styles.fifaHero}>
          <div>
            <p className={styles.fifaHeroEyebrow}>{isActive ? 'Data FIFA em andamento' : 'Próxima Data FIFA'}</p>
            <h2 className={styles.fifaHeroTitle}>{activeOrNextWindow.label}</h2>
            <p className={styles.fifaHeroMeta}>
              {formatGameDate(activeOrNextWindow.startDate, { day: '2-digit', month: 'short' })}
              {' – '}
              {formatGameDate(activeOrNextWindow.endDate, { day: '2-digit', month: 'short', year: 'numeric' })}
              {isActive && state.currentDate
                ? ` · Dia ${dayInWindow(activeOrNextWindow, state.currentDate)} de ${windowTotalDays(activeOrNextWindow)}`
                : ''}
              {' · '}
              {activeOrNextWindow.callUpIds.length}/{activeOrNextWindow.listSize} convocados ·{' '}
              {activeOrNextWindow.games.filter(g => g.played).length}/{activeOrNextWindow.games.length} jogos disputados
            </p>
          </div>
          <button
            type="button"
            className={styles.fifaHeroCta}
            onClick={() => navigate(`/national/windows/${activeOrNextWindow.id}`)}
          >
            Entrar na Data FIFA →
          </button>
        </div>
      ) : (
        <div className={styles.fifaHero}>
          <div>
            <p className={styles.fifaHeroEyebrow}>Data FIFA</p>
            <h2 className={styles.fifaHeroTitle}>Nenhuma Data FIFA cadastrada</h2>
            <p className={styles.fifaHeroMeta}>Crie a primeira janela para começar a convocar e jogar.</p>
          </div>
          <button type="button" className={styles.fifaHeroCta} onClick={() => navigate('/national/windows')}>
            Criar Data FIFA →
          </button>
        </div>
      )}

      <div className={styles.moodCard}>
        <div className={styles.moodTop}>
          <span className={styles.moodLabel}>Moral da Federação</span>
          <span className={`${styles.moodValue} ${moodTone}`}>{nationalTeam.federationMood}%</span>
        </div>
        <div className={styles.moodTrack}>
          <div className={`${styles.moodFill} ${moodTone}`} style={{ width: `${nationalTeam.federationMood}%` }} />
        </div>
      </div>

      {leaders && (leaders.topScorer || leaders.topAssist || leaders.topRating) && (
        <div className={styles.leadersGrid}>
          {leaders.topScorer && (
            <div className={styles.leaderCard}>
              <p className={styles.leaderLabel}>Artilheiro</p>
              <p className={styles.leaderName}>{leaders.topScorer.name}</p>
              <p className={styles.leaderValue}>{leaders.topScorer.goals} gols</p>
            </div>
          )}
          {leaders.topAssist && (
            <div className={styles.leaderCard}>
              <p className={styles.leaderLabel}>Líder de Assistências</p>
              <p className={styles.leaderName}>{leaders.topAssist.name}</p>
              <p className={styles.leaderValue}>{leaders.topAssist.assists} assist.</p>
            </div>
          )}
          {leaders.topRating && (
            <div className={styles.leaderCard}>
              <p className={styles.leaderLabel}>Maior Nota Média</p>
              <p className={styles.leaderName}>{leaders.topRating.name}</p>
              <p className={styles.leaderValue}>{leaders.topRating.avgRating!.toFixed(1)}</p>
            </div>
          )}
        </div>
      )}

      <div className={styles.grid}>
        <button type="button" className={styles.card} onClick={() => navigate('/national/windows')}>
          <span className={styles.cardIcon}>📅</span>
          <p className={styles.cardTitle}>Datas FIFA</p>
          <p className={styles.cardValue}>{nationalTeam.windows.length}</p>
          <p className={styles.cardHint}>janelas cadastradas</p>
        </button>
        <button type="button" className={styles.card} onClick={() => navigate('/national/players')}>
          <span className={styles.cardIcon}>👥</span>
          <p className={styles.cardTitle}>Base de Jogadores</p>
          <p className={styles.cardValue}>{nationalTeam.talentPool.length}</p>
          <p className={styles.cardHint}>atletas na base</p>
        </button>
        <button type="button" className={styles.card} onClick={() => navigate('/national/history')}>
          <span className={styles.cardIcon}>📊</span>
          <p className={styles.cardTitle}>Histórico</p>
          <p className={styles.cardValue}>
            {nationalTeam.windows.flatMap(w => w.games).filter(g => g.played).length}
          </p>
          <p className={styles.cardHint}>jogos disputados</p>
        </button>
        <button type="button" className={styles.card} onClick={() => navigate('/national/board')}>
          <span className={styles.cardIcon}>🏛️</span>
          <p className={styles.cardTitle}>Diretoria</p>
          <p className={styles.cardValue}>{nationalTeam.goals.length}</p>
          <p className={styles.cardHint}>metas da federação</p>
        </button>
      </div>
    </div>
  );
}
