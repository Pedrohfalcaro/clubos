import { useMemo, useState } from 'react';
import { useGame } from '../../../context/GameContext';
import styles from '../../Competitions/Competitions.module.css';
import extra from './PlayerCompetitions.module.css';

type CompType = 'national_cup' | 'continental_cup' | 'other' | null;

const COMP_TYPE_LABELS: Record<Exclude<CompType, null>, string> = {
  national_cup: 'Copa Nacional',
  continental_cup: 'Copa Continental',
  other: 'Outro',
};

export default function PlayerCompetitions() {
  const { state, addCompetition } = useGame();
  const player = state.careerPlayer;

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<CompType>(null);
  const [customName, setCustomName] = useState('');

  const byCompetition = useMemo(() => {
    const map = new Map<string, {
      matches: number;
      goals: number;
      assists: number;
      wins: number;
      draws: number;
      losses: number;
      ratings: number[];
    }>();

    for (const m of state.matches.filter(m => m.status === 'completed')) {
      const entry = map.get(m.competition) ?? {
        matches: 0, goals: 0, assists: 0, wins: 0, draws: 0, losses: 0, ratings: [],
      };
      const perf = m.playerPerformance;
      if (perf && perf.role !== 'notCalled') {
        entry.matches += 1;
        entry.goals += perf.goals;
        entry.assists += perf.assists;
        if (perf.rating != null) entry.ratings.push(perf.rating);
      }
      if (m.result === 'win') entry.wins += 1;
      else if (m.result === 'draw') entry.draws += 1;
      else if (m.result === 'loss') entry.losses += 1;
      map.set(m.competition, entry);
    }
    return map;
  }, [state.matches]);

  if (!player) return null;

  const competitions = state.seasonCompetitions.length > 0
    ? state.seasonCompetitions
    : [...byCompetition.keys()];

  function openModal() {
    setSelectedType(null);
    setCustomName('');
    setModalOpen(true);
  }

  function handleAdd() {
    let name = '';
    if (selectedType === 'other') {
      name = customName.trim();
    } else if (selectedType) {
      name = COMP_TYPE_LABELS[selectedType];
    }
    if (!name) return;
    addCompetition(name);
    setModalOpen(false);
  }

  const canConfirm = selectedType === 'other'
    ? customName.trim().length > 0
    : selectedType !== null;

  return (
    <div className={styles.page}>
      <header className={extra.pageHeader}>
        <div>
          <h1 className={styles.title}>Competições</h1>
          <p className={styles.sub}>Sua contribuição por competição — Temporada {state.season}</p>
        </div>
        <button type="button" className={extra.addBtn} onClick={openModal}>
          + Adicionar competição
        </button>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Por competição</h2>
        {competitions.length === 0 ? (
          <div className={styles.empty}>Adicione sua competição principal no setup ou clique em &quot;+ Adicionar competição&quot;.</div>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span className={styles.colTeam}>Competição</span>
              <span className={styles.colNum}>J</span>
              <span className={styles.colNum}>G</span>
              <span className={styles.colNum}>A</span>
              <span className={styles.colNum}>V</span>
              <span className={styles.colNum}>E</span>
              <span className={styles.colNum}>D</span>
              <span className={styles.colPts}>Nota</span>
            </div>
            {competitions.map(comp => {
              const data = byCompetition.get(comp);
              const avgRating = data && data.ratings.length > 0
                ? (data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(1)
                : '—';
              return (
                <div key={comp} className={styles.tableRow}>
                  <span className={styles.colTeam}>{comp}</span>
                  <span className={styles.colNum}>{data?.matches ?? 0}</span>
                  <span className={styles.colNum}>{data?.goals ?? 0}</span>
                  <span className={styles.colNum}>{data?.assists ?? 0}</span>
                  <span className={styles.colNum}>{data?.wins ?? 0}</span>
                  <span className={styles.colNum}>{data?.draws ?? 0}</span>
                  <span className={styles.colNum}>{data?.losses ?? 0}</span>
                  <span className={styles.colPts}>{avgRating}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Totais da temporada</h2>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span className={styles.colTeam}>Jogador</span>
            <span className={styles.colNum}>J</span>
            <span className={styles.colPts}>G</span>
            <span className={styles.colPts}>A</span>
          </div>
          <div className={`${styles.tableRow} ${styles.myRow}`}>
            <span className={styles.colTeam}>{player.name}</span>
            <span className={styles.colNum}>{player.seasonStats.matches}</span>
            <span className={styles.colPts}>{player.seasonStats.goals}</span>
            <span className={styles.colPts}>{player.seasonStats.assists}</span>
          </div>
        </div>
      </section>

      {modalOpen && (
        <div className={extra.overlay} onClick={() => setModalOpen(false)}>
          <div className={extra.modal} onClick={e => e.stopPropagation()}>
            <h2 className={extra.modalTitle}>Adicionar competição</h2>
            <div className={extra.typeBtns}>
              {(Object.keys(COMP_TYPE_LABELS) as Array<Exclude<CompType, null>>).map(type => (
                <button
                  key={type}
                  type="button"
                  className={`${extra.typeBtn} ${selectedType === type ? extra.typeBtnActive : ''}`}
                  onClick={() => setSelectedType(type)}
                >
                  {COMP_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
            {selectedType === 'other' && (
              <div className={extra.customField}>
                <label>Nome da competição</label>
                <input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="Ex: Supercopa do Brasil"
                  autoFocus
                />
              </div>
            )}
            <div className={extra.modalActions}>
              <button type="button" className={extra.cancelBtn} onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" className={extra.confirmBtn} disabled={!canConfirm} onClick={handleAdd}>
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
