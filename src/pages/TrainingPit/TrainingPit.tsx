import { useState } from 'react';
import PartidaTab from './PartidaTab';
import HistoricoTab from './HistoricoTab';
import ElencoTab from './ElencoTab';
import { useTrainingScope, type TrainingScopeKind } from './useTrainingScope';
import styles from './TrainingPit.module.css';

type TabId = 'partida' | 'historico' | 'elenco';

const TABS: { id: TabId; label: string }[] = [
  { id: 'partida', label: 'Partida' },
  { id: 'historico', label: 'Histórico' },
  { id: 'elenco', label: 'Elenco' },
];

/**
 * Aba de Treinamento (Training Pit). `kind="club"` é a aba do clube (1 treino por semana);
 * `kind="national"` é a da Seleção na Data FIFA (treino livre e ilimitado).
 */
export default function TrainingPit({ kind }: { kind: TrainingScopeKind }) {
  const scope = useTrainingScope(kind);
  const { availability } = scope;
  const [tab, setTab] = useState<TabId>(availability.available ? 'partida' : 'historico');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.brand}>Training Pit</h1>
        <p className={styles.slogan}>Monte os times e coloque o elenco para suar</p>
        <span
          className={`${styles.statusPill} ${availability.available ? styles.statusOk : styles.statusOff}`}
          title={availability.message}
        >
          {scope.unlimited ? 'Data FIFA · treino livre' : availability.available ? 'Treino disponível' : 'Treino indisponível'}
        </span>
      </header>

      <nav className={styles.tabs} role="tablist" aria-label="Seções do treinamento">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'partida' &&
        (availability.available ? (
          <PartidaTab scope={scope} onSessionCreated={() => setTab('historico')} />
        ) : (
          <div className={styles.blocked}>
            <strong>Treino indisponível</strong>
            <span>{availability.message}</span>
          </div>
        ))}
      {tab === 'historico' && <HistoricoTab scope={scope} />}
      {tab === 'elenco' && <ElencoTab scope={scope} />}
    </div>
  );
}
