import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import type { TeamAchievement } from '../../types/Achievement';
import type { Player } from '../../types/Player';
import type { Match } from '../../types/Match';
import type { RecordMetric, RecordScope, RecordTable } from '../../types/Records';
import { RECORD_METRIC_LABELS } from '../../types/Records';
import { isForeignPlayer, playerCumulativeValue } from '../../utils/records';
import styles from './Trophies.module.css';

function positionLabel(a: TeamAchievement): string {
  if (a.isTitle) return 'Campeão';
  if (a.position === 2) return 'Vice';
  if (a.position === 3) return '3º lugar';
  return `${a.position}º lugar`;
}

const RECORD_METRICS: RecordMetric[] = [
  'goals',
  'assists',
  'goalContributions',
  'appearances',
  'starts',
  'homeGoals',
];

interface RecordCardProps {
  table: RecordTable;
  players: Player[];
  matches: Match[];
  homeNationality?: string;
  onAddEntry: (
    tableId: string,
    entry: { label: string; playerId?: string; value: number },
  ) => void;
  onRemoveEntry: (tableId: string, entryId: string) => void;
  onRemoveTable: (tableId: string) => void;
}

function RecordCard({
  table,
  players,
  matches,
  homeNationality,
  onAddEntry,
  onRemoveEntry,
  onRemoveTable,
}: RecordCardProps) {
  const [mode, setMode] = useState<'text' | 'player'>('player');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('0');
  const [playerId, setPlayerId] = useState('');

  const eligiblePlayers =
    table.scope === 'foreign' ? players.filter(p => isForeignPlayer(p, homeNationality)) : players;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'player') {
      const player = eligiblePlayers.find(p => p.id === playerId);
      if (!player) return;
      onAddEntry(table.id, {
        label: player.name,
        playerId: player.id,
        value: playerCumulativeValue(player, table.metric, matches),
      });
      setPlayerId('');
    } else {
      const name = label.trim();
      if (!name) return;
      onAddEntry(table.id, { label: name, value: Math.max(0, Math.round(Number(value) || 0)) });
      setLabel('');
      setValue('0');
    }
  }

  return (
    <article className={styles.recordCard}>
      <div className={styles.recordCardHead}>
        <div>
          <h3 className={styles.recordCardTitle}>{table.name}</h3>
          <p className={styles.recordCardMetric}>
            {RECORD_METRIC_LABELS[table.metric]}
            {table.scope === 'foreign' ? ' · Estrangeiros' : ''}
          </p>
        </div>
        <button type="button" className={styles.removeBtn} onClick={() => onRemoveTable(table.id)}>
          Excluir tabela
        </button>
      </div>

      {table.entries.length === 0 ? (
        <p className={styles.emptyInline}>Nenhum registro ainda.</p>
      ) : (
        table.entries.map((entry, i) => (
          <div key={entry.id} className={styles.recordRow}>
            <span className={styles.recordPos}>{i + 1}º</span>
            <span className={styles.recordName}>{entry.label}</span>
            <span className={styles.recordValue}>{entry.value}</span>
            <button type="button" className={styles.removeBtn} onClick={() => onRemoveEntry(table.id, entry.id)}>
              Remover
            </button>
          </div>
        ))
      )}

      <form className={styles.addEntryForm} onSubmit={submit}>
        <select value={mode} onChange={e => setMode(e.target.value as 'text' | 'player')}>
          <option value="player">Jogador do elenco</option>
          <option value="text">Nome livre</option>
        </select>
        {mode === 'player' ? (
          <select value={playerId} onChange={e => setPlayerId(e.target.value)} required>
            <option value="">
              {eligiblePlayers.length === 0 ? 'Nenhum estrangeiro no elenco' : 'Selecione…'}
            </option>
            {eligiblePlayers.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} · {playerCumulativeValue(p, table.metric, matches)}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Nome"
              required
            />
            <input
              type="number"
              min={0}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="Valor"
              style={{ width: 70 }}
            />
          </>
        )}
        <button type="submit" className={styles.smallBtn}>
          Adicionar
        </button>
      </form>
    </article>
  );
}

