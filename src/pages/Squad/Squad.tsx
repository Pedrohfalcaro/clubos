import { useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import type { PlayerStatus } from '../../types/Player';
import { formatMoney } from '../../utils/finance';
import {
  scopeOptions,
  playerStatsForScope,
  type HistoryScope,
} from '../../utils/historyScope';
import styles from './Squad.module.css';

const POSITION_ORDER = ['GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'CF', 'ST'];
const POSITION_LABELS: Record<string, string> = {
  GK: 'Goleiros', CB: 'Zagueiros', RB: 'Laterais Direitos', LB: 'Laterais Esquerdos',
  CDM: 'Volantes', CM: 'Meio-campistas', CAM: 'Meias-atacantes',
  RW: 'Pontas Direitas', LW: 'Pontas Esquerdas', CF: 'Centroavantes', ST: 'Atacantes',
};

const STATUS_FILTERS: Array<PlayerStatus | 'Todos'> = ['Todos', 'Titular', 'Reserva', 'Promessa', 'Transferível', 'Emprestado'];
const STATUS_OPTIONS: PlayerStatus[] = ['Titular', 'Reserva', 'Promessa', 'Transferível', 'Emprestado'];

const STATUS_COLOR: Record<string, string> = {
  Titular: 'var(--success)',
  Reserva: 'var(--text)',
  Promessa: 'var(--accent)',
  Transferível: 'var(--danger)',
  Emprestado: '#f59e0b',
};

function overallColor(ovr: number): string {
  if (ovr >= 80) return 'var(--success)';
  if (ovr >= 70) return 'var(--warning)';
  return 'var(--text)';
}

export default function Squad() {
  const { state, updatePlayer } = useGame();
  const [view, setView] = useState<'roster' | 'history'>('roster');
  const [histScope, setHistScope] = useState<HistoryScope>('current');
  const [filter, setFilter] = useState<PlayerStatus | 'Todos'>('Todos');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    number: '' as string | number,
    age: 0,
    overall: 0,
    status: 'Titular' as PlayerStatus,
    salary: 0,
    marketValue: 0,
  });
  const currency = state.finance?.currency ?? 'BRL';
  const scopes = useMemo(
    () => scopeOptions(state.season, state.seasonHistory),
    [state.season, state.seasonHistory],
  );

  const players = state.players.filter(p => {
    const matchStatus = filter === 'Todos' || p.status === filter;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const historyRows = useMemo(() => {
    return [...state.players]
      .map(p => ({
        player: p,
        stats: playerStatsForScope(p, histScope, state.seasonHistory, state.season),
      }))
      .filter(row =>
        row.player.name.toLowerCase().includes(search.toLowerCase()) &&
        (histScope === 'current' || histScope === 'total' || row.stats.matches > 0 || row.stats.goals > 0 || row.stats.assists > 0),
      )
      .sort((a, b) => b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists || b.stats.matches - a.stats.matches);
  }, [state.players, histScope, state.seasonHistory, state.season, search]);

  const historyTotals = useMemo(() => {
    return historyRows.reduce(
      (acc, r) => ({
        matches: acc.matches + r.stats.matches,
        minutes: acc.minutes + r.stats.minutes,
        goals: acc.goals + r.stats.goals,
        assists: acc.assists + r.stats.assists,
        yellowCards: acc.yellowCards + r.stats.yellowCards,
        redCards: acc.redCards + r.stats.redCards,
      }),
      { matches: 0, minutes: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
    );
  }, [historyRows]);

  const grouped = POSITION_ORDER.reduce<Record<string, typeof players>>((acc, pos) => {
    const group = players.filter(p => p.position === pos);
    if (group.length > 0) acc[pos] = group;
    return acc;
  }, {});

  function startEdit(playerId: string) {
    const p = state.players.find(pl => pl.id === playerId);
    if (!p) return;
    setEditingId(playerId);
    setEditForm({
      number: p.number ?? '',
      age: p.age,
      overall: p.overall,
      status: p.status,
      salary: p.salary ?? 0,
      marketValue: p.marketValue ?? 0,
    });
  }

  function saveEdit() {
    if (!editingId) return;
    updatePlayer(editingId, {
      number: editForm.number === '' ? null : Number(editForm.number),
      age: editForm.age,
      overall: editForm.overall,
      status: editForm.status,
      salary: editForm.salary,
      marketValue: editForm.marketValue,
    });
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Elenco</h1>
          <p className={styles.sub}>
            {view === 'roster'
              ? `${state.players.length} jogadores · clique em Editar para alterar dados`
              : 'Estatísticas por temporada e totais da carreira'}
          </p>
        </div>
      </header>

      <div className={styles.viewTabs}>
        <button
          type="button"
          className={`${styles.viewTab} ${view === 'roster' ? styles.viewTabActive : ''}`}
          onClick={() => setView('roster')}
        >
          Elenco
        </button>
        <button
          type="button"
          className={`${styles.viewTab} ${view === 'history' ? styles.viewTabActive : ''}`}
          onClick={() => setView('history')}
        >
          Histórico
        </button>
      </div>

      {view === 'history' ? (
        <>
          <div className={styles.controls}>
            <div className={styles.filters}>
              {scopes.map(s => (
                <button
                  key={String(s.value)}
                  type="button"
                  className={`${styles.filterBtn} ${histScope === s.value ? styles.filterBtnActive : ''}`}
                  onClick={() => setHistScope(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <input
              className={styles.search}
              type="text"
              placeholder="Buscar jogador..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.histTotals}>
            <div><strong>{historyTotals.matches}</strong><span>Jogos</span></div>
            <div><strong>{historyTotals.minutes}'</strong><span>Minutos</span></div>
            <div><strong>{historyTotals.goals}</strong><span>Gols</span></div>
            <div><strong>{historyTotals.assists}</strong><span>Assist.</span></div>
            <div><strong>{historyTotals.yellowCards}</strong><span>CA</span></div>
            <div><strong>{historyTotals.redCards}</strong><span>CV</span></div>
          </div>

          {historyRows.length === 0 ? (
            <div className={styles.empty}>Nenhum dado neste período.</div>
          ) : (
            <div className={styles.histTable}>
              <div className={`${styles.histRow} ${styles.histHead}`}>
                <span>Jogador</span>
                <span>Pos</span>
                <span>J</span>
                <span>Min</span>
                <span>G</span>
                <span>A</span>
                <span>CA</span>
                <span>CV</span>
              </div>
              {historyRows.map(({ player: p, stats }) => (
                <div key={p.id} className={styles.histRow}>
                  <span className={styles.histName}>{p.name}</span>
                  <span>{p.position}</span>
                  <span>{stats.matches}</span>
                  <span>{stats.minutes}'</span>
                  <span>{stats.goals}</span>
                  <span>{stats.assists}</span>
                  <span>{stats.yellowCards}</span>
                  <span>{stats.redCards}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
      <div className={styles.controls}>
        <div className={styles.filters}>
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          className={styles.search}
          type="text"
          placeholder="Buscar jogador..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {Object.entries(grouped).map(([pos, group]) => (
        <section key={pos} className={styles.group}>
          <h2 className={styles.groupTitle}>{POSITION_LABELS[pos] ?? pos}</h2>

          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span className={styles.colNum}>#</span>
              <span className={styles.colName}>Nome</span>
              <span className={styles.colAge}>Idade</span>
              <span className={styles.colOvr}>OVR</span>
              <span className={styles.colMatches}>J</span>
              <span className={styles.colStat}>G</span>
              <span className={styles.colStat}>A</span>
              <span className={styles.colStatus}>Status</span>
              <span className={styles.colAction} />
            </div>
            {group.map(p => (
              <div key={p.id}>
                {editingId === p.id ? (
                  <div className={styles.editRow}>
                    <input
                      className={styles.editInputSm}
                      type="number"
                      min={1}
                      max={99}
                      placeholder="#"
                      value={editForm.number}
                      onChange={e => setEditForm(f => ({ ...f, number: e.target.value }))}
                    />
                    <span className={styles.colName}>{p.name}</span>
                    <input
                      className={styles.editInputSm}
                      type="number"
                      min={15}
                      max={45}
                      value={editForm.age}
                      onChange={e => setEditForm(f => ({ ...f, age: Number(e.target.value) }))}
                    />
                    <input
                      className={styles.editInputSm}
                      type="number"
                      min={40}
                      max={99}
                      value={editForm.overall}
                      onChange={e => setEditForm(f => ({ ...f, overall: Number(e.target.value) }))}
                    />
                    <span className={styles.colMatches}>
                      <span>{p.stats.matches}</span>
                      <span className={styles.minutes} title="Minutos jogados">
                        <span className={styles.minutesIcon} aria-hidden>⏱</span>
                        {p.stats.minutes ?? 0}'
                      </span>
                    </span>
                    <span className={styles.colStat}>{p.stats.goals}</span>
                    <span className={styles.colStat}>{p.stats.assists}</span>
                    <select
                      className={styles.editSelect}
                      value={editForm.status}
                      onChange={e => setEditForm(f => ({ ...f, status: e.target.value as PlayerStatus }))}
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <div className={styles.editActions}>
                      <button type="button" className={styles.saveBtn} onClick={saveEdit}>Salvar</button>
                      <button type="button" className={styles.cancelBtn} onClick={cancelEdit}>×</button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.tableRow}>
                    <span className={styles.colNum}>{p.number ?? '—'}</span>
                    <span className={styles.colName}>{p.name}</span>
                    <span className={styles.colAge}>{p.age}</span>
                    <span className={styles.colOvr} style={{ color: overallColor(p.overall) }}>
                      {p.overall}
                    </span>
                    <span className={styles.colMatches}>
                      <span>{p.stats.matches}</span>
                      <span className={styles.minutes} title="Minutos jogados">
                        <span className={styles.minutesIcon} aria-hidden>⏱</span>
                        {p.stats.minutes ?? 0}'
                      </span>
                    </span>
                    <span className={styles.colStat}>{p.stats.goals}</span>
                    <span className={styles.colStat}>{p.stats.assists}</span>
                    <span className={styles.colStatus} style={{ color: STATUS_COLOR[p.status] }}>
                      {p.status}
                    </span>
                    <button type="button" className={styles.editBtn} onClick={() => startEdit(p.id)}>
                      Editar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className={styles.mobileList}>
            {group.map(p => (
              <div key={`m-${p.id}`} className={styles.mobileCard}>
                {editingId === p.id ? (
                  <div className={styles.mobileEdit}>
                    <p className={styles.mobileName}>{p.name}</p>
                    <div className={styles.mobileEditGrid}>
                      <label>
                        <span>#</span>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={editForm.number}
                          onChange={e => setEditForm(f => ({ ...f, number: e.target.value }))}
                        />
                      </label>
                      <label>
                        <span>Idade</span>
                        <input
                          type="number"
                          min={15}
                          max={45}
                          value={editForm.age}
                          onChange={e => setEditForm(f => ({ ...f, age: Number(e.target.value) }))}
                        />
                      </label>
                      <label>
                        <span>OVR</span>
                        <input
                          type="number"
                          min={40}
                          max={99}
                          value={editForm.overall}
                          onChange={e => setEditForm(f => ({ ...f, overall: Number(e.target.value) }))}
                        />
                      </label>
                      <label>
                        <span>Status</span>
                        <select
                          value={editForm.status}
                          onChange={e => setEditForm(f => ({ ...f, status: e.target.value as PlayerStatus }))}
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Salário</span>
                        <input
                          type="number"
                          min={0}
                          value={editForm.salary}
                          onChange={e => setEditForm(f => ({ ...f, salary: Number(e.target.value) }))}
                        />
                      </label>
                      <label>
                        <span>Valor mercado</span>
                        <input
                          type="number"
                          min={0}
                          value={editForm.marketValue}
                          onChange={e => setEditForm(f => ({ ...f, marketValue: Number(e.target.value) }))}
                        />
                      </label>
                    </div>
                    <div className={styles.mobileEditActions}>
                      <button type="button" className={styles.saveBtn} onClick={saveEdit}>Salvar</button>
                      <button type="button" className={styles.cancelBtn} onClick={cancelEdit}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.mobileCardTop}>
                      <span className={styles.mobileNum}>{p.number ?? '—'}</span>
                      <span className={styles.mobileName}>{p.name}</span>
                      <span className={styles.mobileOvr} style={{ color: overallColor(p.overall) }}>
                        {p.overall}
                      </span>
                    </div>
                    <div className={styles.mobileCardMeta}>
                      <span>{p.age} anos</span>
                      <span>J {p.stats.matches}</span>
                      <span className={styles.minutes} title="Minutos jogados">
                        <span className={styles.minutesIcon} aria-hidden>⏱</span>
                        {p.stats.minutes ?? 0}'
                      </span>
                      <span>G {p.stats.goals}</span>
                      <span>A {p.stats.assists}</span>
                      <span style={{ color: STATUS_COLOR[p.status] }}>{p.status}</span>
                    </div>
                    {(p.salary > 0 || p.marketValue > 0) && (
                      <div className={styles.mobileCardMeta} style={{ marginTop: 2, fontSize: 11 }}>
                        {p.salary > 0 && <span title="Salário">💰 {formatMoney(p.salary, currency)}/mês</span>}
                        {p.marketValue > 0 && <span title="Valor de mercado">🏷 {formatMoney(p.marketValue, currency)}</span>}
                      </div>
                    )}
                    <button type="button" className={styles.mobileEditBtn} onClick={() => startEdit(p.id)}>
                      Editar
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {Object.keys(grouped).length === 0 && (
        <div className={styles.empty}>Nenhum jogador encontrado.</div>
      )}
        </>
      )}
    </div>
  );
}
