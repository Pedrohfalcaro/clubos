import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import type {
  CompetitionFormat,
  CompetitionTableRow,
  CompetitionType,
  KnockoutPhase,
  SeasonCompetition,
} from '../../types/Competition';
import {
  COMPETITION_FORMAT_HINTS,
  COMPETITION_FORMAT_LABELS,
  COMPETITION_TYPE_LABELS,
} from '../../types/Competition';
import { COMPETITION_PALETTE, createSeasonCompetition } from '../../utils/competitions';
import {
  advanceKnockoutPhase,
  createEmptyTableRow,
  createInitialKnockoutPhase,
  defaultFormatForType,
  hasKnockoutStage,
  hasLeagueStage,
  leagueTablesEqual,
  rowGoalDiff,
  rowPoints,
  syncLeagueTable,
} from '../../utils/competitionEngine';
import { formatMoney, newLedgerEntry } from '../../utils/finance';
import styles from './Competitions.module.css';

const TYPES: CompetitionType[] = ['league', 'cup', 'continental', 'state', 'friendly', 'other'];
const FORMATS: CompetitionFormat[] = ['league', 'knockout', 'league_knockout'];

type PrizeFlash = {
  compId: string;
  message: string;
  amount: number;
  kind: 'ok' | 'warn';
};

type ScorerRow = { name: string; goals: number; assists: number };

function buildCompScorers(
  matches: { status: string; competition: string; season?: number; goals: { playerName: string; isOwnGoal?: boolean }[]; assists: { playerName: string }[] }[],
  competitionName: string,
  season: number,
): { scorers: ScorerRow[]; assists: ScorerRow[] } {
  const map = new Map<string, ScorerRow>();
  for (const m of matches) {
    if (m.status !== 'completed' || m.competition !== competitionName) continue;
    if (m.season != null && m.season !== season) continue;
    for (const g of m.goals) {
      if (g.isOwnGoal) continue;
      const cur = map.get(g.playerName) ?? { name: g.playerName, goals: 0, assists: 0 };
      cur.goals += 1;
      map.set(g.playerName, cur);
    }
    for (const a of m.assists) {
      const cur = map.get(a.playerName) ?? { name: a.playerName, goals: 0, assists: 0 };
      cur.assists += 1;
      map.set(a.playerName, cur);
    }
  }
  const all = [...map.values()];
  return {
    scorers: all.filter(r => r.goals > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 8),
    assists: all.filter(r => r.assists > 0).sort((a, b) => b.assists - a.assists || b.goals - a.goals).slice(0, 8),
  };
}

