import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../../components/StatCard/StatCard';
import Tutorial from '../../components/Tutorial/Tutorial';
import { useGame } from '../../context/GameContext';
import { getHomeAway, locationLabel } from '../../utils/matchStats';
import { WELCOME_TUTORIAL, hasSeenWelcome, markWelcomeSeen } from '../../utils/tutorials';
import styles from './Dashboard.module.css';

function formatBudget(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`;
  return `R$ ${value}`;
}

function resultLabel(result: string | null): { text: string; color: string } {
  if (result === 'win') return { text: 'V', color: 'var(--success)' };
  if (result === 'draw') return { text: 'E', color: 'var(--warning)' };
  if (result === 'loss') return { text: 'D', color: 'var(--danger)' };
  return { text: '—', color: 'var(--text)' };
}

export default function Dashboard() {
  const { state } = useGame();
  const navigate = useNavigate();
  const { team, matches, manager } = state;
  const [showWelcome, setShowWelcome] = useState(() => !hasSeenWelcome());

  if (!team) return null;

  const recentMatches = matches.filter(m => m.status === 'completed').slice(0, 5);
  const nextMatch = matches
    .filter(m => m.status === 'scheduled')
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const { statistics: s } = team;

  const topScorers = useMemo(
    () => [...state.players]
      .filter(p => p.stats.goals > 0)
      .sort((a, b) => b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists)
      .slice(0, 5),
    [state.players],
  );

  const topAssists = useMemo(
    () => [...state.players]
      .filter(p => p.stats.assists > 0)
      .sort((a, b) => b.stats.assists - a.stats.assists || b.stats.goals - a.stats.goals)
      .slice(0, 5),
    [state.players],
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{team.name}</h1>
          <p className={styles.sub}>
            Temporada {state.season}
            {manager && ` · ${manager.name}`}
          </p>
        </div>
        <div className={styles.budget}>{formatBudget(team.budget)}</div>
      </header>

      {nextMatch ? (
        <button
          type="button"
          className={styles.nextMatchCard}
          onClick={() => navigate(`/match/${nextMatch.id}/play`)}
        >
          <div className={styles.nextMatchLabel}>Próxima Partida</div>
          <div className={styles.nextMatchMain}>
            <span className={styles.nextMatchTeams}>
              {team.name} × {nextMatch.opponent}
            </span>
            <span className={styles.nextMatchMeta}>
              {new Date(nextMatch.date).toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
              })}
              {' · '}{nextMatch.competition}
              {' · '}{locationLabel(nextMatch.location)}
            </span>
          </div>
          <span className={styles.nextMatchCta}>Preparar Escalação →</span>
        </button>
      ) : (
        <div className={styles.noNextMatch}>
          Nenhuma partida agendada.{' '}
          <button type="button" onClick={() => navigate('/matches')}>Agendar partida</button>
        </div>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Indicadores</h2>
        <div className={styles.statsGrid}>
          <StatCard
            label="Confiança da Diretoria"
            value={`${team.boardConfidence}%`}
            color={team.boardConfidence >= 70 ? 'green' : team.boardConfidence >= 40 ? 'yellow' : 'red'}
          />
          <StatCard
            label="Confiança da Torcida"
            value={`${team.supporterConfidence}%`}
            color={team.supporterConfidence >= 70 ? 'green' : team.supporterConfidence >= 40 ? 'yellow' : 'red'}
          />
          <StatCard label="Pontos" value={s.points} accent />
          <StatCard label="Partidas" value={s.matches} />
          <StatCard label="Vitórias" value={s.wins} color="green" />
          <StatCard label="Empates" value={s.draws} color="yellow" />
          <StatCard label="Derrotas" value={s.losses} color="red" />
          <StatCard
            label="Saldo de Gols"
            value={s.goalsFor - s.goalsAgainst > 0 ? `+${s.goalsFor - s.goalsAgainst}` : String(s.goalsFor - s.goalsAgainst)}
            sub={`${s.goalsFor} pró · ${s.goalsAgainst} contra`}
            color={s.goalsFor - s.goalsAgainst >= 0 ? 'green' : 'red'}
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Destaques do elenco</h2>
        <div className={styles.leadersGrid}>
          <div className={styles.leaderCard}>
            <h3 className={styles.leaderTitle}>⚽ Artilheiros</h3>
            {topScorers.length === 0 ? (
              <p className={styles.leaderEmpty}>Nenhum gol registrado ainda.</p>
            ) : (
              <table className={styles.leaderTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Jogador</th>
                    <th>Gols</th>
                  </tr>
                </thead>
                <tbody>
                  {topScorers.map((p, i) => (
                    <tr key={p.id}>
                      <td>{i + 1}</td>
                      <td>{p.name}</td>
                      <td className={styles.leaderStat}>{p.stats.goals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={styles.leaderCard}>
            <h3 className={styles.leaderTitle}>🅰️ Assistências</h3>
            {topAssists.length === 0 ? (
              <p className={styles.leaderEmpty}>Nenhuma assistência registrada ainda.</p>
            ) : (
              <table className={styles.leaderTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Jogador</th>
                    <th>Ass</th>
                  </tr>
                </thead>
                <tbody>
                  {topAssists.map((p, i) => (
                    <tr key={p.id}>
                      <td>{i + 1}</td>
                      <td>{p.name}</td>
                      <td className={styles.leaderStat}>{p.stats.assists}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Últimas Partidas</h2>
        {recentMatches.length === 0 ? (
          <div className={styles.empty}>
            <p>Nenhuma partida registrada ainda.</p>
            <p>Agende sua primeira partida em <strong>Registro de Partida</strong> ou <strong>Calendário</strong>.</p>
          </div>
        ) : (
          <div className={styles.matchList}>
            {recentMatches.map(match => {
              const res = resultLabel(match.result);
              const ha = getHomeAway(team.name, match);
              return (
                <div key={match.id} className={styles.matchRow}>
                  <div className={styles.matchResult} style={{ color: res.color }}>
                    {res.text}
                  </div>
                  <div className={styles.matchInfo}>
                    <span className={styles.matchOpponent}>
                      {ha.homeTeam} x {ha.awayTeam}
                    </span>
                    <span className={styles.matchComp}>{match.competition}</span>
                  </div>
                  <div className={styles.matchScore}>
                    {ha.homeGoals} – {ha.awayGoals}
                  </div>
                  <div className={styles.matchDate}>
                    {new Date(match.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
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
