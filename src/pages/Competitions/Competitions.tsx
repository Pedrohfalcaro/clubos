import { useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import type { CompetitionType, SeasonCompetition } from '../../types/Competition';
import { COMPETITION_TYPE_LABELS } from '../../types/Competition';
import { COMPETITION_PALETTE, createSeasonCompetition } from '../../utils/competitions';
import type { StandingsEntry } from '../../types/Competition';
import styles from './Competitions.module.css';

const TYPES: CompetitionType[] = ['league', 'cup', 'continental', 'state', 'friendly', 'other'];

export default function Competitions() {
  const { state, addCompetition, updateCompetition, removeCompetition } = useGame();
  const { matches, players, team, seasonCompetitions } = state;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', color: COMPETITION_PALETTE[0], type: 'league' as CompetitionType, shortName: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    color: COMPETITION_PALETTE[5],
    type: 'league' as CompetitionType,
    shortName: '',
  });

  const matchCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of matches) {
      map.set(m.competition, (map.get(m.competition) ?? 0) + 1);
    }
    return map;
  }, [matches]);

  function startEdit(comp: SeasonCompetition) {
    setEditingId(comp.id);
    setForm({
      name: comp.name,
      color: comp.color,
      type: comp.type,
      shortName: comp.shortName ?? '',
    });
    setShowAdd(false);
  }

  function saveEdit() {
    if (!editingId || !form.name.trim()) return;
    updateCompetition(editingId, {
      name: form.name.trim(),
      color: form.color,
      type: form.type,
      shortName: form.shortName.trim() || undefined,
    });
    setEditingId(null);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim()) return;
    addCompetition(
      createSeasonCompetition(addForm.name.trim(), {
        color: addForm.color,
        type: addForm.type,
        shortName: addForm.shortName.trim() || undefined,
      }),
    );
    setAddForm({ name: '', color: COMPETITION_PALETTE[5], type: 'league', shortName: '' });
    setShowAdd(false);
  }

  const standings: StandingsEntry[] = [];
  const opponentMap: Record<string, StandingsEntry> = {};

  if (team) {
    standings.push({
      teamName: team.name,
      matches: team.statistics.matches,
      wins: team.statistics.wins,
      draws: team.statistics.draws,
      losses: team.statistics.losses,
      goalsFor: team.statistics.goalsFor,
      goalsAgainst: team.statistics.goalsAgainst,
      goalDifference: team.statistics.goalsFor - team.statistics.goalsAgainst,
      points: team.statistics.points,
    });
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
    if (oppResult === 'win') {
      e.wins += 1;
      e.points += 3;
    } else if (oppResult === 'draw') {
      e.draws += 1;
      e.points += 1;
    } else e.losses += 1;
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
        <div>
          <h1 className={styles.title}>Competições</h1>
          <p className={styles.sub}>Gerencie nomes, cores do calendário e veja a tabela</p>
        </div>
        <button type="button" className={styles.addBtn} onClick={() => { setShowAdd(true); setEditingId(null); }}>
          + Nova competição
        </button>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Temporada {state.season}</h2>
        <div className={styles.compList}>
          {seasonCompetitions.map(comp => {
            const isEditing = editingId === comp.id;
            return (
              <div key={comp.id} className={styles.compCard}>
                {isEditing ? (
                  <div className={styles.editForm}>
                    <input
                      className={styles.input}
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Nome"
                    />
                    <input
                      className={styles.input}
                      value={form.shortName}
                      onChange={e => setForm(f => ({ ...f, shortName: e.target.value }))}
                      placeholder="Sigla (opcional)"
                    />
                    <select
                      className={styles.input}
                      value={form.type}
                      onChange={e => setForm(f => ({ ...f, type: e.target.value as CompetitionType }))}
                    >
                      {TYPES.map(t => (
                        <option key={t} value={t}>{COMPETITION_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                    <div className={styles.colorRow}>
                      {COMPETITION_PALETTE.map(c => (
                        <button
                          key={c}
                          type="button"
                          className={`${styles.swatch} ${form.color === c ? styles.swatchActive : ''}`}
                          style={{ background: c }}
                          onClick={() => setForm(f => ({ ...f, color: c }))}
                          aria-label={c}
                        />
                      ))}
                      <input
                        type="color"
                        value={form.color}
                        onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                        className={styles.colorPicker}
                      />
                    </div>
                    <div className={styles.editActions}>
                      <button type="button" className={styles.ghostBtn} onClick={() => setEditingId(null)}>Cancelar</button>
                      <button type="button" className={styles.primaryBtn} onClick={saveEdit}>Salvar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className={styles.compDot} style={{ background: comp.color }} />
                    <div className={styles.compInfo}>
                      <strong>{comp.name}</strong>
                      <span>
                        {COMPETITION_TYPE_LABELS[comp.type]}
                        {comp.shortName ? ` · ${comp.shortName}` : ''}
                        {' · '}
                        {matchCounts.get(comp.name) ?? 0} jogos
                      </span>
                    </div>
                    <div className={styles.compActions}>
                      <button type="button" className={styles.ghostBtn} onClick={() => startEdit(comp)}>Editar</button>
                      <button
                        type="button"
                        className={styles.dangerBtn}
                        disabled={seasonCompetitions.length <= 1}
                        onClick={() => removeCompetition(comp.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {showAdd && (
          <form className={styles.addForm} onSubmit={handleAdd}>
            <h3 className={styles.addTitle}>Nova competição</h3>
            <input
              className={styles.input}
              value={addForm.name}
              onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nome da competição"
              required
            />
            <input
              className={styles.input}
              value={addForm.shortName}
              onChange={e => setAddForm(f => ({ ...f, shortName: e.target.value }))}
              placeholder="Sigla (opcional)"
            />
            <select
              className={styles.input}
              value={addForm.type}
              onChange={e => setAddForm(f => ({ ...f, type: e.target.value as CompetitionType }))}
            >
              {TYPES.map(t => (
                <option key={t} value={t}>{COMPETITION_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <div className={styles.colorRow}>
              {COMPETITION_PALETTE.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.swatch} ${addForm.color === c ? styles.swatchActive : ''}`}
                  style={{ background: c }}
                  onClick={() => setAddForm(f => ({ ...f, color: c }))}
                />
              ))}
              <input
                type="color"
                value={addForm.color}
                onChange={e => setAddForm(f => ({ ...f, color: e.target.value }))}
                className={styles.colorPicker}
              />
            </div>
            <div className={styles.editActions}>
              <button type="button" className={styles.ghostBtn} onClick={() => setShowAdd(false)}>Cancelar</button>
              <button type="submit" className={styles.primaryBtn}>Adicionar</button>
            </div>
          </form>
        )}
      </section>

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
                  <span className={styles.colNum}>{entry.goalDifference}</span>
                  <span className={styles.colPts}>{entry.points}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Artilharia</h2>
        {scorers.length === 0 ? (
          <div className={styles.empty}>Nenhum gol registrado.</div>
        ) : (
          <div className={styles.scorers}>
            {scorers.map((p, i) => (
              <div key={p.id} className={styles.scorerRow}>
                <span className={styles.scorerPos}>{i + 1}</span>
                <span className={styles.scorerName}>{p.name}</span>
                <span className={styles.scorerStat}>{p.stats.goals} G</span>
                <span className={styles.scorerStat}>{p.stats.assists} A</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {assists.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Assistências</h2>
          <div className={styles.scorers}>
            {assists.map((p, i) => (
              <div key={p.id} className={styles.scorerRow}>
                <span className={styles.scorerPos}>{i + 1}</span>
                <span className={styles.scorerName}>{p.name}</span>
                <span className={styles.scorerStat}>{p.stats.assists} A</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