export default function Competitions() {
  const { state, addCompetition, updateCompetition, removeCompetition, applyLedger } = useGame();
  const { matches, team, seasonCompetitions, season, finance } = state;
  const myTeamName = team?.name ?? 'Meu clube';

  const [showAdd, setShowAdd] = useState(false);
  const [editingMetaId, setEditingMetaId] = useState<string | null>(null);
  const [flash, setFlash] = useState<PrizeFlash | null>(null);
  const [phaseError, setPhaseError] = useState<Record<string, string>>({});
  const [finalFlags, setFinalFlags] = useState<Record<string, boolean>>({});

  const [addForm, setAddForm] = useState({
    name: '',
    color: COMPETITION_PALETTE[0],
    type: 'league' as CompetitionType,
    format: 'league' as CompetitionFormat,
    shortName: '',
  });

  const matchCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of matches) {
      map.set(m.competition, (map.get(m.competition) ?? 0) + 1);
    }
    return map;
  }, [matches]);

  // Auto-sync league tables from matches (adversários novos entram sozinhos)
  const leagueSyncKey = useMemo(
    () =>
      [
        team?.name ?? '',
        String(season),
        matches
          .filter(m => m.status === 'completed')
          .map(m => `${m.id}:${m.competition}:${m.goalsFor}-${m.goalsAgainst}:${m.result}`)
          .join('|'),
        seasonCompetitions.map(c => `${c.id}:${c.name}:${c.format ?? ''}`).join(';'),
      ].join('::'),
    [team?.name, season, matches, seasonCompetitions],
  );

  useEffect(() => {
    if (!team) return;
    for (const comp of seasonCompetitions) {
      if (!hasLeagueStage(comp.format ?? defaultFormatForType(comp.type))) continue;
      const synced = syncLeagueTable(
        comp.leagueTable,
        team.name,
        matches,
        comp.name,
        season,
      );
      if (!leagueTablesEqual(comp.leagueTable, synced)) {
        updateCompetition(comp.id, { leagueTable: synced });
      }
    }
    // syncKey encapsula matches + comps relevantes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueSyncKey]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 5000);
    return () => window.clearTimeout(t);
  }, [flash]);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim()) return;
    addCompetition(
      createSeasonCompetition(addForm.name.trim(), {
        color: addForm.color,
        type: addForm.type,
        format: addForm.format,
        shortName: addForm.shortName.trim() || undefined,
        leagueTable: hasLeagueStage(addForm.format)
          ? [createEmptyTableRow(myTeamName, true)]
          : undefined,
        knockoutPhases:
          addForm.format === 'knockout' ? [createInitialKnockoutPhase()] : undefined,
      }),
    );
    setAddForm({
      name: '',
      color: COMPETITION_PALETTE[5],
      type: 'league',
      format: 'league',
      shortName: '',
    });
    setShowAdd(false);
  }

  function patchComp(comp: SeasonCompetition, updates: Partial<Omit<SeasonCompetition, 'id'>>) {
    updateCompetition(comp.id, updates);
  }

  function updateTableRow(
    comp: SeasonCompetition,
    rowId: string,
    field: keyof CompetitionTableRow,
    raw: string,
  ) {
    const table = [...(comp.leagueTable ?? [])];
    const idx = table.findIndex(r => r.id === rowId);
    if (idx < 0) return;
    const row = { ...table[idx], locked: true };

    if (field === 'teamName') {
      row.teamName = raw;
    } else if (
      field === 'matches' ||
      field === 'wins' ||
      field === 'draws' ||
      field === 'losses' ||
      field === 'goalsFor' ||
      field === 'goalsAgainst'
    ) {
      const n = Math.max(0, parseInt(raw.replace(/\D/g, ''), 10) || 0);
      row[field] = n;
      if (field === 'wins' || field === 'draws' || field === 'losses') {
        row.matches = row.wins + row.draws + row.losses;
      }
    }
    table[idx] = row;
    patchComp(comp, { leagueTable: table });
  }

  function addTableTeam(comp: SeasonCompetition) {
    const table = [...(comp.leagueTable ?? []), createEmptyTableRow('Novo time')];
    patchComp(comp, { leagueTable: table });
  }

  function removeTableTeam(comp: SeasonCompetition, rowId: string) {
    const table = (comp.leagueTable ?? []).filter(r => r.id !== rowId || r.isUserTeam);
    patchComp(comp, { leagueTable: table });
  }

  function updatePhase(
    comp: SeasonCompetition,
    phaseId: string,
    patch: Partial<KnockoutPhase>,
  ) {
    const phases = (comp.knockoutPhases ?? []).map(p =>
      p.id === phaseId ? { ...p, ...patch } : p,
    );
    patchComp(comp, { knockoutPhases: phases });
    setPhaseError(prev => ({ ...prev, [comp.id]: '' }));
  }

  function startKnockout(comp: SeasonCompetition) {
    patchComp(comp, {
      knockoutStarted: true,
      knockoutPhases:
        comp.knockoutPhases && comp.knockoutPhases.length > 0
          ? comp.knockoutPhases
          : [createInitialKnockoutPhase()],
    });
  }

  function handleAdvance(comp: SeasonCompetition, markAsFinal: boolean) {
    const prizes = finance.prizeTable[comp.name] ?? {};
    const result = advanceKnockoutPhase(comp.knockoutPhases ?? [], prizes, { markAsFinal });
    if ('error' in result) {
      setPhaseError(prev => ({ ...prev, [comp.id]: result.error }));
      return;
    }

    patchComp(comp, { knockoutPhases: result.phases });
    setPhaseError(prev => ({ ...prev, [comp.id]: '' }));
    setFinalFlags(prev => ({ ...prev, [comp.id]: false }));

    if (result.prizeAmount > 0) {
      const label =
        result.prizeKind === 'champion'
          ? `Premiação campeão · ${comp.name}`
          : `Premiação eliminatória · ${comp.name}`;
      applyLedger(
        newLedgerEntry(
          'prize',
          result.prizeAmount,
          label,
          season,
          undefined,
          state.currentDate ?? undefined,
        ),
      );
    }

    setFlash({
      compId: comp.id,
      message: result.message,
      amount: result.prizeAmount,
      kind: result.eliminated ? 'warn' : 'ok',
    });
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Temporada {season}</p>
          <h1 className={styles.title}>Competições</h1>
          <p className={styles.sub}>
            Cada torneio tem sua seção: dados editáveis, tabela de pontos e mata-mata com premiação ao avançar.
          </p>
        </div>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => {
            setShowAdd(v => !v);
            setEditingMetaId(null);
          }}
        >
          {showAdd ? 'Fechar' : '+ Nova competição'}
        </button>
      </header>

      {showAdd && (
        <form className={styles.addForm} onSubmit={handleAdd}>
          <h3 className={styles.addTitle}>Nova competição</h3>
          <div className={styles.formGrid}>
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
          </div>
          <select
            className={styles.select}
            value={addForm.type}
            onChange={e => {
              const type = e.target.value as CompetitionType;
              setAddForm(f => ({ ...f, type, format: defaultFormatForType(type) }));
            }}
          >
            {TYPES.map(t => (
              <option key={t} value={t}>{COMPETITION_TYPE_LABELS[t]}</option>
            ))}
          </select>

          <div className={styles.formatGrid}>
            {FORMATS.map(fmt => (
              <button
                key={fmt}
                type="button"
                className={`${styles.formatOption} ${addForm.format === fmt ? styles.formatActive : ''}`}
                onClick={() => setAddForm(f => ({ ...f, format: fmt }))}
              >
                <strong>{COMPETITION_FORMAT_LABELS[fmt]}</strong>
                <span>{COMPETITION_FORMAT_HINTS[fmt]}</span>
              </button>
            ))}
          </div>

          <div className={styles.colorRow}>
            {COMPETITION_PALETTE.map(c => (
              <button
                key={c}
                type="button"
                className={`${styles.swatch} ${addForm.color === c ? styles.swatchActive : ''}`}
                style={{ background: c }}
                onClick={() => setAddForm(f => ({ ...f, color: c }))}
                aria-label={c}
              />
            ))}
            <input
              type="color"
              value={addForm.color}
              onChange={e => setAddForm(f => ({ ...f, color: e.target.value }))}
              className={styles.colorPicker}
            />
          </div>

          <div className={styles.formActions}>
            <button type="button" className={styles.ghostBtn} onClick={() => setShowAdd(false)}>
              Cancelar
            </button>
            <button type="submit" className={styles.primaryBtn}>Adicionar</button>
          </div>
        </form>
      )}

      {seasonCompetitions.map(comp => {
        const format = comp.format ?? defaultFormatForType(comp.type);
        const showLeague = hasLeagueStage(format);
        const showKnockout =
          hasKnockoutStage(format) &&
          (format === 'knockout' || !!comp.knockoutStarted);
        const table = sortLocal(comp.leagueTable ?? []);
        const prizes = finance.prizeTable[comp.name];
        const { scorers, assists } = buildCompScorers(matches, comp.name, season);
        const phases = comp.knockoutPhases ?? [];
        const currentPhase = phases.find(p => !p.advanced);
        const competitionOver =
          phases.some(p => p.advanced && p.outcome === 'lost') ||
          phases.some(p => p.advanced && p.isFinal && p.outcome === 'won');

        return (
          <section
            key={comp.id}
            className={styles.compSection}
            style={{ ['--comp-color' as string]: comp.color }}
          >
            <div className={styles.compHeader}>
              <div className={styles.compIdentity}>
                <div className={styles.compStripe} />
                <div className={styles.compTitles}>
                  <h2 className={styles.compName}>{comp.name}</h2>
                  <div className={styles.compMeta}>
                    <span className={styles.badge}>{COMPETITION_TYPE_LABELS[comp.type]}</span>
                    <span className={`${styles.badge} ${styles.badgeAccent}`}>
                      {COMPETITION_FORMAT_LABELS[format]}
                    </span>
                    {comp.shortName && <span className={styles.badge}>{comp.shortName}</span>}
                    <span className={styles.badge}>
                      {matchCounts.get(comp.name) ?? 0} jogos
                    </span>
                  </div>
                </div>
              </div>
              <div className={styles.compActions}>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() =>
                    setEditingMetaId(id => (id === comp.id ? null : comp.id))
                  }
                >
                  {editingMetaId === comp.id ? 'Fechar dados' : 'Editar dados'}
                </button>
                <button
                  type="button"
                  className={styles.dangerBtn}
                  disabled={seasonCompetitions.length <= 1}
                  onClick={() => removeCompetition(comp.id)}
                >
                  Remover
                </button>
              </div>
            </div>

            <div className={styles.compBody}>
              {editingMetaId === comp.id && (
                <div className={styles.block}>
                  <h3 className={styles.blockTitle}>Dados da competição</h3>
                  <div className={styles.metaGrid}>
                    <div className={styles.field}>
                      <label>Nome</label>
                      <input
                        className={styles.input}
                        value={comp.name}
                        onChange={e => patchComp(comp, { name: e.target.value })}
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Sigla</label>
                      <input
                        className={styles.input}
                        value={comp.shortName ?? ''}
                        onChange={e =>
                          patchComp(comp, { shortName: e.target.value.trim() || undefined })
                        }
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Tipo</label>
                      <select
                        className={styles.select}
                        value={comp.type}
                        onChange={e => {
                          const type = e.target.value as CompetitionType;
                          patchComp(comp, { type });
                        }}
                      >
                        {TYPES.map(t => (
                          <option key={t} value={t}>{COMPETITION_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className={styles.formatGrid}>
                    {FORMATS.map(fmt => (
                      <button
                        key={fmt}
                        type="button"
                        className={`${styles.formatOption} ${format === fmt ? styles.formatActive : ''}`}
                        onClick={() => {
                          const updates: Partial<Omit<SeasonCompetition, 'id'>> = { format: fmt };
                          if (hasLeagueStage(fmt) && !(comp.leagueTable?.length)) {
                            updates.leagueTable = [createEmptyTableRow(myTeamName, true)];
                          }
                          if (fmt === 'knockout' && !(comp.knockoutPhases?.length)) {
                            updates.knockoutPhases = [createInitialKnockoutPhase()];
                          }
                          if (fmt === 'league') {
                            updates.knockoutStarted = false;
                          }
                          patchComp(comp, updates);
                        }}
                      >
                        <strong>{COMPETITION_FORMAT_LABELS[fmt]}</strong>
                        <span>{COMPETITION_FORMAT_HINTS[fmt]}</span>
                      </button>
                    ))}
                  </div>
                  <div className={styles.colorRow}>
                    {COMPETITION_PALETTE.map(c => (
                      <button
                        key={c}
                        type="button"
                        className={`${styles.swatch} ${comp.color === c ? styles.swatchActive : ''}`}
                        style={{ background: c }}
                        onClick={() => patchComp(comp, { color: c })}
                      />
                    ))}
                    <input
                      type="color"
                      value={comp.color}
                      onChange={e => patchComp(comp, { color: e.target.value })}
                      className={styles.colorPicker}
                    />
                  </div>
                </div>
              )}

              {prizes && (
                <div className={styles.block}>
                  <h3 className={styles.blockTitle}>Premiação (Finanças)</h3>
                  <div className={styles.prizeStrip}>
                    <div className={styles.prizeChip}>
                      <span>Vitória</span>
                      <strong>{formatMoney(prizes.win ?? 0, finance.currency)}</strong>
                    </div>
                    <div className={styles.prizeChip}>
                      <span>Empate</span>
                      <strong>{formatMoney(prizes.draw ?? 0, finance.currency)}</strong>
                    </div>
                    <div className={styles.prizeChip}>
                      <span>Eliminatória</span>
                      <strong>{formatMoney(prizes.knockout ?? 0, finance.currency)}</strong>
                    </div>
                    <div className={styles.prizeChip}>
                      <span>Campeão</span>
                      <strong>{formatMoney(prizes.champion ?? 0, finance.currency)}</strong>
                    </div>
                  </div>
                </div>
              )}

              {flash?.compId === comp.id && (
                <div
                  className={`${styles.prizeBox} ${flash.kind === 'warn' ? styles.prizeBoxWarn : ''}`}
                >
                  <div className={styles.prizeBoxText}>
                    <strong>{flash.message}</strong>
                    <span>Registrado no extrato financeiro</span>
                  </div>
                  {flash.amount > 0 && (
                    <div className={styles.prizeBoxAmount}>
                      +{formatMoney(flash.amount, finance.currency)}
                    </div>
                  )}
                </div>
              )}

              {showLeague && (
                <div className={styles.block}>
                  <div className={styles.blockHead}>
                    <div>
                      <h3 className={styles.blockTitle}>
                        {format === 'league_knockout' ? 'Fase de liga / grupos' : 'Classificação'}
                      </h3>
                      <p className={styles.blockHint}>
                        A tabela cresce com os adversários dos seus jogos. Edite qualquer célula para ajustar.
                      </p>
                    </div>
                    <div className={styles.tableToolbar}>
                      <button
                        type="button"
                        className={styles.softBtn}
                        onClick={() => addTableTeam(comp)}
                      >
                        + Time
                      </button>
                    </div>
                  </div>

                  {table.length === 0 ? (
                    <div className={styles.emptyInline}>
                      Jogue partidas nesta competição ou adicione times manualmente.
                    </div>
                  ) : (
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Clube</th>
                            <th>J</th>
                            <th>V</th>
                            <th>E</th>
                            <th>D</th>
                            <th>GP</th>
                            <th>GC</th>
                            <th>SG</th>
                            <th>Pts</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {table.map((row, i) => (
                            <tr
                              key={row.id}
                              className={row.isUserTeam || row.teamName === myTeamName ? styles.myRow : undefined}
                            >
                              <td className={styles.posCell}>{i + 1}</td>
                              <td className={styles.teamCell}>
                                <input
                                  className={styles.cellInput}
                                  value={row.teamName}
                                  onChange={e =>
                                    updateTableRow(comp, row.id, 'teamName', e.target.value)
                                  }
                                />
                              </td>
                              {(
                                [
                                  ['matches', 'J'],
                                  ['wins', 'V'],
                                  ['draws', 'E'],
                                  ['losses', 'D'],
                                  ['goalsFor', 'GP'],
                                  ['goalsAgainst', 'GC'],
                                ] as const
                              ).map(([field]) => (
                                <td key={field}>
                                  <input
                                    className={`${styles.cellInput} ${styles.numInput}`}
                                    value={row[field]}
                                    onChange={e =>
                                      updateTableRow(comp, row.id, field, e.target.value)
                                    }
                                  />
                                </td>
                              ))}
                              <td>{rowGoalDiff(row)}</td>
                              <td className={styles.ptsCell}>{rowPoints(row)}</td>
                              <td className={styles.rowActions}>
                                <button
                                  type="button"
                                  className={styles.iconBtn}
                                  disabled={!!row.isUserTeam}
                                  title="Remover time"
                                  onClick={() => removeTableTeam(comp, row.id)}
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {format === 'league_knockout' && !comp.knockoutStarted && (
                <div className={styles.block}>
                  <h3 className={styles.blockTitle}>Mata-mata</h3>
                  <p className={styles.blockHint}>
                    Quando a fase de grupos/liga terminar, inicie o chaveamento eliminatório.
                  </p>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => startKnockout(comp)}
                  >
                    Iniciar mata-mata
                  </button>
                </div>
              )}

              {showKnockout && (
                <div className={styles.block}>
                  <h3 className={styles.blockTitle}>Mata-mata</h3>
                  <p className={styles.blockHint}>
                    Preencha adversário e placar. Ao avançar, a próxima fase é criada e a premiação de eliminatória cai no caixa.
                    Marque “Esta é a final” na última fase para receber a premiação de campeão.
                  </p>

                  <div className={styles.phaseList}>
                    {phases.map(phase => {
                      const isCurrent = !phase.advanced && phase.id === currentPhase?.id;
                      const done = phase.advanced;
                      return (
                        <div
                          key={phase.id}
                          className={`${styles.phaseCard} ${isCurrent ? styles.phaseCurrent : ''} ${done ? styles.phaseDone : ''}`}
                        >
                          <div className={styles.phaseTop}>
                            <input
                              className={`${styles.input} ${styles.phaseNameInput}`}
                              value={phase.name}
                              disabled={done}
                              onChange={e =>
                                updatePhase(comp, phase.id, { name: e.target.value })
                              }
                              placeholder="Nome da fase"
                            />
                            <span
                              className={`${styles.phaseStatus} ${
                                phase.outcome === 'won'
                                  ? styles.phaseWon
                                  : phase.outcome === 'lost'
                                    ? styles.phaseLost
                                    : ''
                              }`}
                            >
                              {done
                                ? phase.outcome === 'won'
                                  ? phase.isFinal
                                    ? 'Campeão'
                                    : 'Classificado'
                                  : 'Eliminado'
                                : isCurrent
                                  ? 'Fase atual'
                                  : 'Aguardando'}
                              {phase.isFinal && !done ? ' · Final' : ''}
                            </span>
                          </div>

                          <div className={styles.phaseFields}>
                            <div className={styles.field}>
                              <label>Adversário</label>
                              <input
                                className={styles.input}
                                value={phase.opponent}
                                disabled={done}
                                onChange={e =>
                                  updatePhase(comp, phase.id, { opponent: e.target.value })
                                }
                                placeholder="Nome do adversário"
                              />
                            </div>
                            <div className={styles.scoreBox}>
                              <label>Nós</label>
                              <input
                                className={`${styles.input} ${styles.scoreInput}`}
                                type="number"
                                min={0}
                                disabled={done}
                                value={phase.goalsFor ?? ''}
                                onChange={e =>
                                  updatePhase(comp, phase.id, {
                                    goalsFor:
                                      e.target.value === ''
                                        ? null
                                        : Math.max(0, parseInt(e.target.value, 10) || 0),
                                  })
                                }
                              />
                            </div>
                            <div className={styles.scoreBox}>
                              <label>Eles</label>
                              <input
                                className={`${styles.input} ${styles.scoreInput}`}
                                type="number"
                                min={0}
                                disabled={done}
                                value={phase.goalsAgainst ?? ''}
                                onChange={e =>
                                  updatePhase(comp, phase.id, {
                                    goalsAgainst:
                                      e.target.value === ''
                                        ? null
                                        : Math.max(0, parseInt(e.target.value, 10) || 0),
                                  })
                                }
                              />
                            </div>
                          </div>

                          {phase.prizeReceived != null && phase.prizeReceived > 0 && (
                            <div className={styles.prizeBox}>
                              <div className={styles.prizeBoxText}>
                                <strong>Premiação desta fase</strong>
                                <span>Já creditada no caixa</span>
                              </div>
                              <div className={styles.prizeBoxAmount}>
                                +{formatMoney(phase.prizeReceived, finance.currency)}
                              </div>
                            </div>
                          )}

                          {isCurrent && !competitionOver && (
                            <div className={styles.phaseActions}>
                              <label className={styles.finalCheck}>
                                <input
                                  type="checkbox"
                                  checked={!!finalFlags[comp.id] || phase.isFinal}
                                  onChange={e =>
                                    setFinalFlags(prev => ({
                                      ...prev,
                                      [comp.id]: e.target.checked,
                                    }))
                                  }
                                />
                                Esta é a final
                              </label>
                              <button
                                type="button"
                                className={styles.primaryBtn}
                                onClick={() =>
                                  handleAdvance(comp, !!(finalFlags[comp.id] || phase.isFinal))
                                }
                              >
                                {finalFlags[comp.id] || phase.isFinal
                                  ? 'Confirmar final'
                                  : 'Avançar de fase'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {phaseError[comp.id] && (
                    <p className={styles.errorMsg}>{phaseError[comp.id]}</p>
                  )}
                </div>
              )}

              {(scorers.length > 0 || assists.length > 0) && (
                <div className={styles.statsMini}>
                  {scorers.length > 0 && (
                    <div className={styles.block}>
                      <h3 className={styles.blockTitle}>Artilharia</h3>
                      <div className={styles.scorerList}>
                        {scorers.map((s, i) => (
                          <div key={s.name} className={styles.scorerRow}>
                            <span className={styles.scorerPos}>{i + 1}</span>
                            <span className={styles.scorerName}>{s.name}</span>
                            <span className={styles.scorerStat}>{s.goals}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {assists.length > 0 && (
                    <div className={styles.block}>
                      <h3 className={styles.blockTitle}>Assistências</h3>
                      <div className={styles.scorerList}>
                        {assists.map((s, i) => (
                          <div key={s.name} className={styles.scorerRow}>
                            <span className={styles.scorerPos}>{i + 1}</span>
                            <span className={styles.scorerName}>{s.name}</span>
                            <span className={styles.scorerStat}>{s.assists}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function sortLocal(rows: CompetitionTableRow[]): CompetitionTableRow[] {
  return [...rows].sort(
    (a, b) =>
      rowPoints(b) - rowPoints(a) ||
      rowGoalDiff(b) - rowGoalDiff(a) ||
      b.goalsFor - a.goalsFor ||
      a.teamName.localeCompare(b.teamName, 'pt-BR'),
  );
}
