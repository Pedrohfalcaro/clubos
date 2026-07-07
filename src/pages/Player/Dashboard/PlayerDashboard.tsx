import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../../../components/StatCard/StatCard';
import Tutorial from '../../../components/Tutorial/Tutorial';
import { useGame } from '../../../context/GameContext';
import { getHomeAway, locationLabel } from '../../../utils/matchStats';
import { getPlayerMatchClubName } from '../../../utils/playerMatch';
import { calcAverageRating } from '../../../utils/playerStats';
import {
  PLAYER_WELCOME_TUTORIAL,
  hasSeenPlayerWelcome,
  markPlayerWelcomeSeen,
} from '../../../utils/playerTutorials';
import shared from '../PlayerShared.module.css';
import styles from '../../Dashboard/Dashboard.module.css';

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
  const { state } = useGame();
  const navigate = useNavigate();
  const player = state.careerPlayer;
  const [showWelcome, setShowWelcome] = useState(() => !hasSeenPlayerWelcome());

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

      {nextMatch ? (
        <button
          type="button"
          className={styles.nextMatchCard}
          onClick={() => navigate(`/player/match/${nextMatch.id}/play`)}
        >
          <div className={styles.nextMatchLabel}>Próxima Partida</div>
          <div className={styles.nextMatchMain}>
            <span className={styles.nextMatchTeams}>
              {clubName} × {nextMatch.opponent}
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
          <span className={styles.nextMatchCta}>Registrar Desempenho →</span>
        </button>
      ) : (
        <div className={styles.noNextMatch}>
          Nenhuma partida agendada.{' '}
          <button type="button" onClick={() => navigate('/player/matches')}>Agendar partida</button>
        </div>
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
          steps={PLAYER_WELCOME_TUTORIAL}
          onComplete={() => {
            markPlayerWelcomeSeen();
            setShowWelcome(false);
          }}
        />
      )}
    </div>
  );
}
