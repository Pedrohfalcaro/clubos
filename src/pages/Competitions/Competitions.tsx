import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import type {
  CompetitionFormat,
  CompetitionTableRow,
  CompetitionType,
  KnockoutPhase,
  SeasonCompetition,
} from '../../types/Competition';
import { oppositeLocation } from '../../types/Competition';
import {
  COMPETITION_FORMAT_HINTS,
  COMPETITION_FORMAT_LABELS,
  COMPETITION_TYPE_LABELS,
} from '../../types/Competition';
import type { MatchLocation } from '../../types/Match';
import { COMPETITION_PALETTE, createSeasonCompetition } from '../../utils/competitions';
import {
  advanceKnockoutPhase,
  createEmptyTableRow,
  createInitialKnockoutPhase,
  defaultFormatForType,
  eliminateCurrentPhase,
  hasKnockoutStage,
  hasLeagueStage,
  leagueTablesEqual,
  phaseAggregate,
  rowGoalDiff,
  rowPoints,
  syncLeagueTable,
} from '../../utils/competitionEngine';
import { formatMoney, newLedgerEntry } from '../../utils/finance';
import styles from './Competitions.module.css';

const TYPES: CompetitionType[] = ['league', 'cup', 'continental', 'state', 'friendly', 'other'];
const FORMATS: CompetitionFormat[] = ['league', 'knockout', 'league_knockout'];

const LOCATION_LABELS: Record<MatchLocation, string> = {
  home: 'Casa',
  away: 'Fora',
  neutral: 'Neutro',
};

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

function recordFromMatches(
  matches: { status: string; competition: string; season?: number; result: string | null }[],
  competitionName: string,
  season: number,
): { wins: number; draws: number; losses: number } {
  let wins = 0, draws = 0, losses = 0;
  for (const m of matches) {
    if (m.status !== 'completed' || m.competition !== competitionName) continue;
    if (m.season != null && m.season !== season) continue;
    if (m.result === 'win') wins += 1;
    else if (m.result === 'draw') draws += 1;
    else if (m.result === 'loss') losses += 1;
  }
  return { wins, draws, losses };
}

