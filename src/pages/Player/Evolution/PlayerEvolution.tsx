import { useMemo, useState } from 'react';
import { useGame } from '../../../context/GameContext';
import { isInjuryActive, daysUntil } from '../../../utils/playerClock';
import styles from '../../Dashboard/Dashboard.module.css';
import extra from './PlayerEvolution.module.css';

export default function PlayerEvolution() {
  const { state, addInjury, removeInjury, advanceSeason } = useGame();
  const player = state.careerPlayer;

  const [activeInjuries, pastInjuries] = useMemo(() => {
    const injuries = player?.injuries ?? [];
    if (!state.currentDate) return [injuries, []];
    const active = injuries.filter(i => isInjuryActive(i, state.currentDate!));
    const past = injuries.filter(i => !isInjuryActive(i, state.currentDate!));
    return [active, past];
  }, [player?.injuries, state.currentDate]);

  const [injuryType, setInjuryType] = useState('');
  const [injuryStart, setInjuryStart] = useState('');
  const [injuryReturn, setInjuryReturn] = useState('');

  if (!player) return null;

  const maxOvr = Math.max(...player.overallHistory.map(h => h.overall), player.overall);

  function handleAddInjury(e: React.FormEvent) {
    e.preventDefault();
    if (!injuryType.trim()) return;
    addInjury({
      type: injuryType.trim(),
      startDate: injuryStart || state.currentDate || new Date().toISOString().slice(0, 10),
      returnDate: injuryReturn || undefined,
    });
    setInjuryType('');
    setInjuryStart('');
    setInjuryReturn('');
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Evolução</h1>
          <p className={styles.sub}>Overall ao longo das temporadas</p>
        </div>
        <button type="button" className={extra.seasonBtn} onClick={() => {
          if (confirm(`Avançar para temporada ${state.season + 1}? Stats da temporada serão zeradas.`)) {
            advanceSeason();
          }
        }}>
          Nova temporada
        </button>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Histórico de overall</h2>
        {player.overallHistory.length === 0 ? (
          <div className={styles.empty}>Nenhum registro ainda.</div>
        ) : (
          <div className={extra.chart}>
            {player.overallHistory.map(entry => (
              <div key={entry.season} className={extra.barCol}>
                <div className={extra.barWrap}>
                  <div
                    className={extra.bar}
                    style={{ height: `${(entry.overall / maxOvr) * 100}%` }}
                    title={`OVR ${entry.overall}`}
                  />
                </div>
                <span className={extra.barValue}>{entry.overall}</span>
                <span className={extra.barSeason}>{entry.season}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Lesão atual</h2>
        {activeInjuries.length === 0 ? (
          <div className={styles.empty}>Nenhuma lesão ativa.</div>
        ) : (
          <div className={extra.injuryList}>
            {activeInjuries.map(inj => {
              const remaining = state.currentDate && inj.returnDate
                ? daysUntil(state.currentDate, inj.returnDate)
                : null;
              return (
                <div key={inj.id} className={extra.injuryItem}>
                  <div>
                    <strong>{inj.type}</strong>
                    <span className={extra.injuryDates}>
                      {new Date(inj.startDate).toLocaleDateString('pt-BR')}
                      {inj.returnDate && ` → ${new Date(inj.returnDate).toLocaleDateString('pt-BR')}`}
                      {remaining != null && remaining > 0 && ` · ${remaining} ${remaining === 1 ? 'dia' : 'dias'} restante${remaining === 1 ? '' : 's'}`}
                    </span>
                  </div>
                  <button type="button" className={extra.removeBtn} onClick={() => removeInjury(inj.id)}>×</button>
                </div>
              );
            })}
          </div>
        )}
        <form onSubmit={handleAddInjury} className={extra.injuryForm}>
          <div className={extra.field}>
            <label>Tipo de lesão</label>
            <input value={injuryType} onChange={e => setInjuryType(e.target.value)} placeholder="Ex: Entorse no tornozelo" required />
          </div>
          <div className={extra.fieldRow}>
            <div className={extra.field}>
              <label>Data início</label>
              <input type="date" value={injuryStart} onChange={e => setInjuryStart(e.target.value)} />
            </div>
            <div className={extra.field}>
              <label>Previsão de retorno</label>
              <input type="date" value={injuryReturn} onChange={e => setInjuryReturn(e.target.value)} />
            </div>
          </div>
          <button type="submit" className={extra.addBtn}>Registrar lesão</button>
        </form>
      </section>

      {pastInjuries.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Histórico de lesões</h2>
          <div className={extra.injuryList}>
            {pastInjuries.map(inj => (
              <div key={inj.id} className={extra.injuryItem}>
                <div>
                  <strong>{inj.type}</strong>
                  <span className={extra.injuryDates}>
                    {new Date(inj.startDate).toLocaleDateString('pt-BR')}
                    {inj.returnDate && ` → ${new Date(inj.returnDate).toLocaleDateString('pt-BR')}`}
                  </span>
                </div>
                <button type="button" className={extra.removeBtn} onClick={() => removeInjury(inj.id)}>×</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
