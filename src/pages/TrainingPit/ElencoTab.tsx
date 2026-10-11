import { useMemo } from 'react';
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

export default function ElencoTab({ scope }: { scope: TrainingScope }) {

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

  return (
    <div className={`${styles.tabBody} ${styles.tableWrap}`}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Jogador</th>
            <th>Pos</th>
            <th>Característica</th>
            <th>Treinos</th>
            <th>Gols</th>
            <th>Assist.</th>
            <th>Defesas</th>
            <th>Cortes</th>
            <th>Sem sofrer gol</th>
            <th>Nota média</th>
            {scope.kind === 'club' && <th>Moral</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.name}</td>
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
              <td>{r.position}</td>
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
