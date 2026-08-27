import { useMemo, useState } from 'react';
import { useGame } from '../../../context/GameContext';
import SearchableSelect from '../../../components/SearchableSelect/SearchableSelect';
import { sortWindowsByStart } from '../../../utils/nationalWindows';
import { aggregateCallUpOverview, type CallUpOverviewRow } from '../../../utils/nationalStats';
// Reaproveita o CSS da antiga tela de Convocação — mesmo visual da tabela consolidada.
import styles from '../Squad/NationalSquad.module.css';

type OverviewSortKey = 'matches' | 'minutes' | 'goals' | 'assists' | 'avgRating';

function overviewSortValue(row: CallUpOverviewRow, key: OverviewSortKey): number {
  switch (key) {
    case 'matches': return row.matches;
    case 'minutes': return row.minutes;
    case 'goals': return row.goals;
    case 'assists': return row.assists;
    case 'avgRating': return row.avgRating ?? -Infinity;
  }
}

export default function NationalHistory() {
  const { state } = useGame();
  const nationalTeam = state.nationalTeam;
  const [windowId, setWindowId] = useState('');
  const [sortKey, setSortKey] = useState<OverviewSortKey | null>(null);

  const sortedWindows = useMemo(
    () => (nationalTeam ? sortWindowsByStart(nationalTeam.windows) : []),
    [nationalTeam],
  );

  const summary = useMemo(() => {
    if (!nationalTeam) return null;
    const allGames = nationalTeam.windows.flatMap(w => w.games).filter(g => g.played);
    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
    for (const g of allGames) {
      const gf = g.goalsFor ?? 0;
      const ga = g.goalsAgainst ?? 0;
      goalsFor += gf;
      goalsAgainst += ga;
      if (gf > ga) wins += 1;
      else if (gf === ga) draws += 1;
      else losses += 1;
    }
    return { totalWindows: nationalTeam.windows.length, totalGames: allGames.length, wins, draws, losses, goalsFor, goalsAgainst };
  }, [nationalTeam]);

  const rows = useMemo(() => {
    if (!nationalTeam) return [];
    const list = aggregateCallUpOverview(nationalTeam, windowId || null);
    if (!sortKey) return list;
    return [...list].sort((a, b) => overviewSortValue(b, sortKey) - overviewSortValue(a, sortKey));
  }, [nationalTeam, windowId, sortKey]);

  if (!nationalTeam) return null;

  function toggleSort(key: OverviewSortKey) {
    setSortKey(prev => (prev === key ? null : key));
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Sua Gestão</p>
          <h1 className={styles.title}>Histórico</h1>
        </div>
      </header>

      {summary && (
        <div className={styles.windowBar}>
          <span className={styles.listSizeLabel}>
            {summary.totalWindows} Data{summary.totalWindows === 1 ? '' : 's'} FIFA · {summary.totalGames} jogo
            {summary.totalGames === 1 ? '' : 's'}
          </span>
          <span className={styles.counter}>
            {summary.wins}V {summary.draws}E {summary.losses}D · {summary.goalsFor}-{summary.goalsAgainst}
          </span>
        </div>
      )}

      <div className={styles.toolbar}>
        <SearchableSelect
          options={[
            { value: '', label: 'Carreira (todas as convocações)' },
            ...sortedWindows.map(w => ({ value: w.id, label: w.label })),
          ]}
          value={windowId}
          onChange={setWindowId}
        />
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nenhum jogo registrado ainda.</p>
          <p className={styles.emptyHint}>
            Registre o resultado de um jogo numa Data FIFA para ver os agregados aqui.
          </p>
        </div>
      ) : (
        <div className={styles.overviewTableWrap}>
          <table className={styles.overviewTable}>
            <thead>
              <tr>
                <th>Atleta</th>
                <th className={styles.sortableCol} onClick={() => toggleSort('matches')}>
                  J{sortKey === 'matches' ? ' ▾' : ''}
                </th>
                <th className={styles.sortableCol} onClick={() => toggleSort('minutes')}>
                  Min{sortKey === 'minutes' ? ' ▾' : ''}
                </th>
                <th className={styles.sortableCol} onClick={() => toggleSort('goals')}>
                  G{sortKey === 'goals' ? ' ▾' : ''}
                </th>
                <th className={styles.sortableCol} onClick={() => toggleSort('assists')}>
                  A{sortKey === 'assists' ? ' ▾' : ''}
                </th>
                <th className={styles.sortableCol} onClick={() => toggleSort('avgRating')}>
                  Nota{sortKey === 'avgRating' ? ' ▾' : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.nationalPlayerId}>
                  <td className={styles.overviewName}>
                    {row.name}
                    <span className={styles.overviewMeta}>{row.position} · {row.club}</span>
                  </td>
                  <td>{row.matches}</td>
                  <td>{row.minutes}'</td>
                  <td>{row.goals}</td>
                  <td>{row.assists}</td>
                  <td>{row.avgRating != null ? row.avgRating.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
