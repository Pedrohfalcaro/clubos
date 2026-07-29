import { useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import type { PlayerStatus } from '../../types/Player';
import {
  scopeOptions,
  playerStatsForScope,
  teamStatsForScope,
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

type CompFilter = 'all' | string;

interface PlayerCompStats {
  matches: number;
  goals: number;
  assists: number;
  minutes: number;
}

export default function Squad() {
  const { state, updatePlayer } = useGame();
  const [view, setView] = useState<'roster' | 'history'>('roster');
  const [histScope, setHistScope] = useState<HistoryScope>('current');
  const [filter, setFilter] = useState<PlayerStatus | 'Todos'>('Todos');
  const [compFilter, setCompFilter] = useState<CompFilter>('all');
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
  const scopes = useMemo(
    () => scopeOptions(state.season, state.seasonHistory),
    [state.season, state.seasonHistory],
  );

  const statsByPlayerComp = useMemo(() => {
    const map = new Map<string, Map<string, PlayerCompStats>>();

    function bump(playerId: string, competition: string, patch: Partial<PlayerCompStats>) {
      let byComp = map.get(playerId);
      if (!byComp) {
        byComp = new Map();
        map.set(playerId, byComp);
      }
      const prev = byComp.get(competition) ?? { matches: 0, goals: 0, assists: 0, minutes: 0 };
      byComp.set(competition, {
        matches: prev.matches + (patch.matches ?? 0),
        goals: prev.goals + (patch.goals ?? 0),
        assists: prev.assists + (patch.assists ?? 0),
        minutes: prev.minutes + (patch.minutes ?? 0),
      });
    }

    for (const match of state.matches.filter(m => m.status === 'completed')) {
      const played = new Set(match.playerMatches ?? []);
      // Titulares da escalação também contam se playerMatches estiver vazio (saves antigos)
      if (played.size === 0 && match.lineup?.formation) {
        for (const slot of match.lineup.formation) played.add(slot.playerId);
      }
      for (const playerId of played) {
        bump(playerId, match.competition, { matches: 1 });
      }
      for (const goal of match.goals ?? []) {
        if (!goal.isOwnGoal && goal.playerId) {
          bump(goal.playerId, match.competition, { goals: 1 });
        }
      }
      for (const assist of match.assists ?? []) {
        if (assist.playerId) bump(assist.playerId, match.competition, { assists: 1 });
      }
    }
    return map;
  }, [state.matches]);

  const compSummaries = useMemo(() => {
    return state.seasonCompetitions.map(comp => {
      let playersUsed = 0;
      for (const [, byComp] of statsByPlayerComp) {
        const s = byComp.get(comp.name);
        if (s && s.matches > 0) playersUsed += 1;
      }
      const matchCount = state.matches.filter(
        m => m.competition === comp.name && m.status === 'completed',
      ).length;
      return { ...comp, matchCount, playersUsed };
    });
  }, [state.seasonCompetitions, state.matches, statsByPlayerComp]);

  const players = state.players.filter(p => {
    const matchStatus = filter === 'Todos' || p.status === filter;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    if (!matchStatus || !matchSearch) return false;
    if (compFilter === 'all') return true;
    const stats = statsByPlayerComp.get(p.id)?.get(compFilter);
    return !!stats && stats.matches > 0;
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
    const teamGames = teamStatsForScope(
      state.team?.statistics,
      histScope,
      state.seasonHistory,
      state.season,
    ).matches;

    return historyRows.reduce(
      (acc, r) => ({
        matches: teamGames,
        goals: acc.goals + r.stats.goals,
        assists: acc.assists + r.stats.assists,
        yellowCards: acc.yellowCards + r.stats.yellowCards,
        redCards: acc.redCards + r.stats.redCards,
      }),
      { matches: teamGames, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
    );
  }, [historyRows, histScope, state.team?.statistics, state.seasonHistory, state.season]);

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

  function displayStats(playerId: string) {
    if (compFilter === 'all') {
      const p = state.players.find(x => x.id === playerId);
      return {
        matches: p?.stats.matches ?? 0,
        goals: p?.stats.goals ?? 0,
        assists: p?.stats.assists ?? 0,
      };
    }
    const s = statsByPlayerComp.get(playerId)?.get(compFilter);
    return {
      matches: s?.matches ?? 0,
      goals: s?.goals ?? 0,
      assists: s?.assists ?? 0,
    };
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
        <div className={styles.rosterLayout}>
          <aside className={styles.compSidebar}>
            <p className={styles.compSidebarTitle}>Competições</p>
            <button
              type="button"
              className={`${styles.compFilterBtn} ${compFilter === 'all' ? styles.compFilterActive : ''}`}
              onClick={() => setCompFilter('all')}
            >
              <span className={styles.compFilterDot} style={{ background: 'var(--text)' }} />
              <span className={styles.compFilterLabel}>Todas</span>
              <span className={styles.compFilterMeta}>{state.players.length}</span>
            </button>
            {compSummaries.map(comp => (
              <button
                key={comp.id}
                type="button"
                className={`${styles.compFilterBtn} ${compFilter === comp.name ? styles.compFilterActive : ''}`}
                onClick={() => setCompFilter(comp.name)}
              >
                <span className={styles.compFilterDot} style={{ background: comp.color }} />
                <span className={styles.compFilterLabel}>{comp.shortName || comp.name}</span>
                <span className={styles.compFilterMeta}>
                  {comp.matchCount}j
                </span>
              </button>
            ))}
            {compSummaries.length === 0 && (
              <p className={styles.compSidebarEmpty}>Nenhuma competição cadastrada</p>
            )}
          </aside>

          <div className={styles.rosterMain}>
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

            {compFilter !== 'all' && (
              <p className={styles.compBanner}>
                Filtrando por <strong>{compFilter}</strong> — números de J/G/A desta competição
              </p>
            )}

            {Object.keys(grouped).length === 0 ? (
              <div className={styles.empty}>
                {compFilter === 'all'
                  ? 'Nenhum jogador encontrado.'
                  : 'Nenhum atleta com jogos nesta competição.'}
              </div>
            ) : (
              Object.entries(grouped).map(([pos, group]) => (
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
                    {group.map(p => {
                      const stats = displayStats(p.id);
                      return (
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
                              <span className={styles.editName}>{p.name}</span>
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
                                min={1}
                                max={99}
                                value={editForm.overall}
                                onChange={e => setEditForm(f => ({ ...f, overall: Number(e.target.value) }))}
                              />
                              <select
                                className={styles.editSelect}
                                value={editForm.status}
                                onChange={e => setEditForm(f => ({ ...f, status: e.target.value as PlayerStatus }))}
                              >
                                {STATUS_OPTIONS.map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                              <input
                                className={styles.editInputMd}
                                type="number"
                                min={0}
                                placeholder="Salário"
                                value={editForm.salary}
                                onChange={e => setEditForm(f => ({ ...f, salary: Number(e.target.value) }))}
                              />
                              <input
                                className={styles.editInputMd}
                                type="number"
                                min={0}
                                placeholder="Valor"
                                value={editForm.marketValue}
                                onChange={e => setEditForm(f => ({ ...f, marketValue: Number(e.target.value) }))}
                              />
                              <div className={styles.editActions}>
                                <button type="button" className={styles.saveBtn} onClick={saveEdit}>Salvar</button>
                                <button type="button" className={styles.cancelBtn} onClick={cancelEdit}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div className={styles.tableRow}>
                              <span className={styles.colNum}>{p.number ?? '—'}</span>
                              <span className={styles.colName}>{p.name}</span>
                              <span className={styles.colAge}>{p.age}</span>
                              <span className={styles.colOvr} style={{ color: overallColor(p.overall) }}>{p.overall}</span>
                              <span className={styles.colMatches}>{stats.matches}</span>
                              <span className={styles.colStat}>{stats.goals}</span>
                              <span className={styles.colStat}>{stats.assists}</span>
                              <span className={styles.colStatus} style={{ color: STATUS_COLOR[p.status] }}>{p.status}</span>
                              <span className={styles.colAction}>
                                <button type="button" className={styles.editBtn} onClick={() => startEdit(p.id)}>Editar</button>
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
