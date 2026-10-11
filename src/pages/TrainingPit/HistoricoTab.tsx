import { useState } from 'react';
import { formatGameDate } from '../../livelife';
import type { TrainingSession } from '../../types/Training';
import SummaryModal from './SummaryModal';
import type { TrainingScope } from './useTrainingScope';
import styles from './TrainingPit.module.css';

export default function HistoricoTab({ scope }: { scope: TrainingScope }) {
  const [viewing, setViewing] = useState<TrainingSession | null>(null);
  const sessions = [...scope.history].sort((a, b) => b.date.localeCompare(a.date));
  const names = new Map([...scope.players, ...scope.formerPlayers].map(p => [p.id, p.name]));
  const nameOf = (id: string) => names.get(id) ?? 'Jogador';

  if (sessions.length === 0) {
    return (
      <div className={styles.blocked}>
        <strong>Nenhum treino ainda</strong>
        <span>Os treinos realizados aparecem aqui, com placar e notas dos jogadores.</span>
      </div>
    );
  }

  return (
    <div className={styles.tabBody}>
      <ul className={styles.historyList}>
        {sessions.map(s => (
          <li key={s.id} className={styles.historyRow}>
            <span className={styles.historyDate}>{formatGameDate(s.date)}</span>
            <span className={styles.historyTeams}>
              {s.teams.a.name} <b>{s.placeholder ? '—' : s.score.a}</b> x{' '}
              <b>{s.placeholder ? '—' : s.score.b}</b> {s.teams.b.name}
            </span>
            <span className={styles.badge}>{s.open ? 'Aberto' : 'Fechado'}</span>
            {s.placeholder && <span className={styles.badge}>Sem jogo (protótipo)</span>}
            <button
              type="button"
              className={styles.ghostBtn}
              disabled={s.placeholder}
              title={s.placeholder ? 'Disponível quando o jogo 2D estiver pronto' : undefined}
              onClick={() => setViewing(s)}
            >
              Ver resumo
            </button>
          </li>
        ))}
      </ul>
      {viewing && <SummaryModal session={viewing} onClose={() => setViewing(null)} nameOf={nameOf} />}
    </div>
  );
}
