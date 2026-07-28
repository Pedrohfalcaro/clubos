import { useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import {
  CATEGORIA_LABELS,
  RARIDADE_LABELS,
  formatPulseDate,
} from '../../pulse';
import styles from './Pulse.module.css';

export default function PulsePage() {
  const { state, updatePulseSettings } = useGame();
  const { pulse } = state;
  const [catFilter, setCatFilter] = useState('todas');
  const [detailId, setDetailId] = useState<string | null>(null);

  const history = useMemo(() => {
    return pulse.history.filter(h => {
      if (catFilter === 'todas') return true;
      return h.categoria === catFilter;
    });
  }, [pulse.history, catFilter]);

  const detail = history.find(h => h.id === detailId) ?? pulse.history.find(h => h.id === detailId);

  const categories = useMemo(() => {
    const set = new Set(pulse.history.map(h => h.categoria));
    return ['todas', ...Array.from(set)];
  }, [pulse.history]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>ClubOS</p>
          <h1 className={styles.brand}>Pulse</h1>
          <p className={styles.slogan}>O pulso do clube antes de cada partida</p>
        </div>
        <div className={styles.stats}>
          <div>
            <span className={styles.statVal}>{pulse.history.filter(h => h.eventoId).length}</span>
            <span className={styles.statLbl}>eventos</span>
          </div>
          <div>
            <span className={styles.statVal}>{pulse.history.length}</span>
            <span className={styles.statLbl}>consultas</span>
          </div>
        </div>
      </header>

      <section className={styles.settings}>
        <h2 className={styles.sectionTitle}>Configurações</h2>
        <label className={styles.settingRow}>
          <span>Chance de evento ({Math.round(pulse.settings.chanceEvento * 100)}%)</span>
          <input
            type="range"
            min={10}
            max={60}
            value={Math.round(pulse.settings.chanceEvento * 100)}
            onChange={e =>
              updatePulseSettings({ chanceEvento: Number(e.target.value) / 100 })
            }
          />
        </label>
        <label className={styles.settingRow}>
          <span>Animação de loading</span>
          <input
            type="checkbox"
            checked={pulse.settings.showLoading}
            onChange={e => updatePulseSettings({ showLoading: e.target.checked })}
          />
        </label>
      </section>

      <section className={styles.feed}>
        <div className={styles.feedHead}>
          <h2 className={styles.sectionTitle}>Histórico da temporada</h2>
          <select
            className={styles.filter}
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
          >
            {categories.map(c => (
              <option key={c} value={c}>
                {c === 'todas' ? 'Todas' : CATEGORIA_LABELS[c] ?? c}
              </option>
            ))}
          </select>
        </div>

        {history.length === 0 ? (
          <p className={styles.empty}>Nenhum Pulse ainda nesta temporada.</p>
        ) : (
          <ul className={styles.list}>
            {history.map(h => (
              <li key={h.id}>
                <button
                  type="button"
                  className={styles.item}
                  onClick={() => setDetailId(h.id)}
                >
                  <div className={styles.itemTop}>
                    <span className={styles.cat}>
                      {CATEGORIA_LABELS[h.categoria] ?? h.categoria}
                    </span>
                    <span className={styles.date}>{formatPulseDate(h.data)}</span>
                  </div>
                  <p className={styles.itemTitle}>{h.titulo}</p>
                  {h.atletaNome && (
                    <p className={styles.itemAthlete}>{h.atletaNome}</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detail && (
        <div className={styles.modalOverlay} onClick={() => setDetailId(null)}>
          <article
            className={styles.modal}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setDetailId(null)}
            >
              ×
            </button>
            <div className={styles.badges}>
              <span>{CATEGORIA_LABELS[detail.categoria] ?? detail.categoria}</span>
              {detail.raridade && (
                <span>{RARIDADE_LABELS[detail.raridade] ?? detail.raridade}</span>
              )}
            </div>
            <h3 className={styles.modalTitle}>{detail.titulo}</h3>
            <p className={styles.modalDesc}>{detail.descricao}</p>
            {detail.impactos.length > 0 && (
              <div className={styles.impacts}>
                <p className={styles.impactsLabel}>O que isso impacta</p>
                <ul>
                  {detail.impactos.map((imp, i) => (
                    <li key={i}>{imp}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className={styles.modalMeta}>{formatPulseDate(detail.data)}</p>
          </article>
        </div>
      )}
    </div>
  );
}