export default function Trophies() {
  const {
    state,
    addAchievement,
    removeAchievement,
    setTrophyCount,
    createRecordTable,
    addRecordEntry,
    removeRecordEntry,
    removeRecordTable,
    setHomeNationality,
  } = useGame();
  const navigate = useNavigate();
  const team = state.team;

  const [tab, setTab] = useState<'trophies' | 'records'>('trophies');
  const [showForm, setShowForm] = useState(false);
  const [competition, setCompetition] = useState('');
  const [season, setSeason] = useState(String(state.season));
  const [position, setPosition] = useState('1');
  const [note, setNote] = useState('');
  const [showNewTable, setShowNewTable] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableMetric, setNewTableMetric] = useState<RecordMetric>('goals');
  const [newTableScope, setNewTableScope] = useState<RecordScope>('all');
  const [homeNatInput, setHomeNatInput] = useState('');

  const list = useMemo(() => {
    const raw = [...(team?.achievements ?? [])];
    return raw.sort((a, b) => b.season - a.season || a.position - b.position);
  }, [team?.achievements]);

  const titles = list.filter(a => a.isTitle);
  const others = list.filter(a => !a.isTitle);

  const compOptions = state.seasonCompetitions.map(c => c.name);
  const totalTrophies = (team?.trophyCabinet ?? []).reduce((s, e) => s + e.titles, 0);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const pos = Math.max(1, Math.round(Number(position) || 1));
    const seasonN = Math.max(1, Math.round(Number(season) || state.season));
    const name = competition.trim();
    if (!name) return;
    addAchievement({
      competition: name,
      season: seasonN,
      position: pos,
      isTitle: pos === 1,
      note: note.trim() || undefined,
    });
    setCompetition('');
    setNote('');
    setPosition('1');
    setShowForm(false);
  }

  const needsHomeNationalityPrompt = newTableScope === 'foreign' && !team?.homeNationality;

  function submitNewTable(e: React.FormEvent) {
    e.preventDefault();
    const name = newTableName.trim();
    if (!name) return;
    if (needsHomeNationalityPrompt) {
      const nat = homeNatInput.trim();
      if (!nat) return;
      setHomeNationality(nat);
    }
    createRecordTable(name, newTableMetric, newTableScope);
    setNewTableName('');
    setNewTableScope('all');
    setHomeNatInput('');
    setShowNewTable(false);
  }

  if (!team) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>Sala de Troféus disponível no modo técnico.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>LiveLife · Clube</p>
          <h1 className={styles.brand}>Sala de Troféus</h1>
          <p className={styles.meta}>
            {team.name} · {totalTrophies} troféu{totalTrophies === 1 ? '' : 's'} · {state.records.length}{' '}
            tabela{state.records.length === 1 ? '' : 's'} de recorde
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnGhost} onClick={() => navigate('/manager')}>
            Perfil do técnico
          </button>
        </div>
      </header>

      <nav className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'trophies' ? styles.tabActive : ''}`}
          onClick={() => setTab('trophies')}
        >
          Troféus
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'records' ? styles.tabActive : ''}`}
          onClick={() => setTab('records')}
        >
          Recordes
        </button>
      </nav>

      {tab === 'trophies' ? (
        <>
          <section>
            <h2 className={styles.sectionTitle}>Troféus por competição</h2>
            {state.seasonCompetitions.length === 0 ? (
              <p className={styles.emptyInline}>Nenhuma competição cadastrada ainda.</p>
            ) : (
              <div>
                {state.seasonCompetitions.map(comp => {
                  const count = team.trophyCabinet?.find(e => e.competitionName === comp.name)?.titles ?? 0;
                  return (
                    <div key={comp.id} className={styles.compRow}>
                      <span className={styles.compDot} style={{ background: comp.color }} />
                      <span className={styles.compName}>{comp.name}</span>
                      <input
                        type="number"
                        min={0}
                        className={styles.countInput}
                        value={count}
                        onChange={e => setTrophyCount(comp.name, Number(e.target.value) || 0)}
                      />
                      <span className={styles.miniCupRow}>
                        {Array.from({ length: Math.min(count, 50) }).map((_, i) => (
                          <span key={i} className={styles.miniCup} />
                        ))}
                        {count > 50 && <span className={styles.compName}>+{count - 50}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <div className={styles.recordsHeader}>
              <h2 className={styles.subheading}>Histórico de temporadas</h2>
              <button type="button" className={styles.btnPrimary} onClick={() => setShowForm(v => !v)}>
                {showForm ? 'Cancelar' : 'Registrar'}
              </button>
            </div>

            {showForm && (
              <form className={styles.form} onSubmit={submitManual}>
                <h2 className={styles.formTitle}>Registrar conquista</h2>
                <label className={styles.label}>
                  Competição
                  <input
                    className={styles.input}
                    list="comp-list"
                    value={competition}
                    onChange={e => setCompetition(e.target.value)}
                    placeholder="Nome da competição"
                    required
                  />
                  <datalist id="comp-list">
                    {compOptions.map(n => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </label>
                <div className={styles.row}>
                  <label className={styles.label}>
                    Temporada
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      value={season}
                      onChange={e => setSeason(e.target.value)}
                    />
                  </label>
                  <label className={styles.label}>
                    Posição
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      value={position}
                      onChange={e => setPosition(e.target.value)}
                    />
                  </label>
                </div>
                <label className={styles.label}>
                  Nota (opcional)
                  <input
                    className={styles.input}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Ex.: final nos pênaltis"
                  />
                </label>
                <button type="submit" className={styles.btnPrimary}>
                  Adicionar ao histórico
                </button>
              </form>
            )}

            {titles.length === 0 && others.length === 0 ? (
              <p className={styles.emptyInline}>Nenhum registro de temporada ainda.</p>
            ) : (
              <ul className={styles.list}>
                {[...titles, ...others].map(a => (
                  <li key={a.id} className={styles.listItem}>
                    <div>
                      <strong>{a.competition}</strong>
                      <p>
                        Temporada {a.season} · {positionLabel(a)}
                        {a.note ? ` · ${a.note}` : ''}
                      </p>
                    </div>
                    <button type="button" className={styles.removeBtn} onClick={() => removeAchievement(a.id)}>
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <section>
          <div className={styles.recordsHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Recordes do clube</h2>
              {team.homeNationality && (
                <p className={styles.formHint}>
                  Nacionalidade oficial do clube: {team.homeNationality}
                </p>
              )}
            </div>
            <button type="button" className={styles.btnPrimary} onClick={() => setShowNewTable(v => !v)}>
              {showNewTable ? 'Cancelar' : 'Criar recorde'}
            </button>
          </div>

          {showNewTable && (
            <form className={styles.form} onSubmit={submitNewTable}>
              <h2 className={styles.formTitle}>Nova tabela de recordes</h2>
              <label className={styles.label}>
                Nome
                <input
                  className={styles.input}
                  value={newTableName}
                  onChange={e => setNewTableName(e.target.value)}
                  placeholder="Ex.: Artilheiros"
                  required
                />
              </label>
              <label className={styles.label}>
                Categoria
                <select
                  className={styles.input}
                  value={newTableMetric}
                  onChange={e => setNewTableMetric(e.target.value as RecordMetric)}
                >
                  {RECORD_METRICS.map(m => (
                    <option key={m} value={m}>
                      {RECORD_METRIC_LABELS[m]}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.label}>
                Elegibilidade
                <select
                  className={styles.input}
                  value={newTableScope}
                  onChange={e => {
                    const scope = e.target.value as RecordScope;
                    setNewTableScope(scope);
                    if (scope === 'foreign' && !team.homeNationality && !homeNatInput) {
                      setHomeNatInput(team.country);
                    }
                  }}
                >
                  <option value="all">Geral</option>
                  <option value="foreign">Somente estrangeiros</option>
                </select>
              </label>
              {needsHomeNationalityPrompt && (
                <label className={styles.label}>
                  Nacionalidade oficial do clube
                  <input
                    className={styles.input}
                    value={homeNatInput}
                    onChange={e => setHomeNatInput(e.target.value)}
                    placeholder="Ex.: Brasil"
                    required
                  />
                  <span className={styles.formHint}>
                    Perguntado só desta vez — define quem entra como "estrangeiro" em toda
                    tabela desse tipo daqui pra frente.
                  </span>
                </label>
              )}
              <button type="submit" className={styles.btnPrimary}>
                Criar
              </button>
            </form>
          )}

          {state.records.length === 0 ? (
            <p className={styles.emptyInline}>Nenhuma tabela de recordes criada ainda.</p>
          ) : (
            <div className={styles.recordsGrid}>
              {state.records.map(table => (
                <RecordCard
                  key={table.id}
                  table={table}
                  players={state.players}
                  matches={state.matches}
                  homeNationality={team.homeNationality}
                  onAddEntry={addRecordEntry}
                  onRemoveEntry={removeRecordEntry}
                  onRemoveTable={removeRecordTable}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