export default function Competitions() {
  const { state, addCompetition, updateCompetition, removeCompetition, applyLedger } = useGame();
  const { matches, team, seasonCompetitions, season, finance } = state;
  const myTeamName = team?.name ?? 'Meu clube';

  const [showAdd, setShowAdd] = useState(false);
  const [activeCompId, setActiveCompId] = useState<string | null>(null);
  const [editingMetaId, setEditingMetaId] = useState<string | null>(null);
  const [flash, setFlash] = useState<PrizeFlash | null>(null);
  const [phaseError, setPhaseError] = useState<Record<string, string>>({});
  const [finalFlags, setFinalFlags] = useState<Record<string, boolean>>({});
  const [showExplainer, setShowExplainer] = useState(false);

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

  // Se a competição ativa foi removida, volta pra visão geral.
  useEffect(() => {
    if (activeCompId && !seasonCompetitions.some(c => c.id === activeCompId)) {
      setActiveCompId(null);
    }
  }, [activeCompId, seasonCompetitions]);

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

  function setPosition(comp: SeasonCompetition, raw: string) {
    const n = raw.trim() === '' ? null : Math.max(1, parseInt(raw, 10) || 1);
    patchComp(comp, { currentPosition: n });
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

  /** Qualquer alteração de placar invalida uma escolha de pênaltis anterior. */
  function updateScore(
    comp: SeasonCompetition,
    phase: KnockoutPhase,
    field: 'goalsFor' | 'goalsAgainst',
    raw: string,
  ) {
    const n = raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0);
    const patch: Partial<KnockoutPhase> =
      field === 'goalsFor'
        ? { goalsFor: n, decidedOnPenalties: false, penaltyWinner: undefined }
        : { goalsAgainst: n, decidedOnPenalties: false, penaltyWinner: undefined };
    updatePhase(comp, phase.id, patch);
  }

  function updateSecondLeg(
    comp: SeasonCompetition,
    phase: KnockoutPhase,
    field: 'goalsFor' | 'goalsAgainst',
    raw: string,
  ) {
    const n = raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0);
    const secondLeg = {
      goalsFor: phase.secondLeg?.goalsFor ?? null,
      goalsAgainst: phase.secondLeg?.goalsAgainst ?? null,
      [field]: n,
    };
    updatePhase(comp, phase.id, {
      secondLeg,
      decidedOnPenalties: false,
      penaltyWinner: undefined,
    });
  }

  function toggleTwoLegged(comp: SeasonCompetition, phase: KnockoutPhase, checked: boolean) {
    updatePhase(comp, phase.id, {
      twoLegged: checked,
      location: phase.location ?? 'home',
      secondLeg: checked ? (phase.secondLeg ?? { goalsFor: null, goalsAgainst: null }) : undefined,
      decidedOnPenalties: false,
      penaltyWinner: undefined,
    });
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

  function handleEliminate(comp: SeasonCompetition) {
    const result = eliminateCurrentPhase(comp.knockoutPhases ?? []);
    if ('error' in result) {
      setPhaseError(prev => ({ ...prev, [comp.id]: result.error }));
      return;
    }
    patchComp(comp, { knockoutPhases: result.phases });
    setPhaseError(prev => ({ ...prev, [comp.id]: '' }));
    setFinalFlags(prev => ({ ...prev, [comp.id]: false }));
    setFlash({ compId: comp.id, message: result.message, amount: 0, kind: 'warn' });
  }

  const activeComp = seasonCompetitions.find(c => c.id === activeCompId) ?? null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Temporada {season}</p>
          <h1 className={styles.title}>Competições</h1>
          <p className={styles.sub}>
            Um painel por competição: estatísticas rápidas aqui, os detalhes completos na aba de cada uma.
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

      {seasonCompetitions.length === 0 ? (
        <div className={styles.emptyInline}>
          Nenhuma competição cadastrada ainda. Use “+ Nova competição” para começar.
        </div>
      ) : (
        <>
          <div className={styles.tabBar}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeCompId === null ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveCompId(null)}
            >
              Visão geral
            </button>
            {seasonCompetitions.map(c => (
              <button
                key={c.id}
                type="button"
                className={`${styles.tabBtn} ${activeCompId === c.id ? styles.tabBtnActive : ''}`}
                style={activeCompId === c.id ? { ['--comp-color' as string]: c.color } : undefined}
                onClick={() => setActiveCompId(c.id)}
              >
                {c.shortName || c.name}
              </button>
            ))}
          </div>

          {activeCompId === null ? (
            <div className={styles.dashboardGrid}>
              {seasonCompetitions.map(comp => (
                <DashboardCard
                  key={comp.id}
                  comp={comp}
                  matches={matches}
                  season={season}
                  matchCount={matchCounts.get(comp.name) ?? 0}
                  onOpen={() => setActiveCompId(comp.id)}
                />
              ))}
            </div>
          ) : activeComp ? (
            renderDetail(activeComp)
          ) : null}
        </>
      )}
    </div>
  );

  function renderDetail(comp: SeasonCompetition) {
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
                  <div className={styles.positionField}>
                    <label>Posição atual</label>
                    <input
                      type="number"
                      min={1}
                      className={`${styles.input} ${styles.positionInput}`}
                      value={comp.currentPosition ?? ''}
                      onChange={e => setPosition(comp, e.target.value)}
                      placeholder="Ex: 5"
                    />
                  </div>
                  <button
                    type="button"
                    className={styles.softBtn}
                    onClick={() => addTableTeam(comp)}
                  >
                    + Time
                  </button>
                </div>
              </div>
              <p className={styles.blockHint}>
                A posição atual é informada por você (a tabela abaixo nem sempre reflete a
                competição real) — ela alimenta metas da Diretoria vinculadas a esta competição.
              </p>

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
              <div className={styles.blockHead}>
                <h3 className={styles.blockTitle}>Mata-mata</h3>
                <button
                  type="button"
                  className={styles.softBtn}
                  onClick={() => setShowExplainer(v => !v)}
                >
                  {showExplainer ? 'Ocultar explicação' : 'Como funciona?'}
                </button>
              </div>

              {showExplainer && (
                <div className={styles.explainerBox}>
                  <p>
                    O mata-mata avança <strong>uma fase por vez</strong>: preencha o adversário e o
                    placar, e ao vencer a próxima fase é criada automaticamente (com premiação de
                    eliminatória, se configurada). Marque “Esta é a final” na última fase para
                    receber a premiação de campeão ao vencer.
                  </p>
                  <ul className={styles.explainerList}>
                    <li>
                      <strong>Ida e volta:</strong> ative o toggle na fase atual para jogar dois
                      jogos contra o mesmo adversário — a volta já vem com o mando de campo
                      invertido. A classificação é decidida pelo <strong>agregado</strong> dos dois
                      jogos.
                    </li>
                    <li>
                      <strong>Empate no agregado:</strong> não existe gol fora de casa — informe
                      quem levou a vaga nos pênaltis ou na prorrogação.
                    </li>
                    <li>
                      <strong>Declarar eliminação:</strong> atalho para registrar que você caiu na
                      fase atual sem precisar preencher o placar.
                    </li>
                  </ul>
                </div>
              )}

              <p className={styles.blockHint}>
                Preencha adversário e placar. Ao avançar, a próxima fase é criada e a premiação de eliminatória cai no caixa.
                Marque “Esta é a final” na última fase para receber a premiação de campeão.
              </p>

              <div className={styles.phaseList}>
                {phases.map(phase => {
                  const isCurrent = !phase.advanced && phase.id === currentPhase?.id;
                  const done = phase.advanced;
                  const agg = phaseAggregate(phase);
                  const tied = !!agg && agg.for === agg.against;

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
                          <label>Nós {phase.twoLegged ? '(ida)' : ''}</label>
                          <input
                            className={`${styles.input} ${styles.scoreInput}`}
                            type="number"
                            min={0}
                            disabled={done}
                            value={phase.goalsFor ?? ''}
                            onChange={e => updateScore(comp, phase, 'goalsFor', e.target.value)}
                          />
                        </div>
                        <div className={styles.scoreBox}>
                          <label>Eles {phase.twoLegged ? '(ida)' : ''}</label>
                          <input
                            className={`${styles.input} ${styles.scoreInput}`}
                            type="number"
                            min={0}
                            disabled={done}
                            value={phase.goalsAgainst ?? ''}
                            onChange={e => updateScore(comp, phase, 'goalsAgainst', e.target.value)}
                          />
                        </div>
                      </div>

                      {isCurrent && !competitionOver && (
                        <label className={styles.finalCheck}>
                          <input
                            type="checkbox"
                            checked={!!phase.twoLegged}
                            onChange={e => toggleTwoLegged(comp, phase, e.target.checked)}
                          />
                          Ida e volta
                        </label>
                      )}

                      {phase.twoLegged && (
                        <div className={styles.phaseFields}>
                          <div className={styles.field}>
                            <label>Mando (ida)</label>
                            <select
                              className={styles.select}
                              value={phase.location ?? 'home'}
                              disabled={done}
                              onChange={e =>
                                updatePhase(comp, phase.id, {
                                  location: e.target.value as MatchLocation,
                                })
                              }
                            >
                              {(['home', 'away', 'neutral'] as MatchLocation[]).map(loc => (
                                <option key={loc} value={loc}>{LOCATION_LABELS[loc]}</option>
                              ))}
                            </select>
                          </div>
                          <div className={styles.scoreBox}>
                            <label>Nós (volta)</label>
                            <input
                              className={`${styles.input} ${styles.scoreInput}`}
                              type="number"
                              min={0}
                              disabled={done}
                              value={phase.secondLeg?.goalsFor ?? ''}
                              onChange={e =>
                                updateSecondLeg(comp, phase, 'goalsFor', e.target.value)
                              }
                            />
                          </div>
                          <div className={styles.scoreBox}>
                            <label>Eles (volta)</label>
                            <input
                              className={`${styles.input} ${styles.scoreInput}`}
                              type="number"
                              min={0}
                              disabled={done}
                              value={phase.secondLeg?.goalsAgainst ?? ''}
                              onChange={e =>
                                updateSecondLeg(comp, phase, 'goalsAgainst', e.target.value)
                              }
                            />
                          </div>
                        </div>
                      )}

                      {phase.twoLegged && (
                        <p className={styles.legHint}>
                          Jogo de volta {LOCATION_LABELS[oppositeLocation(phase.location)].toLowerCase()}
                          {phase.opponent ? ` contra ${phase.opponent}` : ''}.
                        </p>
                      )}

                      {agg && (
                        <div className={`${styles.aggregateNote} ${tied ? styles.aggregateTied : ''}`}>
                          Agregado: {agg.for}-{agg.against}{tied ? ' · empate' : ''}
                        </div>
                      )}

                      {agg && tied && isCurrent && !competitionOver && (
                        <div className={styles.penaltyPrompt}>
                          <span>Quem venceu nos pênaltis/prorrogação?</span>
                          <button
                            type="button"
                            className={`${styles.penaltyBtn} ${phase.penaltyWinner === 'us' ? styles.penaltyBtnActive : ''}`}
                            onClick={() =>
                              updatePhase(comp, phase.id, { decidedOnPenalties: true, penaltyWinner: 'us' })
                            }
                          >
                            Nós
                          </button>
                          <button
                            type="button"
                            className={`${styles.penaltyBtn} ${phase.penaltyWinner === 'them' ? styles.penaltyBtnActive : ''}`}
                            onClick={() =>
                              updatePhase(comp, phase.id, { decidedOnPenalties: true, penaltyWinner: 'them' })
                            }
                          >
                            Eles
                          </button>
                        </div>
                      )}

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
                          <button
                            type="button"
                            className={styles.dangerBtn}
                            onClick={() => handleEliminate(comp)}
                          >
                            Declarar eliminação
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
  }
}

function DashboardCard({
  comp,
  matches,
  season,
  matchCount,
  onOpen,
}: {
  comp: SeasonCompetition;
  matches: { status: string; competition: string; season?: number; result: string | null }[];
  season: number;
  matchCount: number;
  onOpen: () => void;
}) {
  const format = comp.format ?? defaultFormatForType(comp.type);
  const showLeague = hasLeagueStage(format);
  const showKnockout =
    hasKnockoutStage(format) && (format === 'knockout' || !!comp.knockoutStarted);
  const phases = comp.knockoutPhases ?? [];
  const currentPhase = phases.find(p => !p.advanced);
  const champion = phases.some(p => p.advanced && p.isFinal && p.outcome === 'won');
  const eliminated = phases.some(p => p.advanced && p.outcome === 'lost');
  const record = showLeague ? recordFromMatches(matches, comp.name, season) : null;

  return (
    <div className={styles.dashCard} style={{ ['--comp-color' as string]: comp.color }}>
      <div className={styles.dashCardTop}>
        <div className={styles.compStripe} />
        <div>
          <h3 className={styles.dashCardName}>{comp.name}</h3>
          <div className={styles.compMeta}>
            <span className={styles.badge}>{COMPETITION_TYPE_LABELS[comp.type]}</span>
            <span className={`${styles.badge} ${styles.badgeAccent}`}>
              {COMPETITION_FORMAT_LABELS[format]}
            </span>
            <span className={styles.badge}>{matchCount} jogos</span>
          </div>
        </div>
      </div>

      <div className={styles.dashStatRow}>
        {showLeague && (
          <div className={styles.dashStat}>
            <span className={styles.dashStatLabel}>Posição</span>
            <strong className={styles.dashStatValue}>
              {comp.currentPosition ? `${comp.currentPosition}º` : '—'}
            </strong>
          </div>
        )}
        {showLeague && record && (
          <div className={styles.dashStat}>
            <span className={styles.dashStatLabel}>Campanha</span>
            <strong className={styles.dashStatValue}>
              {record.wins}V {record.draws}E {record.losses}D
            </strong>
          </div>
        )}
        {showKnockout && (
          <div className={styles.dashStat}>
            <span className={styles.dashStatLabel}>Mata-mata</span>
            <strong className={styles.dashStatValue}>
              {champion ? 'Campeão' : eliminated ? 'Eliminado' : currentPhase?.name ?? '—'}
            </strong>
          </div>
        )}
        {showKnockout && currentPhase?.twoLegged && !champion && !eliminated && (
          <span className={styles.badge}>Ida e volta</span>
        )}
      </div>

      <button type="button" className={styles.dashOpenBtn} onClick={onOpen}>
        Abrir →
      </button>
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
