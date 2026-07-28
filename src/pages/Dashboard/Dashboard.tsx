import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Tutorial from '../../components/Tutorial/Tutorial';
import ClubCrest from '../../components/ClubCrest/ClubCrest';
import { useGame } from '../../context/GameContext';
import { calcPlayerAverageRating, getHomeAway, locationLabel } from '../../utils/matchStats';
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY } from '../../utils/clubColors';
import { WELCOME_TUTORIAL, hasSeenWelcome, markWelcomeSeen } from '../../utils/tutorials';
import { formatMoney, wageBill, runwayMonths } from '../../utils/finance';
import { boardStatus } from '../../types/Board';
import styles from './Dashboard.module.css';

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
  const { state } = useGame();
  const navigate = useNavigate();
  const { team, matches, manager, finance, board, transfers, players } = state;
  const [showWelcome, setShowWelcome] = useState(() => !hasSeenWelcome());

  const recentMatches = useMemo(
    () => matches.filter(m => m.status === 'completed').slice(0, 5),
    [matches],
  );
  const nextMatch = useMemo(
    () =>
      matches
        .filter(m => m.status === 'scheduled')
        .sort((a, b) => a.date.localeCompare(b.date))[0],
    [matches],
  );

  const topScorers = useMemo(
    () =>
      [...players]
        .filter(p => p.stats.goals > 0)
        .sort((a, b) => b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists)
        .slice(0, 5),
    [players],
  );

  const topAssists = useMemo(
    () =>
      [...players]
        .filter(p => p.stats.assists > 0)
        .sort((a, b) => b.stats.assists - a.stats.assists || b.stats.goals - a.stats.goals)
        .slice(0, 5),
    [players],
  );

  const topRatings = useMemo(() => {
    return [...players]
      .map(p => ({
        player: p,
        avg: calcPlayerAverageRating(p.id, matches),
      }))
      .filter((x): x is { player: typeof players[0]; avg: number } => x.avg != null)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  }, [players, matches]);

  const bill = useMemo(() => wageBill(players), [players]);
  const runway = useMemo(() => runwayMonths(finance, players), [finance, players]);
  const recentLedger = useMemo(() => finance.ledger.slice(0, 4), [finance.ledger]);
  const recentTransfers = useMemo(() => transfers.history.slice(0, 4), [transfers.history]);
  const activeGoals = useMemo(
    () => board.goals.filter(g => g.status === 'active').slice(0, 3),
    [board.goals],
  );
  const seasonIncome = useMemo(
    () => finance.ledger.filter(e => e.season === state.season && e.amount > 0).reduce((s, e) => s + e.amount, 0),
    [finance.ledger, state.season],
  );
  const seasonExpense = useMemo(
    () => finance.ledger.filter(e => e.season === state.season && e.amount < 0).reduce((s, e) => s + e.amount, 0),
    [finance.ledger, state.season],
  );

  if (!team) return null;

  const { statistics: s } = team;
  const gd = s.goalsFor - s.goalsAgainst;
  const gdText = gd > 0 ? `+${gd}` : String(gd);
  const confStatus = boardStatus(team.boardConfidence);

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
          onClick={() =>
            nextMatch
              ? navigate(`/match/${nextMatch.id}/pulse`)
              : navigate('/matches')
          }
        >
          <span className={styles.quickIcon}>▶</span>
          {nextMatch ? 'Jogar' : 'Partidas'}
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

      {nextMatch ? (
        <button
          type="button"
          className={styles.nextMatch}
          onClick={() => navigate(`/match/${nextMatch.id}/pulse`)}
        >
          <div className={styles.nextMatchLeft}>
            <span className={styles.nextMatchLabel}>Próxima partida</span>
            <span className={styles.nextMatchTeams}>
              {team.name} <span className={styles.nextVs}>×</span> {nextMatch.opponent}
            </span>
            <span className={styles.nextMatchMeta}>
              {new Date(nextMatch.date).toLocaleDateString('pt-BR', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
              })}
              {' · '}
              {nextMatch.competition}
              {' · '}
              {locationLabel(nextMatch.location)}
            </span>
          </div>
          <span className={styles.nextMatchCta}>Jogar →</span>
        </button>
      ) : (
        <button
          type="button"
          className={styles.nextMatchEmpty}
          onClick={() => navigate('/matches')}
        >
          Nenhuma partida agendada — <strong>agendar agora</strong>
        </button>
      )}

      {/* Hub: Financeiro / Diretoria / Transferências */}
      <section className={styles.hubGrid} aria-label="Gestão do clube">
        <button type="button" className={styles.hubCard} onClick={() => navigate('/financas')}>
          <div className={styles.hubHead}>
            <h2 className={styles.hubTitle}>Financeiro</h2>
            <span className={styles.hubArrow}>→</span>
          </div>
          <p className={styles.hubBig}>{formatMoney(finance.balance, finance.currency)}</p>
          <div className={styles.hubMeta}>
            <span>Folha {formatMoney(bill, finance.currency)}/mês</span>
            <span>
              Runway {runway === Infinity ? '∞' : `${runway}m`}
            </span>
          </div>
          <div className={styles.hubMeta}>
            <span className={styles.hubIn}>+{formatMoney(seasonIncome, finance.currency)}</span>
            <span className={styles.hubOut}>{formatMoney(seasonExpense, finance.currency)}</span>
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
          <p className={styles.hubBig}>{team.boardConfidence}%</p>
          <div className={styles.hubMeta}>
            <span className={styles[`hubStatus_${confStatus}`]}>
              {BOARD_STATUS_LABEL[confStatus]}
            </span>
            <span>{activeGoals.length} meta{activeGoals.length !== 1 ? 's' : ''} ativa{activeGoals.length !== 1 ? 's' : ''}</span>
          </div>
          {activeGoals.length > 0 ? (
            <ul className={styles.hubList}>
              {activeGoals.map(g => (
                <li key={g.id}>
                  <span className={styles.hubListName}>{g.label}</span>
                  <span className={styles.hubListMuted}>{g.current}/{g.target}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.hubEmpty}>Nenhuma meta definida.</p>
          )}
        </button>

        <button type="button" className={styles.hubCard} onClick={() => navigate('/transferencias')}>
          <div className={styles.hubHead}>
            <h2 className={styles.hubTitle}>Transferências</h2>
            <span className={styles.hubArrow}>→</span>
          </div>
          <p className={styles.hubBig}>{transfers.history.length}</p>
          <div className={styles.hubMeta}>
            <span>{transfers.watchlist.length} na observação</span>
            <span>{players.filter(p => p.status === 'Transferível').length} transferíveis</span>
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
            <p className={styles.hubEmpty}>Nenhuma operação ainda.</p>
          )}
        </button>
      </section>

      <section className={styles.formStrip} aria-label="Desempenho da temporada">
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
              <p className={styles.leaderEmpty}>Sem gols ainda.</p>
            ) : (
              <ol className={styles.leaderList}>
                {topScorers.map((p, i) => (
                  <li key={p.id}>
                    <span className={styles.leaderRank}>{i + 1}</span>
                    <span className={styles.leaderName}>{p.name}</span>
                    <span className={styles.leaderStat}>{p.stats.goals}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className={styles.leaderCard}>
            <h3 className={styles.leaderTitle}>Assistências</h3>
            {topAssists.length === 0 ? (
              <p className={styles.leaderEmpty}>Sem assistências ainda.</p>
            ) : (
              <ol className={styles.leaderList}>
                {topAssists.map((p, i) => (
                  <li key={p.id}>
                    <span className={styles.leaderRank}>{i + 1}</span>
                    <span className={styles.leaderName}>{p.name}</span>
                    <span className={styles.leaderStat}>{p.stats.assists}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className={styles.leaderCard}>
            <h3 className={styles.leaderTitle}>Nota média</h3>
            {topRatings.length === 0 ? (
              <p className={styles.leaderEmpty}>Sem notas ainda.</p>
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
            Ainda sem jogos. Agende a primeira partida e registre o resultado.
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
