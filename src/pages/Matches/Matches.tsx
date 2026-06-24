import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MatchScheduleModal from '../../components/MatchScheduleModal/MatchScheduleModal';
import { useGame } from '../../context/GameContext';
import type { Match } from '../../types/Match';
import { getHomeAway, locationLabel } from '../../utils/matchStats';
import styles from './Matches.module.css';

function resultLabel(result: string | null): { text: string; color: string } {
  if (result === 'win') return { text: 'Vitória', color: 'var(--success)' };
  if (result === 'draw') return { text: 'Empate', color: 'var(--warning)' };
  if (result === 'loss') return { text: 'Derrota', color: 'var(--danger)' };
  return { text: 'Agendada', color: 'var(--accent)' };
}

export default function MatchRegistration() {
  const { state, scheduleMatch, updateScheduledMatch } = useGame();
  const navigate = useNavigate();
  const teamName = state.team?.name ?? '';

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  const scheduled = state.matches.filter(m => m.status === 'scheduled');
  const completed = state.matches.filter(m => m.status === 'completed');

  function openNew() {
    setEditingMatch(null);
    setModalOpen(true);
  }

  function openEdit(match: Match) {
    setEditingMatch(match);
    setModalOpen(true);
  }

  function handleSubmit(data: {
    opponent: string;
    date: string;
    location: Match['location'];
    competition: string;
  }) {
    if (editingMatch) {
      updateScheduledMatch(editingMatch.id, data);
    } else {
      scheduleMatch(data);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Registro de Partida</h1>
          <p className={styles.sub}>{state.matches.length} partidas no total</p>
        </div>
        <button className={styles.newBtn} onClick={openNew}>
          + Agendar Partida
        </button>
      </header>

      <MatchScheduleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        competitions={state.seasonCompetitions}
        title={editingMatch ? 'Editar Partida Agendada' : 'Agendar Partida'}
        initialData={editingMatch ? {
          opponent: editingMatch.opponent,
          date: editingMatch.date,
          location: editingMatch.location,
          competition: editingMatch.competition,
        } : undefined}
      />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Agendadas ({scheduled.length})</h2>
        {scheduled.length === 0 ? (
          <div className={styles.empty}>Nenhuma partida agendada.</div>
        ) : (
          <div className={styles.matchList}>
            {scheduled.map(match => (
              <div key={match.id} className={styles.matchCard}>
                <div className={styles.matchTop}>
                  <span className={styles.matchComp}>{match.competition}</span>
                  <span className={styles.matchDate}>
                    {new Date(match.date).toLocaleDateString('pt-BR')} · {locationLabel(match.location)}
                  </span>
                </div>
                <div className={styles.matchMain}>
                  <span className={styles.matchTeam}>{teamName}</span>
                  <span className={styles.matchVs}>×</span>
                  <span className={styles.matchTeam}>{match.opponent}</span>
                </div>
                <div className={styles.matchActions}>
                  <button type="button" className={styles.editBtn} onClick={() => openEdit(match)}>
                    Editar
                  </button>
                  <button type="button" className={styles.playBtn} onClick={() => navigate(`/match/${match.id}/play`)}>
                    Jogar Partida
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Realizadas ({completed.length})</h2>
        {completed.length === 0 ? (
          <div className={styles.empty}>Nenhuma partida realizada ainda.</div>
        ) : (
          <div className={styles.matchList}>
            {completed.map(match => {
              const res = resultLabel(match.result);
              const ha = getHomeAway(teamName, match);
              return (
                <div key={match.id} className={styles.matchCard}>
                  <div className={styles.matchTop}>
                    <span className={styles.matchComp}>{match.competition}</span>
                    <span className={styles.matchDate}>
                      {new Date(match.date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className={styles.matchMain}>
                    <span className={styles.matchTeam}>{ha.homeTeam}</span>
                    <span className={styles.matchScore}>{ha.homeGoals} – {ha.awayGoals}</span>
                    <span className={styles.matchTeam}>{ha.awayTeam}</span>
                  </div>
                  <div className={styles.matchBottom}>
                    <span className={styles.matchResult} style={{ color: res.color }}>{res.text}</span>
                    {match.goals.length > 0 && (
                      <span className={styles.matchScorers}>
                        ⚽ {match.goals.map(g => g.isOwnGoal ? `Gol Contra (${g.opponentScorerName})` : g.playerName).join(', ')}
                      </span>
                    )}
                  </div>
                  <div className={styles.matchActions}>
                    <button type="button" className={styles.editBtn} onClick={() => navigate(`/match/${match.id}/play`)}>
                      Editar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
