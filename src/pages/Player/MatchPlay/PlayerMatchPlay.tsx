import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../../../context/GameContext';
import type { PlayerMatchRole } from '../../../types/PlayerMatchPerformance';
import { locationLabel } from '../../../utils/matchStats';
import { getPlayerMatchClubName } from '../../../utils/playerMatch';
import styles from './PlayerMatchPlay.module.css';

const ROLES: { value: PlayerMatchRole; label: string }[] = [
  { value: 'starter', label: 'Titular' },
  { value: 'substitute', label: 'Reserva (entrou)' },
  { value: 'notCalled', label: 'Não relacionado' },
];

export default function PlayerMatchPlay() {
  const { matchId } = useParams<{ matchId: string }>();
  const { state, getMatch, completePlayerMatch, updatePlayerMatch } = useGame();
  const navigate = useNavigate();

  const match = matchId ? getMatch(matchId) : undefined;
  const player = state.careerPlayer;
  const isCompleted = match?.status === 'completed';
  const existing = match?.playerPerformance;

  const [goalsFor, setGoalsFor] = useState(match?.goalsFor ?? 0);
  const [goalsAgainst, setGoalsAgainst] = useState(match?.goalsAgainst ?? 0);
  const [role, setRole] = useState<PlayerMatchRole>(existing?.role ?? 'starter');
  const [minutes, setMinutes] = useState(existing?.minutesPlayed ?? 90);
  const [goals, setGoals] = useState(existing?.goals ?? 0);
  const [assists, setAssists] = useState(existing?.assists ?? 0);
  const [yellowCards, setYellowCards] = useState(existing?.yellowCards ?? 0);
  const [redCards, setRedCards] = useState(existing?.redCards ?? 0);
  const [rating, setRating] = useState<number | ''>(existing?.rating ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  if (!match || !player) {
    navigate('/player/matches');
    return null;
  }

  const currentMatch = match;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      matchId: currentMatch.id,
      goalsFor,
      goalsAgainst,
      performance: {
        role,
        minutesPlayed: role === 'notCalled' ? 0 : minutes,
        goals: role === 'notCalled' ? 0 : goals,
        assists: role === 'notCalled' ? 0 : assists,
        yellowCards: role === 'notCalled' ? 0 : yellowCards,
        redCards: role === 'notCalled' ? 0 : redCards,
        rating: rating === '' ? null : Number(rating),
        notes: notes.trim() || undefined,
      },
    };

    if (isCompleted) {
      updatePlayerMatch(input);
    } else {
      completePlayerMatch(input);
    }
    navigate('/player/matches');
  }

  const notCalled = role === 'notCalled';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{isCompleted ? 'Editar Partida' : 'Registrar Partida'}</h1>
        <p className={styles.sub}>Registre seu desempenho após jogar no EA FC</p>
      </header>

      <div className={styles.matchInfo}>
        <span className={styles.matchTeams}>{getPlayerMatchClubName(match, player.currentClub.name)} × {match.opponent}</span>
        <span className={styles.matchMeta}>
          {new Date(match.date).toLocaleDateString('pt-BR')}
          {' · '}{match.competition}
          {' · '}{locationLabel(match.location)}
        </span>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <h2 className={styles.sectionTitle}>Resultado do jogo</h2>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label>Gols do seu time</label>
            <input type="number" min={0} value={goalsFor} onChange={e => setGoalsFor(Number(e.target.value))} />
          </div>
          <div className={styles.field}>
            <label>Gols do adversário</label>
            <input type="number" min={0} value={goalsAgainst} onChange={e => setGoalsAgainst(Number(e.target.value))} />
          </div>
        </div>

        <h2 className={styles.sectionTitle}>Seu desempenho</h2>
        <div className={styles.field}>
          <label>Participação</label>
          <div className={styles.roleBtns}>
            {ROLES.map(r => (
              <button
                key={r.value}
                type="button"
                className={`${styles.roleBtn} ${role === r.value ? styles.roleBtnActive : ''}`}
                onClick={() => setRole(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {!notCalled && (
          <>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Minutos jogados</label>
                <input type="number" min={1} max={120} value={minutes} onChange={e => setMinutes(Number(e.target.value))} />
              </div>
              <div className={styles.field}>
                <label>Nota (1–10)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={0.1}
                  value={rating}
                  onChange={e => setRating(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Ex: 7.5"
                />
              </div>
            </div>

            <div className={styles.fieldRow3}>
              <div className={styles.field}>
                <label>Gols</label>
                <input type="number" min={0} value={goals} onChange={e => setGoals(Number(e.target.value))} />
              </div>
              <div className={styles.field}>
                <label>Assistências</label>
                <input type="number" min={0} value={assists} onChange={e => setAssists(Number(e.target.value))} />
              </div>
              <div className={styles.field}>
                <label>Cartão amarelo</label>
                <input type="number" min={0} max={2} value={yellowCards} onChange={e => setYellowCards(Number(e.target.value))} />
              </div>
            </div>

            <div className={styles.field}>
              <label>Cartão vermelho</label>
              <input type="number" min={0} max={1} value={redCards} onChange={e => setRedCards(Number(e.target.value))} style={{ maxWidth: 120 }} />
            </div>
          </>
        )}

        <div className={styles.field}>
          <label>Comentário (opcional)</label>
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações sobre a partida..." />
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.backBtn} onClick={() => navigate('/player/matches')}>
            Cancelar
          </button>
          <button type="submit" className={styles.saveBtn}>
            {isCompleted ? 'Salvar alterações' : 'Registrar partida'}
          </button>
        </div>
      </form>
    </div>
  );
}
