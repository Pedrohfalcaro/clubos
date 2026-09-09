import { useMemo, useState } from 'react';
import { useGame } from '../../../context/GameContext';
import type { SeasonCompetition } from '../../../types/Competition';
import styles from '../../Competitions/Competitions.module.css';
import extra from './PlayerCompetitions.module.css';

type CompType = 'national_cup' | 'continental_cup' | 'other' | null;

const COMP_TYPE_LABELS: Record<Exclude<CompType, null>, string> = {
  national_cup: 'Copa Nacional',
  continental_cup: 'Copa Continental',
  other: 'Outro',
};

interface CompetitionStats {
  matches: number;
  goals: number;
  assists: number;
  wins: number;
  draws: number;
  losses: number;
  ratings: number[];
}

export default function PlayerCompetitions() {
  const { state, addCompetition, updateCompetition, removeCompetition } = useGame();
  const player = state.careerPlayer;

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<CompType>(null);
  const [customName, setCustomName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const byCompetition = useMemo(() => {
    const map = new Map<string, CompetitionStats>();

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

  // Une as competições cadastradas (editáveis) com nomes que só existem em partidas já
  // registradas (ex.: competição removida depois de ter jogos) — sem isso o histórico some.
  const extraNames = useMemo(
    () => [...byCompetition.keys()].filter(
      name => !state.seasonCompetitions.some(c => c.name === name),
    ),
    [byCompetition, state.seasonCompetitions],
  );

  if (!player) return null;

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

  function startEdit(comp: SeasonCompetition) {
    setEditingId(comp.id);
    setEditName(comp.name);
  }

  function saveEdit(comp: SeasonCompetition) {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== comp.name) {
      updateCompetition(comp.id, { name: trimmed });
    }
    setEditingId(null);
  }

  function statsRow(data: CompetitionStats | undefined) {
    const avgRating = data && data.ratings.length > 0
      ? (data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(1)
      : '—';
    return (
      <div className={extra.statsRow}>
        <div className={extra.statCell}><span>{data?.matches ?? 0}</span><label>J</label></div>
        <div className={extra.statCell}><span>{data?.goals ?? 0}</span><label>G</label></div>
        <div className={extra.statCell}><span>{data?.assists ?? 0}</span><label>A</label></div>
        <div className={extra.statCell}><span>{data?.wins ?? 0}</span><label>V</label></div>
        <div className={extra.statCell}><span>{data?.draws ?? 0}</span><label>E</label></div>
        <div className={extra.statCell}><span>{data?.losses ?? 0}</span><label>D</label></div>
        <div className={extra.statCell}><span>{avgRating}</span><label>Nota</label></div>
      </div>
    );
  }

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
        {state.seasonCompetitions.length === 0 && extraNames.length === 0 ? (
          <div className={styles.empty}>Adicione sua competição principal ou clique em &quot;+ Adicionar competição&quot;.</div>
        ) : (
          <div className={extra.compList}>
            {state.seasonCompetitions.map(comp => {
              const data = byCompetition.get(comp.name);
              const isEditing = editingId === comp.id;
              return (
                <section
                  key={comp.id}
                  className={styles.compSection}
                  style={{ ['--comp-color' as string]: comp.color }}
                >
                  <div className={styles.compHeader}>
                    <div className={styles.compIdentity}>
                      <div className={styles.compStripe} />
                      <div className={styles.compTitles}>
                        {isEditing ? (
                          <input
                            className={styles.input}
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit(comp);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                        ) : (
                          <h2 className={styles.compName}>{comp.name}</h2>
                        )}
                        <div className={styles.compMeta}>
                          <span className={styles.badge}>{data?.matches ?? 0} jogos</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.compActions}>
                      {isEditing ? (
                        <>
                          <button type="button" className={styles.ghostBtn} onClick={() => setEditingId(null)}>
                            Cancelar
                          </button>
                          <button type="button" className={styles.ghostBtn} onClick={() => saveEdit(comp)}>
                            Salvar
                          </button>
                        </>
                      ) : (
                        <button type="button" className={styles.ghostBtn} onClick={() => startEdit(comp)}>
                          Editar
                        </button>
                      )}
                      {confirmRemoveId === comp.id ? (
                        <>
                          <button
                            type="button"
                            className={styles.ghostBtn}
                            onClick={() => setConfirmRemoveId(null)}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className={styles.dangerBtn}
                            onClick={() => {
                              removeCompetition(comp.id);
                              setConfirmRemoveId(null);
                            }}
                          >
                            Confirmar remoção
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={styles.dangerBtn}
                          onClick={() => setConfirmRemoveId(comp.id)}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                  {statsRow(data)}
                </section>
              );
            })}

            {extraNames.length > 0 && (
              <div className={extra.historicalBlock}>
                <p className={extra.historicalLabel}>Competições anteriores (removidas, com histórico de partidas)</p>
                {extraNames.map(name => (
                  <section key={name} className={`${styles.compSection} ${extra.historicalSection}`}>
                    <div className={styles.compHeader}>
                      <div className={styles.compIdentity}>
                        <div className={styles.compTitles}>
                          <h2 className={styles.compName}>{name}</h2>
                        </div>
                      </div>
                    </div>
                    {statsRow(byCompetition.get(name))}
                  </section>
                ))}
              </div>
            )}
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
