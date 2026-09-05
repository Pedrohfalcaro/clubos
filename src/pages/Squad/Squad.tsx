import { useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import type { Player, PlayerStats, PlayerStatus } from '../../types/Player';
import { availabilityStatusLabel, isOnNationalDuty } from '../../types/Player';
import {
  scopeOptions,
  playerStatsForScope,
  formerPlayersForScope,
  teamStatsForScope,
  type HistoryScope,
} from '../../utils/historyScope';
import { calcPlayerAverageRating } from '../../utils/matchStats';
import { ratingColor } from '../../utils/matchEvents';
import { getMatchPlayingTime } from '../../utils/playingTime';
import {
  formatMinutesPerParticipation,
  formatCleanSheetPct,
} from '../../utils/livelifeTemplates';
import { competitionNames } from '../../utils/competitions';
import { PERSONALIDADES, isPersonality } from '../../pulse/utils';
import styles from './Squad.module.css';

const POSITION_ORDER = ['GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'CF', 'ST'];
const POSITION_LABELS: Record<string, string> = {
  GK: 'Goleiros', CB: 'Zagueiros', RB: 'Laterais Direitos', LB: 'Laterais Esquerdos',
  CDM: 'Volantes', CM: 'Meio-campistas', CAM: 'Meias-atacantes',
  RW: 'Pontas Direitas', LW: 'Pontas Esquerdas', CF: 'Centroavantes', ST: 'Atacantes',
};

const STATUS_FILTERS: Array<PlayerStatus | 'Todos'> = [
  'Todos', 'Titular', 'Reserva', 'Promessa', 'Transferível', 'Emprestado', 'Aposentado',
];
const STATUS_OPTIONS: PlayerStatus[] = [
  'Titular', 'Reserva', 'Promessa', 'Transferível', 'Emprestado', 'Aposentado',
];

const STATUS_COLOR: Record<string, string> = {
  Titular: 'var(--success)',
  Reserva: 'var(--text)',
  Promessa: 'var(--accent)',
  Transferível: 'var(--danger)',
  Emprestado: '#f59e0b',
  Aposentado: '#94a3b8',
};

function overallColor(ovr: number): string {
  if (ovr >= 80) return 'var(--success)';
  if (ovr >= 70) return 'var(--warning)';
  return 'var(--text)';
}

function formatAvg(rating: number | null): string {
  if (rating == null) return '—';
  return rating.toFixed(1);
}

function moraleMeta(morale: number): { label: string; color: string; title: string } {
  const m = Math.max(0, Math.min(100, Math.round(morale)));
  const tip = `Moral: ${m}/100`;
  if (m >= 80) return { label: '▲', color: 'var(--success)', title: `${tip} · alta` };
  if (m >= 60) return { label: '●', color: '#22c55e', title: `${tip} · boa` };
  if (m >= 40) return { label: '●', color: 'var(--warning)', title: `${tip} · média` };
  if (m >= 20) return { label: '▼', color: '#f97316', title: `${tip} · baixa` };
  return { label: '▼', color: 'var(--danger)', title: `${tip} · péssima` };
}

type CompFilter = 'all' | string;
type SortKey = 'nota' | 'ga' | 'a' | 'g' | 'j';
type HistSortKey = 'j' | 'min' | 'g' | 'a' | 'sg' | 'ca' | 'cv';

interface PlayerCompStats {
  matches: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  goalsConceded: number;
  minutes: number;
  starts: number;
}

export default function Squad() {
  const { state, updatePlayer, updatePlayerStats, updateSeasonArchivePlayerStats, recalcSeasonStats } = useGame();
  const [view, setView] = useState<'roster' | 'history'>('roster');
  const [histScope, setHistScope] = useState<HistoryScope>('current');
  const [filter, setFilter] = useState<PlayerStatus | 'Todos'>('Todos');
  const [compFilter, setCompFilter] = useState<CompFilter>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [histSortKey, setHistSortKey] = useState<HistSortKey | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStatsId, setEditingStatsId] = useState<string | null>(null);
  const [statsEditForm, setStatsEditForm] = useState({
    matches: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    goalsConceded: 0,
    yellowCards: 0,
    redCards: 0,
    starts: 0,
  });
  const [editForm, setEditForm] = useState({
    name: '',
    number: '' as string | number,
    age: 0,
    overall: 0,
    status: 'Titular' as PlayerStatus,
    salary: 0,
    marketValue: 0,
    loanReturnDate: '',
    retirementDate: '',
  });
  const scopes = useMemo(
    () => scopeOptions(state.season, state.seasonHistory),
    [state.season, state.seasonHistory],
  );

  // Só jogos da temporada atual — usado para "nota" e estatísticas por competição,
  // que não podem misturar partidas de temporadas já fechadas (bug antigo).
  const seasonMatches = useMemo(
    () =>
      state.matches.filter(
        m => m.status === 'completed' && (m.season ?? state.season) === state.season,
      ),
    [state.matches, state.season],
  );

  const statsByPlayerComp = useMemo(() => {
    const map = new Map<string, Map<string, PlayerCompStats>>();

    function bump(playerId: string, competition: string, patch: Partial<PlayerCompStats>) {
      let byComp = map.get(playerId);
      if (!byComp) {
        byComp = new Map();
        map.set(playerId, byComp);
      }
      const prev = byComp.get(competition) ?? {
        matches: 0,
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        goalsConceded: 0,
        minutes: 0,
        starts: 0,
      };
      byComp.set(competition, {
        matches: prev.matches + (patch.matches ?? 0),
        goals: prev.goals + (patch.goals ?? 0),
        assists: prev.assists + (patch.assists ?? 0),
        cleanSheets: prev.cleanSheets + (patch.cleanSheets ?? 0),
        goalsConceded: prev.goalsConceded + (patch.goalsConceded ?? 0),
        minutes: prev.minutes + (patch.minutes ?? 0),
        starts: prev.starts + (patch.starts ?? 0),
      });
    }

    const playerById = new Map(state.players.map(p => [p.id, p]));
    for (const match of seasonMatches) {
      const playingTime = getMatchPlayingTime(match);
      const played = new Set(playingTime.keys());
      if (played.size === 0 && match.lineup?.formation) {
        for (const slot of match.lineup.formation) played.add(slot.playerId);
      }
      const cleanSheet = match.goalsAgainst === 0;
      for (const playerId of played) {
        const mins = playingTime.get(playerId) ?? 0;
        const isGk = playerById.get(playerId)?.position === 'GK';
        bump(playerId, match.competition, {
          matches: 1,
          minutes: mins,
          cleanSheets: cleanSheet && mins > 0 ? 1 : 0,
          goalsConceded: isGk && mins > 0 ? match.goalsAgainst : 0,
        });
      }
      for (const slot of match.lineup?.formation ?? []) {
        bump(slot.playerId, match.competition, { starts: 1 });
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
  }, [seasonMatches, state.players]);

  const compSummaries = useMemo(() => {
    return state.seasonCompetitions.map(comp => {
      let playersUsed = 0;
      for (const [, byComp] of statsByPlayerComp) {
        const s = byComp.get(comp.name);
        if (s && s.matches > 0) playersUsed += 1;
      }
      const matchCount = seasonMatches.filter(m => m.competition === comp.name).length;
      return { ...comp, matchCount, playersUsed };
    });
  }, [state.seasonCompetitions, seasonMatches, statsByPlayerComp]);

  const players = state.players.filter(p => {
    const matchStatus = filter === 'Todos' || p.status === filter;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    if (!matchStatus || !matchSearch) return false;
    if (compFilter === 'all') return true;
    const stats = statsByPlayerComp.get(p.id)?.get(compFilter);
    return !!stats && stats.matches > 0;
  });

  const historyRows = useMemo(() => {
    const former = formerPlayersForScope(state.formerPlayers, histScope, state.seasonHistory, state.season);
    return [...state.players, ...former]
      .map(p => ({
        player: p,
        former: former.includes(p),
        stats: playerStatsForScope(p, histScope, state.seasonHistory, state.season),
      }))
      .filter(row =>
        row.player.name.toLowerCase().includes(search.toLowerCase()) &&
        (histScope === 'current' || histScope === 'total' || row.stats.matches > 0 || row.stats.goals > 0 || row.stats.assists > 0),
      )
      .sort((a, b) => {
        if (histSortKey) {
          return histSortValue(b.stats, histSortKey) - histSortValue(a.stats, histSortKey);
        }
        return b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists || b.stats.matches - a.stats.matches;
      });
  }, [state.players, state.formerPlayers, histScope, state.seasonHistory, state.season, search, histSortKey]);

  function toggleHistSort(key: HistSortKey) {
    setHistSortKey(prev => (prev === key ? null : key));
  }

  function histSortValue(stats: ReturnType<typeof playerStatsForScope>, key: HistSortKey): number {
    switch (key) {
      case 'j': return stats.matches;
      case 'min': return stats.minutes;
      case 'g': return stats.goals;
      case 'a': return stats.assists;
      case 'sg': return stats.cleanSheets ?? 0;
      case 'ca': return stats.yellowCards;
      case 'cv': return stats.redCards;
    }
  }

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
        minutes: acc.minutes + r.stats.minutes,
        goals: acc.goals + r.stats.goals,
        assists: acc.assists + r.stats.assists,
        cleanSheets: acc.cleanSheets + (r.stats.cleanSheets ?? 0),
        yellowCards: acc.yellowCards + r.stats.yellowCards,
        redCards: acc.redCards + r.stats.redCards,
      }),
      {
        matches: teamGames,
        minutes: 0,
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        yellowCards: 0,
        redCards: 0,
      },
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
      name: p.name,
      number: p.number ?? '',
      age: p.age,
      overall: p.overall,
      status: p.status,
      salary: p.salary ?? 0,
      marketValue: p.marketValue ?? 0,
      loanReturnDate: p.loanReturnDate ?? '',
      retirementDate: p.retirementDate ?? '',
    });
  }

  function saveEdit() {
    if (!editingId) return;
    const name = editForm.name.trim();
    if (!name) return;
    updatePlayer(editingId, {
      name,
      number: editForm.number === '' ? null : Number(editForm.number),
      age: editForm.age,
      overall: editForm.overall,
      status: editForm.status,
      salary: editForm.salary,
      marketValue: editForm.marketValue,
      loanReturnDate: editForm.status === 'Emprestado' ? (editForm.loanReturnDate || undefined) : undefined,
      retirementDate: editForm.status === 'Aposentado' ? undefined : (editForm.retirementDate || undefined),
    });
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  /**
   * Edição manual das estatísticas mostradas no Histórico — para corrigir números
   * duplicados/contaminados (ex.: jogador vendido cujo snapshot da temporada somou
   * jogos de mais de uma temporada por causa do bug antigo do `recalculateFromMatches`).
   * Não é possível editar o escopo "Total da carreira" — é uma soma calculada, não um
   * registro único; a correção deve ser feita na temporada de origem.
   */
  function startStatsEdit(playerId: string, stats: PlayerStats) {
    setEditingStatsId(playerId);
    setStatsEditForm({
      matches: stats.matches,
      minutes: stats.minutes,
      goals: stats.goals,
      assists: stats.assists,
      cleanSheets: stats.cleanSheets ?? 0,
      goalsConceded: stats.goalsConceded ?? 0,
      yellowCards: stats.yellowCards,
      redCards: stats.redCards,
      starts: stats.starts ?? 0,
    });
  }

  function cancelStatsEdit() {
    setEditingStatsId(null);
  }

  function saveStatsEdit(playerId: string) {
    if (histScope === 'total') return;
    if (histScope === 'current' || histScope === state.season) {
      updatePlayerStats(playerId, statsEditForm);
    } else {
      updateSeasonArchivePlayerStats(histScope, playerId, statsEditForm);
    }
    setEditingStatsId(null);
  }

  /**
   * Recuperação para saves antigos: reconstrói `player.stats`/`team.statistics` a
   * partir só dos jogos da temporada atual — corrige números que ficaram misturados
   * com temporadas passadas (bug do `recalculateFromMatches` sem filtro de temporada).
   */
  function handleRecalcStats() {
    if (
      !window.confirm(
        `Recalcular gols, jogos, cartões e outras estatísticas da temporada ${state.season} a partir dos jogos registrados? Isso corrige números misturados com temporadas anteriores.`,
      )
    ) {
      return;
    }
    recalcSeasonStats();
  }

  function clearAvailability(playerId: string) {
    updatePlayer(playerId, {
      availability: 'disponivel',
      injuryDaysRemaining: undefined,
      suspensionMatchesRemaining: undefined,
      suspensionCompetition: undefined,
    });
  }

  const competitionOptions = competitionNames(state.seasonCompetitions);

  function adjustAvailabilityDays(player: Player, delta: number) {
    if (player.availability === 'suspenso') {
      const next = Math.max(0, (player.suspensionMatchesRemaining ?? 1) + delta);
      if (next <= 0) {
        clearAvailability(player.id);
        return;
      }
      updatePlayer(player.id, { suspensionMatchesRemaining: next });
      return;
    }
    if (player.availability === 'lesionado' || player.availability === 'indisponivel') {
      const next = Math.max(0, (player.injuryDaysRemaining ?? 1) + delta);
      if (next <= 0) {
        clearAvailability(player.id);
        return;
      }
      updatePlayer(player.id, { injuryDaysRemaining: next });
    }
  }

  function setAvailabilityDays(player: Player, value: number) {
    const days = Math.max(0, Math.round(value));
    if (days <= 0) {
      clearAvailability(player.id);
      return;
    }
    if (player.availability === 'suspenso') {
      updatePlayer(player.id, { suspensionMatchesRemaining: days });
      return;
    }
    if (player.availability === 'lesionado' || player.availability === 'indisponivel') {
      updatePlayer(player.id, { injuryDaysRemaining: days });
    }
  }

  function displayStats(playerId: string) {
    const avg = calcPlayerAverageRating(
      playerId,
      seasonMatches,
      compFilter === 'all' ? undefined : compFilter,
    );
    if (compFilter === 'all') {
      const p = state.players.find(x => x.id === playerId);
      return {
        matches: p?.stats.matches ?? 0,
        minutes: p?.stats.minutes ?? 0,
        goals: p?.stats.goals ?? 0,
        assists: p?.stats.assists ?? 0,
        cleanSheets: p?.stats.cleanSheets ?? 0,
        goalsConceded: p?.stats.goalsConceded ?? 0,
        starts: p?.stats.starts ?? 0,
        avg,
      };
    }
    const s = statsByPlayerComp.get(playerId)?.get(compFilter);
    return {
      matches: s?.matches ?? 0,
      minutes: s?.minutes ?? 0,
      goals: s?.goals ?? 0,
      assists: s?.assists ?? 0,
      cleanSheets: s?.cleanSheets ?? 0,
      goalsConceded: s?.goalsConceded ?? 0,
      starts: s?.starts ?? 0,
      avg,
    };
  }

  function toggleSort(key: SortKey) {
    setSortKey(prev => (prev === key ? null : key));
  }

  function sortValue(stats: ReturnType<typeof displayStats>, key: SortKey): number {
    switch (key) {
      case 'nota': return stats.avg ?? -Infinity;
      case 'ga': return stats.goals + stats.assists;
      case 'a': return stats.assists;
      case 'g': return stats.goals;
      case 'j': return stats.matches;
    }
  }

  function sortPlayers(list: Player[]): Player[] {
    if (!sortKey) return list;
    return [...list].sort(
      (a, b) => sortValue(displayStats(b.id), sortKey) - sortValue(displayStats(a.id), sortKey),
    );
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
        <button
          type="button"
          className={styles.editBtn}
          onClick={handleRecalcStats}
          title="Use se gols/jogos/cartões da temporada aparecerem com números de temporadas anteriores"
        >
          Recalcular estatísticas da temporada
        </button>
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
                  onClick={() => {
                    setHistScope(s.value);
                    setEditingStatsId(null);
                  }}
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
            <div><strong>{historyTotals.cleanSheets}</strong><span>SG</span></div>
            <div><strong>{historyTotals.yellowCards}</strong><span>CA</span></div>
            <div><strong>{historyTotals.redCards}</strong><span>CV</span></div>
          </div>

          {histScope === 'total' && (
            <p className={styles.compBanner}>
              "Total da carreira" é uma soma — não dá pra editar aqui. Pra corrigir um número
              duplicado, selecione a temporada específica onde ele aparece.
            </p>
          )}

          {historyRows.length === 0 ? (
            <div className={styles.empty}>Nenhum dado neste período.</div>
          ) : (
            <div className={styles.histTable}>
              <div className={`${styles.histRow} ${styles.histHead}`}>
                <span>Jogador</span>
                <span>Pos</span>
                <span
                  className={`${styles.sortableCol} ${histSortKey === 'j' ? styles.sortActive : ''}`}
                  onClick={() => toggleHistSort('j')}
                  title="Ordenar por jogos"
                >
                  J{histSortKey === 'j' ? ' ▾' : ''}
                </span>
                <span
                  className={`${styles.sortableCol} ${histSortKey === 'min' ? styles.sortActive : ''}`}
                  onClick={() => toggleHistSort('min')}
                  title="Ordenar por minutos"
                >
                  Min{histSortKey === 'min' ? ' ▾' : ''}
                </span>
                <span
                  className={`${styles.sortableCol} ${histSortKey === 'g' ? styles.sortActive : ''}`}
                  onClick={() => toggleHistSort('g')}
                  title="Ordenar por gols"
                >
                  G{histSortKey === 'g' ? ' ▾' : ''}
                </span>
                <span
                  className={`${styles.sortableCol} ${histSortKey === 'a' ? styles.sortActive : ''}`}
                  onClick={() => toggleHistSort('a')}
                  title="Ordenar por assistências"
                >
                  A{histSortKey === 'a' ? ' ▾' : ''}
                </span>
                <span
                  className={`${styles.sortableCol} ${histSortKey === 'sg' ? styles.sortActive : ''}`}
                  onClick={() => toggleHistSort('sg')}
                  title="Ordenar por jogos sem sofrer gols"
                >
                  SG{histSortKey === 'sg' ? ' ▾' : ''}
                </span>
                <span title="Linha: min÷(G+A) · GK: %SG">Ef.</span>
                <span
                  className={`${styles.sortableCol} ${histSortKey === 'ca' ? styles.sortActive : ''}`}
                  onClick={() => toggleHistSort('ca')}
                  title="Ordenar por cartões amarelos"
                >
                  CA{histSortKey === 'ca' ? ' ▾' : ''}
                </span>
                <span
                  className={`${styles.sortableCol} ${histSortKey === 'cv' ? styles.sortActive : ''}`}
                  onClick={() => toggleHistSort('cv')}
                  title="Ordenar por cartões vermelhos"
                >
                  CV{histSortKey === 'cv' ? ' ▾' : ''}
                </span>
              </div>
              {historyRows.map(({ player: p, stats, former }) =>
                editingStatsId === p.id ? (
                  <div key={p.id} className={styles.editPanel}>
                    <div className={styles.editPanelHead}>
                      <div>
                        <p className={styles.editPanelEyebrow}>Editar estatísticas</p>
                        <h3 className={styles.editPanelTitle}>{p.name}</h3>
                      </div>
                      <div className={styles.editPanelActions}>
                        <button type="button" className={styles.cancelBtn} onClick={cancelStatsEdit}>
                          Cancelar
                        </button>
                        <button type="button" className={styles.saveBtn} onClick={() => saveStatsEdit(p.id)}>
                          Salvar
                        </button>
                      </div>
                    </div>
                    <div className={styles.editGrid}>
                      {([
                        ['matches', 'Jogos'],
                        ['starts', 'Titular'],
                        ['minutes', 'Minutos'],
                        ['goals', 'Gols'],
                        ['assists', 'Assistências'],
                        ['cleanSheets', 'Sem sofrer gols'],
                        ['goalsConceded', 'Gols sofridos'],
                        ['yellowCards', 'Cartões amarelos'],
                        ['redCards', 'Cartões vermelhos'],
                      ] as [keyof typeof statsEditForm, string][]).map(([key, label]) => (
                        <label key={key} className={styles.editField}>
                          <span>{label}</span>
                          <input
                            className={styles.editFieldInput}
                            type="number"
                            min={0}
                            value={statsEditForm[key]}
                            onChange={e =>
                              setStatsEditForm(f => ({ ...f, [key]: Math.max(0, Number(e.target.value) || 0) }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div key={p.id} className={styles.histRow}>
                    <span className={styles.histName}>
                      {p.name}
                      {former && (
                        <span className={styles.formerBadge} title="Não faz mais parte do elenco">
                          ex
                        </span>
                      )}
                      {histScope !== 'total' && (
                        <button
                          type="button"
                          className={styles.editBtn}
                          style={{ marginLeft: 6, padding: '1px 6px' }}
                          onClick={() => startStatsEdit(p.id, stats)}
                          title="Editar estatísticas (corrige números duplicados de outra temporada)"
                        >
                          ✎
                        </button>
                      )}
                    </span>
                    <span>{p.position}</span>
                    <span>
                      {stats.matches}
                      <span className={styles.startsHint} title="Jogos como titular">
                        {' '}({stats.starts ?? 0})
                      </span>
                    </span>
                    <span>{stats.minutes}'</span>
                    <span>{stats.goals}</span>
                    <span>{stats.assists}</span>
                    <span>{stats.cleanSheets ?? 0}</span>
                    <span>
                      {p.position === 'GK'
                        ? (() => {
                            const pct = formatCleanSheetPct(stats.cleanSheets ?? 0, stats.matches);
                            return pct === '—' ? pct : `${pct}%`;
                          })()
                        : formatMinutesPerParticipation(stats.goals, stats.assists, stats.minutes)}
                    </span>
                    <span>{stats.yellowCards}</span>
                    <span>{stats.redCards}</span>
                  </div>
                ),
              )}
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
                Filtrando por <strong>{compFilter}</strong> — J / Min / Nota / G / A / SG / eficiência desta competição
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
                      <span
                        className={`${styles.colMatches} ${styles.sortableCol} ${sortKey === 'j' ? styles.sortActive : ''}`}
                        onClick={() => toggleSort('j')}
                        title="Ordenar por jogos"
                      >
                        J{sortKey === 'j' ? ' ▾' : ''}
                      </span>
                      <span className={styles.colMin}>Min</span>
                      <span
                        className={`${styles.colNota} ${styles.sortableCol} ${sortKey === 'nota' ? styles.sortActive : ''}`}
                        onClick={() => toggleSort('nota')}
                        title="Ordenar por nota"
                      >
                        Nota{sortKey === 'nota' ? ' ▾' : ''}
                      </span>
                      <span
                        className={`${styles.colStat} ${styles.sortableCol} ${sortKey === 'g' ? styles.sortActive : ''}`}
                        onClick={() => toggleSort('g')}
                        title="Ordenar por gols"
                      >
                        G{sortKey === 'g' ? ' ▾' : ''}
                      </span>
                      <span
                        className={`${styles.colStat} ${styles.sortableCol} ${sortKey === 'a' ? styles.sortActive : ''}`}
                        onClick={() => toggleSort('a')}
                        title="Ordenar por assistências"
                      >
                        A{sortKey === 'a' ? ' ▾' : ''}
                      </span>
                      <span
                        className={`${styles.colStat} ${styles.sortableCol} ${sortKey === 'ga' ? styles.sortActive : ''}`}
                        onClick={() => toggleSort('ga')}
                        title="Ordenar por gols + assistências"
                      >
                        G/A{sortKey === 'ga' ? ' ▾' : ''}
                      </span>
                      <span className={styles.colStat} title="Sem sofrer gols">SG</span>
                      <span
                        className={styles.colRate}
                        title={
                          pos === 'GK'
                            ? 'Percentual de jogos sem sofrer gol (SG ÷ J)'
                            : 'Minutos por participação em gol (min ÷ G+A)'
                        }
                      >
                        {pos === 'GK' ? '%SG' : 'Min/Part'}
                      </span>
                      <span className={styles.colStatus}>Status</span>
                      <span className={styles.colAction} />
                    </div>
                    {sortPlayers(group).map(p => {
                      const stats = displayStats(p.id);
                      const retired = p.status === 'Aposentado';
                      const morale = moraleMeta(p.morale ?? 70);
                      const rateLabel = (() => {
                        if (p.position === 'GK') {
                          const pct = formatCleanSheetPct(stats.cleanSheets, stats.matches);
                          return pct === '—' ? pct : `${pct}%`;
                        }
                        return formatMinutesPerParticipation(
                          stats.goals,
                          stats.assists,
                          stats.minutes,
                        );
                      })();
                      return (
                        <div key={p.id}>
                          {editingId === p.id ? (
                            <div className={styles.editPanel}>
                              <div className={styles.editPanelHead}>
                                <div>
                                  <p className={styles.editPanelEyebrow}>Editar atleta</p>
                                  <h3 className={styles.editPanelTitle}>{p.name}</h3>
                                </div>
                                <div className={styles.editPanelActions}>
                                  <button type="button" className={styles.cancelBtn} onClick={cancelEdit}>
                                    Cancelar
                                  </button>
                                  <button type="button" className={styles.saveBtn} onClick={saveEdit}>
                                    Salvar
                                  </button>
                                </div>
                              </div>

                              <div className={styles.editGrid}>
                                <label className={styles.editField}>
                                  <span>Nome</span>
                                  <input
                                    className={styles.editFieldInput}
                                    type="text"
                                    value={editForm.name}
                                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                  />
                                </label>
                                <label className={styles.editField}>
                                  <span>Nº</span>
                                  <input
                                    className={styles.editFieldInput}
                                    type="number"
                                    min={1}
                                    max={99}
                                    value={editForm.number}
                                    onChange={e => setEditForm(f => ({ ...f, number: e.target.value }))}
                                  />
                                </label>
                                <label className={styles.editField}>
                                  <span>Idade</span>
                                  <input
                                    className={styles.editFieldInput}
                                    type="number"
                                    min={15}
                                    max={45}
                                    value={editForm.age}
                                    onChange={e => setEditForm(f => ({ ...f, age: Number(e.target.value) }))}
                                  />
                                </label>
                                <label className={styles.editField}>
                                  <span>Overall</span>
                                  <input
                                    className={styles.editFieldInput}
                                    type="number"
                                    min={1}
                                    max={99}
                                    value={editForm.overall}
                                    onChange={e => setEditForm(f => ({ ...f, overall: Number(e.target.value) }))}
                                  />
                                </label>
                                <label className={styles.editField}>
                                  <span>Status no elenco</span>
                                  <select
                                    className={styles.editFieldInput}
                                    value={editForm.status}
                                    onChange={e =>
                                      setEditForm(f => ({ ...f, status: e.target.value as PlayerStatus }))
                                    }
                                  >
                                    {STATUS_OPTIONS.map(s => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                </label>
                                {editForm.status === 'Emprestado' && (
                                  <label className={styles.editField}>
                                    <span>Retorno do empréstimo</span>
                                    <input
                                      className={styles.editFieldInput}
                                      type="date"
                                      value={editForm.loanReturnDate}
                                      onChange={e =>
                                        setEditForm(f => ({ ...f, loanReturnDate: e.target.value }))
                                      }
                                    />
                                  </label>
                                )}
                                {editForm.status !== 'Aposentado' && (
                                  <label className={styles.editField}>
                                    <span>Aposentadoria agendada</span>
                                    <input
                                      className={styles.editFieldInput}
                                      type="date"
                                      value={editForm.retirementDate}
                                      onChange={e =>
                                        setEditForm(f => ({ ...f, retirementDate: e.target.value }))
                                      }
                                    />
                                  </label>
                                )}
                                <label className={styles.editField}>
                                  <span>Salário</span>
                                  <input
                                    className={styles.editFieldInput}
                                    type="number"
                                    min={0}
                                    value={editForm.salary}
                                    onChange={e => setEditForm(f => ({ ...f, salary: Number(e.target.value) }))}
                                  />
                                </label>
                                <label className={styles.editField}>
                                  <span>Valor de mercado</span>
                                  <input
                                    className={styles.editFieldInput}
                                    type="number"
                                    min={0}
                                    value={editForm.marketValue}
                                    onChange={e =>
                                      setEditForm(f => ({ ...f, marketValue: Number(e.target.value) }))
                                    }
                                  />
                                </label>
                                <label className={styles.editField}>
                                  <span>Personalidade</span>
                                  <select
                                    className={styles.editFieldInput}
                                    value={isPersonality(p.personality) ? p.personality : 'Disciplinado'}
                                    onChange={e =>
                                      updatePlayer(p.id, { personality: e.target.value })
                                    }
                                  >
                                    {PERSONALIDADES.map(pers => (
                                      <option key={pers} value={pers}>{pers}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className={styles.editField}>
                                  <span>Moral ({Math.round(p.morale ?? 70)})</span>
                                  <input
                                    className={styles.editFieldInput}
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={p.morale ?? 70}
                                    onChange={e =>
                                      updatePlayer(p.id, { morale: Number(e.target.value) })
                                    }
                                  />
                                </label>
                              </div>

                              <div className={styles.availSection}>
                                <p className={styles.availSectionTitle}>Disponibilidade</p>
                                <div className={styles.toggleRow}>
                                  <label className={styles.toggleLabel}>
                                    <input
                                      type="checkbox"
                                      className={styles.toggleInput}
                                      checked={p.availability === 'lesionado' || p.availability === 'indisponivel'}
                                      onChange={e => {
                                        if (e.target.checked) {
                                          updatePlayer(p.id, {
                                            availability: 'lesionado',
                                            injuryDaysRemaining:
                                              (p.injuryDaysRemaining ?? 0) > 0 ? p.injuryDaysRemaining : 14,
                                            suspensionMatchesRemaining: undefined,
                                            suspensionCompetition: undefined,
                                          });
                                        } else {
                                          clearAvailability(p.id);
                                        }
                                      }}
                                    />
                                    <span className={styles.toggleTrack} aria-hidden />
                                    <span className={styles.toggleText}>Lesionado</span>
                                  </label>
                                  <label className={styles.toggleLabel}>
                                    <input
                                      type="checkbox"
                                      className={styles.toggleInput}
                                      checked={p.availability === 'suspenso'}
                                      onChange={e => {
                                        if (e.target.checked) {
                                          updatePlayer(p.id, {
                                            availability: 'suspenso',
                                            suspensionMatchesRemaining:
                                              (p.suspensionMatchesRemaining ?? 0) > 0
                                                ? p.suspensionMatchesRemaining
                                                : 1,
                                            suspensionCompetition:
                                              p.suspensionCompetition ||
                                              competitionOptions[0] ||
                                              'Campeonato Nacional',
                                            injuryDaysRemaining: undefined,
                                          });
                                        } else {
                                          clearAvailability(p.id);
                                        }
                                      }}
                                    />
                                    <span className={styles.toggleTrack} aria-hidden />
                                    <span className={styles.toggleText}>Suspenso</span>
                                  </label>
                                </div>

                                {p.availability === 'suspenso' && (
                                  <label className={styles.editField} style={{ marginTop: 8 }}>
                                    <span>Competição da suspensão</span>
                                    <select
                                      value={p.suspensionCompetition ?? ''}
                                      onChange={e =>
                                        updatePlayer(p.id, {
                                          suspensionCompetition: e.target.value || undefined,
                                        })
                                      }
                                    >
                                      <option value="">Todas (legado)</option>
                                      {competitionOptions.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                      ))}
                                    </select>
                                  </label>
                                )}

                                {(p.availability === 'lesionado' ||
                                  p.availability === 'suspenso' ||
                                  p.availability === 'indisponivel') && (
                                  <div className={styles.penaltyControls}>
                                    <span className={styles.penaltyHint}>
                                      {p.availability === 'suspenso'
                                        ? 'Partidas restantes (nessa competição)'
                                        : 'Dias restantes'}
                                    </span>
                                    <button
                                      type="button"
                                      className={styles.penaltyBtn}
                                      onClick={() => adjustAvailabilityDays(p, -1)}
                                    >
                                      −
                                    </button>
                                    <input
                                      className={styles.penaltyValue}
                                      type="number"
                                      min={0}
                                      value={
                                        p.availability === 'suspenso'
                                          ? (p.suspensionMatchesRemaining ?? 0)
                                          : (p.injuryDaysRemaining ?? 0)
                                      }
                                      onChange={e => setAvailabilityDays(p, Number(e.target.value))}
                                    />
                                    <button
                                      type="button"
                                      className={styles.penaltyBtn}
                                      onClick={() => adjustAvailabilityDays(p, 1)}
                                    >
                                      +
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.clearPenaltyBtn}
                                      onClick={() => clearAvailability(p.id)}
                                    >
                                      Liberar atleta
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className={`${styles.tableRow} ${retired ? styles.rowRetired : ''}`}>
                              <span className={styles.colNum}>{p.number ?? '—'}</span>
                              <span className={styles.colName}>
                                <span className={styles.nameText}>{p.name}</span>
                                <span
                                  className={styles.moraleMark}
                                  style={{ color: morale.color }}
                                  title={morale.title}
                                  data-tip={morale.title}
                                  aria-label={morale.title}
                                >
                                  {morale.label}
                                </span>
                                {availabilityStatusLabel(p, state.currentDate) && (
                                  isOnNationalDuty(p, state.currentDate) &&
                                  p.availability !== 'lesionado' &&
                                  p.availability !== 'suspenso' &&
                                  p.availability !== 'indisponivel' ? (
                                    <span
                                      className={`${styles.availBadge} ${styles.availBadgeStatic}`}
                                      title="Convocado pela Seleção Nacional — gerencie no Modo Seleção"
                                    >
                                      {availabilityStatusLabel(p, state.currentDate)}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      className={styles.availBadge}
                                      onClick={() => startEdit(p.id)}
                                      title="Editar penalidade"
                                    >
                                      {availabilityStatusLabel(p, state.currentDate)}
                                    </button>
                                  )
                                )}
                                {!retired && p.retirementDate && (
                                  <button
                                    type="button"
                                    className={`${styles.availBadge} ${styles.retirementHint}`}
                                    onClick={() => startEdit(p.id)}
                                    title="Aposentadoria agendada — editar"
                                  >
                                    Aposenta em {p.retirementDate.slice(0, 10)}
                                  </button>
                                )}
                              </span>
                              <span className={styles.colAge}>{p.age}</span>
                              <span className={styles.colOvr} style={{ color: overallColor(p.overall) }}>{p.overall}</span>
                              <span className={styles.colMatches}>
                                {stats.matches}
                                <span className={styles.startsHint} title="Jogos como titular">
                                  {' '}({stats.starts ?? 0})
                                </span>
                              </span>
                              <span className={styles.colMin}>{stats.minutes}'</span>
                              <span
                                className={styles.notaBadge}
                                style={{
                                  background: stats.avg != null ? ratingColor(stats.avg) : 'transparent',
                                  color: stats.avg != null ? '#fff' : 'var(--text)',
                                  border: stats.avg == null ? '1px solid var(--border)' : 'none',
                                }}
                              >
                                {formatAvg(stats.avg)}
                              </span>
                              <span className={styles.colStat}>{stats.goals}</span>
                              <span className={styles.colStat}>{stats.assists}</span>
                              <span className={styles.colStat} title="Gols + Assistências">{stats.goals + stats.assists}</span>
                              <span className={styles.colStat} title="Sem sofrer gols">{stats.cleanSheets}</span>
                              <span
                                className={styles.colRate}
                                title={
                                  p.position === 'GK'
                                    ? 'Percentual de jogos sem sofrer gol'
                                    : 'Minutos por participação em gol'
                                }
                              >
                                {rateLabel}
                              </span>
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
