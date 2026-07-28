import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import {
  CATEGORIA_LABELS,
  RARIDADE_LABELS,
  type PulseHistoryEntry,
} from '../../pulse';
import styles from './PulseMatch.module.css';

export default function PulseMatch() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { state, getMatch, rollPulseForMatch } = useGame();
  const match = matchId ? getMatch(matchId) : undefined;
  const [phase, setPhase] = useState<'loading' | 'done'>('loading');
  const [entry, setEntry] = useState<PulseHistoryEntry | null>(null);

  useEffect(() => {
    if (!matchId || !match) return;

    const already = state.pulse.history.find(h => h.matchId === matchId);
    if (already || state.pulse.rolledMatchIds.includes(matchId)) {
      setEntry(already ?? state.pulse.history[0] ?? null);
      setPhase('done');
      return;
    }

    const delay = state.pulse.settings.showLoading ? 900 : 0;
    const timer = window.setTimeout(() => {
      rollPulseForMatch(matchId);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [matchId, match]);

  useEffect(() => {
    if (!matchId) return;
    if (!state.pulse.rolledMatchIds.includes(matchId)) return;
    const found = state.pulse.history.find(h => h.matchId === matchId) ?? null;
    setEntry(found);
    setPhase('done');
  }, [state.pulse.history, state.pulse.rolledMatchIds, matchId]);

  if (!match || !matchId) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>Partida não encontrada.</p>
        <button type="button" onClick={() => navigate('/matches')}>Voltar</button>
      </div>
    );
  }

  function goToLineup() {
    navigate(`/match/${matchId}/play`);
  }

  const isEvent = entry && entry.categoria !== 'nenhum' && entry.eventoId;

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <p className={styles.eyebrow}>Pré-partida</p>
        <h1 className={styles.brand}>Pulse</h1>
        <p className={styles.slogan}>O pulso do clube antes de cada partida</p>
        <p className={styles.matchLine}>
          {state.team?.name} × {match.opponent}
        </p>

        {phase === 'loading' && (
          <div className={styles.loading}>
            <div className={styles.pulseOrb} />
            <p>Consultando bastidores…</p>
          </div>
        )}

        {phase === 'done' && entry && (
          <article className={`${styles.card} ${isEvent ? styles.cardEvent : styles.cardNada}`}>
            <div className={styles.badges}>
              <span className={styles.cat}>
                {CATEGORIA_LABELS[entry.categoria] ?? entry.categoria}
              </span>
              {entry.raridade && (
                <span className={styles.rar}>
                  {RARIDADE_LABELS[entry.raridade] ?? entry.raridade}
                </span>
              )}
            </div>
            <h2 className={styles.eventTitle}>{entry.titulo}</h2>
            <p className={styles.desc}>{entry.descricao}</p>
            {entry.impactos.length > 0 && (
              <div className={styles.impacts}>
                <p className={styles.impactsLabel}>O que isso impacta</p>
                <ul>
                  {entry.impactos.map((imp, i) => (
                    <li key={i}>{imp}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        )}

        {phase === 'done' && (
          <button type="button" className={styles.cta} onClick={goToLineup}>
            Continuar para escalação →
          </button>
        )}
      </div>
    </div>
  );
}
