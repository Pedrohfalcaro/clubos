import { posAbbr } from '../../utils/positions';
import { useMemo, useState } from 'react';
import { sortByPosition, type PlayerPosition } from '../../types/Player';
import { findTrait, traitsFor } from '../../training/engine';
import type { TrainingScope } from './useTrainingScope';
import styles from './TrainingPit.module.css';

interface Row {
  id: string;
  name: string;
  position: PlayerPosition;
  trait: string | undefined;
  morale: number;
  sessions: number;
  goals: number;
  assists: number;
  saves: number;
  clearances: number;
  cleanSheets: number;
  avgRating: number | null;
}

type SortKey =
  | 'position'
  | 'name'
  | 'sessions'
  | 'goals'
  | 'assists'
  | 'saves'
  | 'clearances'
  | 'cleanSheets'
  | 'avgRating'
  | 'morale';

/** Colunas que ordenam do maior para o menor no primeiro clique. */
const DESC_FIRST: SortKey[] = ['sessions', 'goals', 'assists', 'saves', 'clearances', 'cleanSheets', 'avgRating', 'morale'];

export default function ElencoTab({ scope }: { scope: TrainingScope }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'position', dir: 'asc' });

  function toggleSort(key: SortKey) {
    setSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: DESC_FIRST.includes(key) ? 'desc' : 'asc' },
    );
  }

  const header = (key: SortKey, label: string) => (
    <th
      aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" className={styles.sortBtn} onClick={() => toggleSort(key)}>
        {label}
        <span className={styles.sortArrow}>{sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  );

  const rows = useMemo<Row[]>(() => {
    const real = scope.history.filter(s => !s.placeholder);
    return sortByPosition(scope.players).map(p => {
      let sessions = 0;
      let goals = 0;
      let assists = 0;
      let saves = 0;
      let clearances = 0;
      let cleanSheets = 0;
      const ratings: number[] = [];
      for (const s of real) {
        const played =
          [...s.teams.a.lineup, ...s.teams.b.lineup].some(l => l.playerId === p.id) ||
          (s.teams.a.substitutes ?? []).includes(p.id) ||
          (s.teams.b.substitutes ?? []).includes(p.id);
        if (!played) continue;
        sessions += 1;
        goals += s.playerStats[p.id]?.goals ?? 0;
        assists += s.playerStats[p.id]?.assists ?? 0;
        saves += s.playerStats[p.id]?.saves ?? 0;
        clearances += s.playerStats[p.id]?.clearances ?? 0;
        if (s.playerStats[p.id]?.cleanSheet) cleanSheets += 1;
        if (s.ratings[p.id] !== undefined) ratings.push(s.ratings[p.id]);
      }
      return {
        id: p.id,
        name: p.name,
        position: p.position,
        trait: p.trait,
        morale: p.morale,
        sessions,
        goals,
        assists,
        saves,
        clearances,
        cleanSheets,
        avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      };
    });
  }, [scope.players, scope.history]);

  const sorted = useMemo(() => {
    if (sort.key === 'position') return sort.dir === 'asc' ? rows : [...rows].reverse();
    const sign = sort.dir === 'asc' ? 1 : -1;
    const value = (r: Row): number | string => {
      if (sort.key === 'name') return r.name;
      // sem nota ainda: vai para o fim em qualquer ordem
      if (sort.key === 'avgRating') return r.avgRating ?? (sort.dir === 'asc' ? Infinity : -Infinity);
      return r[sort.key];
    };
    return [...rows].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = typeof va === 'string' ? va.localeCompare(String(vb)) : (va as number) - (vb as number);
      return cmp * sign || a.name.localeCompare(b.name);
    });
  }, [rows, sort]);

  return (
    <div className={`${styles.tabBody} ${styles.tableWrap}`}>
      <table className={styles.table}>
        <thead>
          <tr>
            {header('name', 'Jogador')}
            {header('position', 'Pos')}
            <th>Característica</th>
            {header('sessions', 'Treinos')}
            {header('goals', 'Gols')}
            {header('assists', 'Assist.')}
            {header('saves', 'Defesas')}
            {header('clearances', 'Cortes')}
            {header('cleanSheets', 'Sem sofrer gol')}
            {header('avgRating', 'Nota média')}
            {scope.kind === 'club' && header('morale', 'Moral')}
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{posAbbr(r.position)}</td>
              <td>
                <select
                  className={styles.select}
                  aria-label={`Característica de ${r.name}`}
                  title={findTrait(r.trait, r.position)?.description ?? 'Perfil neutro dentro da posição'}
                  value={findTrait(r.trait, r.position)?.key ?? ''}
                  onChange={e => scope.setTrait(r.id, e.target.value || undefined)}
                >
                  <option value="">Padrão</option>
                  {traitsFor(r.position).map(t => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </td>
              <td>{r.sessions}</td>
              <td>{r.goals}</td>
              <td>{r.assists}</td>
              <td>{r.saves}</td>
              <td>{r.clearances}</td>
              <td>{r.cleanSheets}</td>
              <td>{r.avgRating !== null ? r.avgRating.toFixed(1) : '—'}</td>
              {scope.kind === 'club' && <td>{r.morale}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
