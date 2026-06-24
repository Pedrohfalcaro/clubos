import { useGame } from '../../context/GameContext';
import type { StandingsEntry } from '../../types/Competition';
import styles from './Competitions.module.css';

export default function Competitions() {
  const { state } = useGame();
  const { matches, players, team } = state;

  const standings: StandingsEntry[] = [];
  const opponentMap: Record<string, StandingsEntry> = {};

  if (team) {
    const myEntry: StandingsEntry = {
      teamName: team.name,
      matches: team.statistics.matches,
      wins: team.statistics.wins,
      draws: team.statistics.draws,
      losses: team.statistics.losses,
      goalsFor: team.statistics.goalsFor,
      goalsAgainst: team.statistics.goalsAgainst,
      goalDifference: team.statistics.goalsFor - team.statistics.goalsAgainst,
      points: team.statistics.points,
    };
    standings.push(myEntry);
  }

  const completedMatches = matches.filter(m => m.status === 'completed');

  completedMatches.forEach(match => {
    const oppGoalsFor = match.goalsAgainst;
    const oppGoalsAgainst = match.goalsFor;
    const oppResult = match.result === 'win' ? 'loss' : match.result === 'loss' ? 'win' : 'draw';

    if (!opponentMap[match.opponent]) {
      opponentMap[match.opponent] = {
        teamName: match.opponent,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      };
    }
    const e = opponentMap[match.opponent];
    e.matches += 1;
    e.goalsFor += oppGoalsFor;
    e.goalsAgainst += oppGoalsAgainst;
    if (oppResult === 'win') { e.wins += 1; e.points += 3; }
    else if (oppResult === 'draw') { e.draws += 1; e.points += 1; }
    else e.losses += 1;
    e.goalDifference = e.goalsFor - e.goalsAgainst;
  });

  standings.push(...Object.values(opponentMap));
  standings.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);

  const scorers = players
    .filter(p => p.stats.goals > 0)
    .sort((a, b) => b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists)
    .slice(0, 20);

  const assists = players
    .filter(p => p.stats.assists > 0)
    .sort((a, b) => b.stats.assists - a.stats.assists)
    .slice(0, 10);

  const myTeamName = team?.name ?? '';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Competições</h1>
        <p className={styles.sub}>Tabela e estatísticas</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Classificação</h2>
        {standings.length === 0 ? (
          <div className={styles.empty}>Nenhuma partida registrada ainda.</div>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span className={styles.colPos}>#</span>
              <span className={styles.colTeam}>Clube</span>
              <span className={styles.colNum}>J</span>
              <span className={styles.colNum}>V</span>
              <span className={styles.colNum}>E</span>
              <span className={styles.colNum}>D</span>
              <span className={styles.colNum}>GP</span>
              <span className={styles.colNum}>GC</span>
              <span className={styles.colNum}>SG</span>
              <span className={styles.colPts}>Pts</span>
            </div>
            {standings.map((entry, i) => {
              const isMyTeam = entry.teamName === myTeamName;
              return (
                <div key={entry.teamName} className={`${styles.tableRow} ${isMyTeam ? styles.myRow : ''}`}>
                  <span className={styles.colPos}>{i + 1}</span>
                  <span className={styles.colTeam}>{entry.teamName}</span>
                  <span className={styles.colNum}>{entry.matches}</span>
                  <span className={styles.colNum}>{entry.wins}</span>
                  <span className={styles.colNum}>{entry.draws}</span>
                  <span className={styles.colNum}>{entry.losses}</span>
                  <span className={styles.colNum}>{entry.goalsFor}</span>
                  <span className={styles.colNum}>{entry.goalsAgainst}</span>
                  <span className={styles.colNum}>{entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}</span>
                  <span className={styles.colPts}>{entry.points}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className={styles.twoCol}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Artilharia</h2>
          {scorers.length === 0 ? (
            <div className={styles.empty}>Nenhum gol registrado.</div>
          ) : (
            <div className={styles.table}>
              <div className={styles.tableHead}>
                <span className={styles.colPos}>#</span>
                <span className={styles.colTeam}>Jogador</span>
                <span className={styles.colNum}>J</span>
                <span className={styles.colPts}>G</span>
              </div>
              {scorers.map((p, i) => (
                <div key={p.id} className={styles.tableRow}>
                  <span className={styles.colPos}>{i + 1}</span>
                  <span className={styles.colTeam}>{p.name}</span>
                  <span className={styles.colNum}>{p.stats.matches}</span>
                  <span className={styles.colPts}>{p.stats.goals}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Assistências</h2>
          {assists.length === 0 ? (
            <div className={styles.empty}>Nenhuma assistência registrada.</div>
          ) : (
            <div className={styles.table}>
              <div className={styles.tableHead}>
                <span className={styles.colPos}>#</span>
                <span className={styles.colTeam}>Jogador</span>
                <span className={styles.colNum}>J</span>
                <span className={styles.colPts}>A</span>
              </div>
              {assists.map((p, i) => (
                <div key={p.id} className={styles.tableRow}>
                  <span className={styles.colPos}>{i + 1}</span>
                  <span className={styles.colTeam}>{p.name}</span>
                  <span className={styles.colNum}>{p.stats.matches}</span>
                  <span className={styles.colPts}>{p.stats.assists}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
