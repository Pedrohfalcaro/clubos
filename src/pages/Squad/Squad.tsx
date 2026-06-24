import { useState } from 'react';
import { useGame } from '../../context/GameContext';
import type { PlayerStatus } from '../../types/Player';
import styles from './Squad.module.css';

const POSITION_ORDER = ['GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'CF', 'ST'];
const POSITION_LABELS: Record<string, string> = {
  GK: 'Goleiros', CB: 'Zagueiros', RB: 'Laterais Direitos', LB: 'Laterais Esquerdos',
  CDM: 'Volantes', CM: 'Meio-campistas', CAM: 'Meias-atacantes',
  RW: 'Pontas Direitas', LW: 'Pontas Esquerdas', CF: 'Centroavantes', ST: 'Atacantes',
};

const STATUS_FILTERS: Array<PlayerStatus | 'Todos'> = ['Todos', 'Titular', 'Reserva', 'Promessa', 'Transferível'];
const STATUS_OPTIONS: PlayerStatus[] = ['Titular', 'Reserva', 'Promessa', 'Transferível'];

const STATUS_COLOR: Record<string, string> = {
  Titular: 'var(--success)',
  Reserva: 'var(--text)',
  Promessa: 'var(--accent)',
  Transferível: 'var(--danger)',
};

function overallColor(ovr: number): string {
  if (ovr >= 80) return 'var(--success)';
  if (ovr >= 70) return 'var(--warning)';
  return 'var(--text)';
}

export default function Squad() {
  const { state, updatePlayer } = useGame();
  const [filter, setFilter] = useState<PlayerStatus | 'Todos'>('Todos');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    number: '' as string | number,
    age: 0,
    overall: 0,
    status: 'Titular' as PlayerStatus,
  });

  const players = state.players.filter(p => {
    const matchStatus = filter === 'Todos' || p.status === filter;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

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
    });
  }

  function saveEdit() {
    if (!editingId) return;
    updatePlayer(editingId, {
      number: editForm.number === '' ? null : Number(editForm.number),
      age: editForm.age,
      overall: editForm.overall,
      status: editForm.status,
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
          <p className={styles.sub}>{state.players.length} jogadores · clique em Editar para alterar dados</p>
        </div>
      </header>

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
              <span className={styles.colStat}>J</span>
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
                    <span className={styles.colStat}>{p.stats.matches}</span>
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
                    <span className={styles.colStat}>{p.stats.matches}</span>
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
        </section>
      ))}

      {Object.keys(grouped).length === 0 && (
        <div className={styles.empty}>Nenhum jogador encontrado.</div>
      )}
    </div>
  );
}
