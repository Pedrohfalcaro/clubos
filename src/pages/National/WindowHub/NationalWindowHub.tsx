import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../../../context/GameContext';
import SearchableSelect from '../../../components/SearchableSelect/SearchableSelect';
import FormationField from '../../../components/FormationField/FormationField';
import FormationPicker from '../../../components/FormationPicker/FormationPicker';
import {
  FIFA_WINDOW_TYPE_LABELS,
  OPPONENT_STRENGTH_LABELS,
  type FifaWindow,
  type OpponentStrength,
} from '../../../types/NationalTeam';
import type { MatchLocation } from '../../../types/Match';
import type { FormationKey, TacticsDraft, TacticsPreset } from '../../../types/Tactics';
import { MAX_TACTICS_PRESETS } from '../../../types/Tactics';
import { locationLabel } from '../../../utils/matchStats';
import { formatGameDate } from '../../../livelife';
import {
  isGameOutsideWindow,
  dayInWindow,
  windowTotalDays,
  carryOverTacticsDraft,
} from '../../../utils/nationalWindows';
import {
  buildBestLineup,
  countFilledSlots,
  createTacticsPresetId,
  getFormationPreset,
  lineupAverageOverall,
  lineupWarnings,
  normalizeFormation,
  remapFormation,
  resolveTactics,
} from '../../../utils/formations';
import { DEFAULT_STYLE_KEY } from '../../../utils/tacticalStyles';
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY } from '../../../utils/clubColors';
import { nationalPlayerToPseudoPlayer } from '../../../utils/nationalMatchPlay';
// Reaproveita CSS dos módulos que essa hub substitui — mesmo visual, um só lugar.
import wStyles from '../Windows/NationalWindows.module.css';
import sStyles from '../Squad/NationalSquad.module.css';
import tStyles from '../../Tactics/Tactics.module.css';

const OPPONENT_STRENGTHS: OpponentStrength[] = ['top10', 'top30', 'outros'];
const LOCATIONS: MatchLocation[] = ['home', 'away', 'neutral'];
const BENCH_MAX = 9;

type HubTab = 'jogos' | 'convocacao' | 'tatica';

interface AddGameInput {
  opponent: string;
  location: MatchLocation;
  date: string;
  opponentStrength: OpponentStrength;
}

export default function NationalWindowHub() {
  const { windowId } = useParams<{ windowId: string }>();
  const navigate = useNavigate();
  const { state, addFifaWindowGame } = useGame();
  const nationalTeam = state.nationalTeam;
  const [tab, setTab] = useState<HubTab>('jogos');
  const [showAddGame, setShowAddGame] = useState(false);

  const fifaWindow = nationalTeam?.windows.find(w => w.id === windowId) ?? null;

  if (!nationalTeam) return null;

  if (!fifaWindow) {
    return (
      <div className={wStyles.page}>
        <div className={wStyles.empty}>
          <p className={wStyles.emptyTitle}>Data FIFA não encontrada.</p>
          <button type="button" className={wStyles.btnPrimary} onClick={() => navigate('/national/windows')}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const currentDate = state.currentDate;
  const dayLabel =
    currentDate &&
    currentDate.slice(0, 10) >= fifaWindow.startDate.slice(0, 10) &&
    currentDate.slice(0, 10) <= fifaWindow.endDate.slice(0, 10)
      ? `Dia ${dayInWindow(fifaWindow, currentDate)} de ${windowTotalDays(fifaWindow)}`
      : null;

  const hasCallUps = fifaWindow.callUpIds.length > 0;
  const hasGames = fifaWindow.games.length > 0;
  const unlocked = hasCallUps && hasGames;

  function handleAddGame(input: AddGameInput) {
    addFifaWindowGame(fifaWindow!.id, input);
    setShowAddGame(false);
  }

  return (
    <div className={wStyles.page}>
      <header className={wStyles.header}>
        <div>
          <button type="button" className={wStyles.btnSecondary} onClick={() => navigate('/national/windows')}>
            ← Datas FIFA
          </button>
          <h1 className={wStyles.title} style={{ marginTop: 8 }}>
            {fifaWindow.label}
          </h1>
          <p className={wStyles.hint}>
            {FIFA_WINDOW_TYPE_LABELS[fifaWindow.type]}
            {fifaWindow.type === 'outros' && fifaWindow.typeOther ? ` · ${fifaWindow.typeOther}` : ''}
            {' · '}
            {formatGameDate(fifaWindow.startDate, { day: '2-digit', month: 'short' })}
            {' – '}
            {formatGameDate(fifaWindow.endDate, { day: '2-digit', month: 'short', year: 'numeric' })}
            {dayLabel ? ` · ${dayLabel}` : ''}
          </p>
        </div>
      </header>

      {!unlocked && (
        <div className={wStyles.pendingCard}>
          <p className={wStyles.pendingTitle}>Pendências antes de liberar tática e partidas</p>
          <ul className={wStyles.pendingList}>
            {!hasCallUps && (
              <li>
                <button type="button" className={wStyles.pendingItem} onClick={() => setTab('convocacao')}>
                  <span className={wStyles.pendingDot} /> Convocar jogadores
                </button>
              </li>
            )}
            {!hasGames && (
              <li>
                <button type="button" className={wStyles.pendingItem} onClick={() => setTab('jogos')}>
                  <span className={wStyles.pendingDot} /> Registrar compromissos
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className={wStyles.tabs} role="tablist" aria-label="Data FIFA">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'jogos'}
          className={`${wStyles.tab} ${tab === 'jogos' ? wStyles.tabActive : ''}`}
          onClick={() => setTab('jogos')}
        >
          Jogos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'convocacao'}
          className={`${wStyles.tab} ${tab === 'convocacao' ? wStyles.tabActive : ''}`}
          onClick={() => setTab('convocacao')}
        >
          Convocação
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tatica'}
          className={`${wStyles.tab} ${tab === 'tatica' ? wStyles.tabActive : ''}`}
          onClick={() => unlocked && setTab('tatica')}
          disabled={!unlocked}
          title={unlocked ? undefined : 'Convoque jogadores e registre os compromissos primeiro'}
        >
          {unlocked ? 'Tática' : '🔒 Tática'}
        </button>
      </div>

      {tab === 'jogos' && (
        <JogosTab
          key={fifaWindow.id}
          fifaWindow={fifaWindow}
          unlocked={unlocked}
          onAddGame={() => setShowAddGame(true)}
          onPlayGame={gameId => navigate(`/national/match/${fifaWindow.id}/${gameId}/play`)}
        />
      )}
      {tab === 'convocacao' && <ConvocacaoTab key={fifaWindow.id} windowId={fifaWindow.id} />}
      {tab === 'tatica' && <TaticaTab key={fifaWindow.id} windowId={fifaWindow.id} />}

      {showAddGame && (
        <AddGameModal
          minDate={fifaWindow.startDate.slice(0, 10)}
          maxDate={fifaWindow.endDate.slice(0, 10)}
          onSubmit={handleAddGame}
          onCancel={() => setShowAddGame(false)}
        />
      )}
    </div>
  );
}

// ─── Jogos ─────────────────────────────────────────────────────────────────

function JogosTab({
  fifaWindow,
  unlocked,
  onAddGame,
  onPlayGame,
}: {
  fifaWindow: FifaWindow;
  unlocked: boolean;
  onAddGame: () => void;
  onPlayGame: (gameId: string) => void;
}) {
  return (
    <div className={wStyles.windowCard}>
      <div className={wStyles.windowMeta}>
        <span className={wStyles.windowType}>Convocação: {fifaWindow.listSize} jogadores</span>
      </div>

      <div className={wStyles.gamesHeader}>
        <p className={wStyles.sectionTitle}>Jogos mapeados</p>
        <button type="button" className={wStyles.btnSecondary} onClick={onAddGame}>
          + Jogo
        </button>
      </div>

      {fifaWindow.games.length === 0 ? (
        <p className={wStyles.emptyHint}>Nenhum jogo mapeado nesta Data FIFA ainda.</p>
      ) : (
        <ul className={wStyles.gameList}>
          {fifaWindow.games.map(g => (
            <li key={g.id} className={wStyles.gameRow}>
              <div>
                <p className={wStyles.gameOpponent}>
                  {g.opponent}
                  {g.played && (
                    <span className={wStyles.scoreBadge}>
                      {g.goalsFor ?? 0} × {g.goalsAgainst ?? 0}
                    </span>
                  )}
                </p>
                <p className={wStyles.gameMeta}>
                  {locationLabel(g.location)} · Dia {dayInWindow(fifaWindow, g.date)}
                  {isGameOutsideWindow(fifaWindow, g.date) && (
                    <span className={wStyles.warnBadge} title="Data fora da janela da Data FIFA">
                      {' '}⚠ fora da janela
                    </span>
                  )}
                </p>
              </div>
              <div className={wStyles.gameRowActions}>
                <span className={wStyles.strengthBadge}>{OPPONENT_STRENGTH_LABELS[g.opponentStrength]}</span>
                <button
                  type="button"
                  className={wStyles.btnPrimary}
                  onClick={() => onPlayGame(g.id)}
                  disabled={!unlocked}
                  title={unlocked ? undefined : 'Convoque jogadores antes de jogar'}
                >
                  {g.played ? 'Editar partida' : 'Jogar partida'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddGameModal({
  minDate,
  maxDate,
  onSubmit,
  onCancel,
}: {
  minDate: string;
  maxDate: string;
  onSubmit: (input: AddGameInput) => void;
  onCancel: () => void;
}) {
  const [opponent, setOpponent] = useState('');
  const [location, setLocation] = useState<MatchLocation>('home');
  const [date, setDate] = useState(minDate);
  const [opponentStrength, setOpponentStrength] = useState<OpponentStrength>('outros');

  const canSubmit = opponent.trim().length > 0 && date >= minDate && date <= maxDate;

  function submit() {
    if (!canSubmit) return;
    onSubmit({ opponent: opponent.trim(), location, date, opponentStrength });
  }

  return (
    <div className={wStyles.overlay} onClick={onCancel}>
      <div className={wStyles.modal} onClick={e => e.stopPropagation()}>
        <p className={wStyles.modalTitle}>Mapear jogo</p>

        <div className={wStyles.formGroup}>
          <label className={wStyles.formLabel}>Adversário</label>
          <input
            className={wStyles.formInput}
            type="text"
            value={opponent}
            onChange={e => setOpponent(e.target.value)}
            placeholder="ex.: Argentina"
            autoFocus
          />
        </div>

        <div className={wStyles.formGroup}>
          <label className={wStyles.formLabel}>Mando de campo</label>
          <div className={wStyles.pillGrid}>
            {LOCATIONS.map(loc => (
              <button
                key={loc}
                type="button"
                className={`${wStyles.pillBtn} ${location === loc ? wStyles.pillActive : ''}`}
                onClick={() => setLocation(loc)}
              >
                {locationLabel(loc)}
              </button>
            ))}
          </div>
        </div>

        <div className={wStyles.formGroup}>
          <label className={wStyles.formLabel}>Data do jogo</label>
          <input
            className={wStyles.formInput}
            type="date"
            value={date}
            min={minDate}
            max={maxDate}
            onChange={e => setDate(e.target.value)}
          />
          <span className={wStyles.hint}>
            Só datas dentro da janela desta Data FIFA ({formatGameDate(minDate, { day: '2-digit', month: 'short' })}
            {' – '}
            {formatGameDate(maxDate, { day: '2-digit', month: 'short' })}).
          </span>
        </div>

        <div className={wStyles.formGroup}>
          <label className={wStyles.formLabel}>Força do adversário</label>
          <div className={wStyles.pillGrid}>
            {OPPONENT_STRENGTHS.map(s => (
              <button
                key={s}
                type="button"
                className={`${wStyles.pillBtn} ${opponentStrength === s ? wStyles.pillActive : ''}`}
                onClick={() => setOpponentStrength(s)}
              >
                {OPPONENT_STRENGTH_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className={wStyles.actions}>
          <button type="button" className={wStyles.btnSecondary} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={wStyles.btnPrimary} onClick={submit} disabled={!canSubmit}>
            Adicionar jogo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Convocação ──────────────────────────────────────────────────────────────

function ConvocacaoTab({ windowId }: { windowId: string }) {
  const { state, setCallUpList, setCallUpNumber, linkNationalPlayerToClub } = useGame();
  const navigate = useNavigate();
  const nationalTeam = state.nationalTeam!;
  const fifaWindow = nationalTeam.windows.find(w => w.id === windowId)!;
  const [search, setSearch] = useState('');

  const filteredPool = useMemo(() => {
    const q = search.toLowerCase();
    return nationalTeam.talentPool.filter(p => p.name.toLowerCase().includes(q));
  }, [nationalTeam.talentPool, search]);

  const callUpIds = fifaWindow.callUpIds;
  const atLimit = callUpIds.length >= fifaWindow.listSize;

  function toggleCallUp(playerId: string) {
    const isIn = fifaWindow.callUpIds.includes(playerId);
    if (isIn) {
      setCallUpList(fifaWindow.id, fifaWindow.callUpIds.filter(id => id !== playerId));
      return;
    }
    if (atLimit) return;
    setCallUpList(fifaWindow.id, [...fifaWindow.callUpIds, playerId]);
  }

  const clubPlayerOptions = [
    { value: '', label: '— Nenhum —' },
    ...state.players.map(p => ({ value: p.id, label: p.name })),
  ];

  if (nationalTeam.talentPool.length === 0) {
    return (
      <div className={sStyles.empty}>
        <p className={sStyles.emptyTitle}>Nenhum atleta na Base de Jogadores ainda.</p>
        <p className={sStyles.emptyHint}>Cadastre atletas na Base de Jogadores antes de convocar.</p>
        <button type="button" className={sStyles.btnPrimary} onClick={() => navigate('/national/players')}>
          Ir para Base de Jogadores
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className={sStyles.windowBar}>
        <div className={`${sStyles.counter} ${atLimit ? sStyles.counterFull : ''}`}>
          {callUpIds.length}/{fifaWindow.listSize} convocados
        </div>
      </div>

      <div className={sStyles.toolbar} style={{ marginTop: 12, marginBottom: 12 }}>
        <input
          className={sStyles.search}
          type="text"
          placeholder="Buscar atleta..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filteredPool.length === 0 ? (
        <p className={sStyles.emptyHint}>Nenhum atleta encontrado.</p>
      ) : (
        <ul className={sStyles.poolList}>
          {filteredPool.map(p => {
            const included = callUpIds.includes(p.id);
            const disabled = !included && atLimit;
            return (
              <li key={p.id} className={`${sStyles.callUpRow} ${included ? sStyles.poolRowActive : ''}`}>
                <label
                  className={sStyles.poolCheck}
                  title={disabled ? `Limite atingido (${fifaWindow.listSize}/${fifaWindow.listSize})` : undefined}
                >
                  <input type="checkbox" checked={included} disabled={disabled} onChange={() => toggleCallUp(p.id)} />
                </label>
                <div className={sStyles.poolInfo}>
                  <p className={sStyles.poolName}>
                    {p.name}
                    {p.caps > 0 && <span className={sStyles.capsBadge}>{p.caps}x convocado</span>}
                  </p>
                  <p className={sStyles.poolMeta}>
                    {p.position} · {p.age} anos · {p.club}
                    {p.overall != null ? ` · OVR ${p.overall}` : ''}
                  </p>
                </div>
                {included ? (
                  <input
                    className={sStyles.numberInput}
                    type="number"
                    min={1}
                    max={99}
                    placeholder="—"
                    value={fifaWindow.callUpNumbers[p.id] ?? ''}
                    onChange={e =>
                      setCallUpNumber(fifaWindow.id, p.id, e.target.value ? Number(e.target.value) : null)
                    }
                  />
                ) : (
                  <span />
                )}
                <div className={sStyles.poolLink}>
                  <SearchableSelect
                    options={clubPlayerOptions}
                    value={p.clubPlayerId ?? ''}
                    onChange={v => linkNationalPlayerToClub(p.id, v || null)}
                    placeholder="Vincular ao clube..."
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Tática ─────────────────────────────────────────────────────────────────

function signature(tactics: TacticsDraft): string {
  return JSON.stringify([
    tactics.formationKey,
    tactics.formation.map(f => `${f.slot}:${f.playerId}`),
    tactics.bench,
  ]);
}

function TaticaTab({ windowId }: { windowId: string }) {
  const {
    state,
    saveNationalTacticsPreset,
    deleteNationalTacticsPreset,
    setActiveNationalTactics,
  } = useGame();
  const nationalTeam = state.nationalTeam!;
  const fifaWindow = nationalTeam.windows.find(w => w.id === windowId)!;
  const players = useMemo(
    () =>
      fifaWindow.callUpIds
        .map(id => nationalTeam.talentPool.find(p => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map(p => nationalPlayerToPseudoPlayer(p, fifaWindow.callUpNumbers[p.id])),
    [fifaWindow.callUpIds, fifaWindow.callUpNumbers, nationalTeam.talentPool],
  );
  const primaryColor = nationalTeam.primaryColor ?? DEFAULT_PRIMARY;
  const secondaryColor = nationalTeam.secondaryColor ?? DEFAULT_SECONDARY;
  const presets = fifaWindow.tacticsPresets;

  function fallbackDraft(): TacticsDraft {
    return fifaWindow.tactics
      ? resolveTactics(fifaWindow.tactics, players)
      : carryOverTacticsDraft(nationalTeam.windows, fifaWindow.id, players, BENCH_MAX);
  }

  const [selectedId, setSelectedId] = useState<string | null>(
    () => fifaWindow.activeTacticsId ?? presets[0]?.id ?? null,
  );
  const [name, setName] = useState('');
  const [draft, setDraft] = useState<TacticsDraft>(() => {
    const initialPreset = presets.find(p => p.id === (fifaWindow.activeTacticsId ?? presets[0]?.id));
    return initialPreset ? resolveTactics(initialPreset, players) : fallbackDraft();
  });
  const [justSaved, setJustSaved] = useState(false);

  const selected = useMemo(() => presets.find(p => p.id === selectedId) ?? null, [presets, selectedId]);

  const syncedKey = useRef(`${selectedId}:${presets.map(p => p.id + p.updatedAt).join('|')}`);
  useEffect(() => {
    const key = `${selectedId}:${presets.map(p => p.id + p.updatedAt).join('|')}`;
    if (syncedKey.current === key) return;
    syncedKey.current = key;

    const preset = presets.find(p => p.id === selectedId);
    if (preset) {
      setName(preset.name);
      setDraft(resolveTactics(preset, players));
      return;
    }
    if (selectedId) return;

    const fallback = presets[0] ?? null;
    setSelectedId(fallback?.id ?? null);
    setName(fallback?.name ?? '');
    setDraft(fallback ? resolveTactics(fallback, players) : fallbackDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets, selectedId, players]);

  const isNewDraft = Boolean(selectedId && !selected);
  const savedDraft = useMemo(
    () => (selected ? resolveTactics(selected, players) : fallbackDraft()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, players],
  );

  if (players.length === 0) {
    return (
      <div className={sStyles.empty}>
        <p className={sStyles.emptyTitle}>Nenhum convocado nesta Data FIFA ainda.</p>
        <p className={sStyles.emptyHint}>Convoque atletas na aba Convocação antes de montar a tática.</p>
      </div>
    );
  }

  const preset = getFormationPreset(draft.formationKey);
  const total = preset.slots.length;
  const filled = countFilledSlots(draft.formation, draft.formationKey, players);
  const complete = filled === total;
  const dirty =
    isNewDraft ||
    signature(draft) !== signature(savedDraft) ||
    (name.trim() || 'Tática') !== (selected?.name ?? '');
  const gameDate = state.currentDate;
  const warnings = lineupWarnings(draft.formation, draft.formationKey, players, draft.bench, null, gameDate);
  const average = lineupAverageOverall(draft.formation, players);
  const canAdd = presets.length < MAX_TACTICS_PRESETS;

  function selectPreset(id: string) {
    setSelectedId(id);
    setActiveNationalTactics(fifaWindow.id, id);
    const p = presets.find(x => x.id === id);
    setName(p?.name ?? '');
    setDraft(resolveTactics(p ?? null, players));
  }

  function handleFormationChange(key: FormationKey) {
    if (key === draft.formationKey) return;
    setDraft(current => ({
      ...current,
      formationKey: key,
      formation: remapFormation(current.formation, current.formationKey, key, players),
    }));
  }

  function handleAutoFill() {
    const best = buildBestLineup(draft.formationKey, players, 7, null, gameDate);
    setDraft(current => ({ ...current, ...best }));
  }

  function handleClear() {
    setDraft(current => ({ ...current, formation: [], bench: [] }));
  }

  function handleSave() {
    const id = selectedId && presets.some(p => p.id === selectedId) ? selectedId : createTacticsPresetId();
    const presetPayload: TacticsPreset = {
      id,
      name: name.trim() || `Tática ${presets.length + 1}`,
      formationKey: draft.formationKey,
      style: draft.style || DEFAULT_STYLE_KEY,
      formation: normalizeFormation(draft.formation, draft.formationKey, players),
      bench: draft.bench,
      updatedAt: new Date().toISOString(),
    };
    saveNationalTacticsPreset(fifaWindow.id, presetPayload);
    setSelectedId(id);
    setJustSaved(true);
    globalThis.setTimeout(() => setJustSaved(false), 2000);
  }

  function handleAdd() {
    if (!canAdd) return;
    const id = createTacticsPresetId();
    const base = fallbackDraft();
    const nameStr = `Tática ${presets.length + 1}`;

    if (base.formation.length > 0) {
      saveNationalTacticsPreset(fifaWindow.id, {
        id,
        name: nameStr,
        formationKey: base.formationKey,
        style: base.style || DEFAULT_STYLE_KEY,
        formation: normalizeFormation(base.formation, base.formationKey, players),
        bench: base.bench,
        updatedAt: new Date().toISOString(),
      });
    }

    setSelectedId(id);
    setName(nameStr);
    setDraft(base);
  }

  function handleDelete() {
    if (!selectedId || presets.length === 0) return;
    if (!globalThis.confirm('Excluir esta tática?')) return;
    const remaining = presets.filter(p => p.id !== selectedId);
    deleteNationalTacticsPreset(fifaWindow.id, selectedId);
    const next = remaining[0] ?? null;
    setSelectedId(next?.id ?? null);
    setName(next?.name ?? '');
    setDraft(next ? resolveTactics(next, players) : fallbackDraft());
  }

  function handleDiscard() {
    if (isNewDraft) {
      const fallback = presets[0] ?? null;
      setSelectedId(fallback?.id ?? null);
      setName(fallback?.name ?? '');
      setDraft(fallback ? resolveTactics(fallback, players) : fallbackDraft());
      return;
    }
    setName(selected?.name ?? '');
    setDraft(savedDraft);
  }

  const savedAt = selected?.updatedAt
    ? new Date(selected.updatedAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className={tStyles.page} style={{ maxWidth: 'none', padding: 0 }}>
      <header className={tStyles.header}>
        <p className={tStyles.sub}>
          Convocados sem tática salva entram automaticamente na posição da Data FIFA anterior
          (novidades no banco). Salve até {MAX_TACTICS_PRESETS} táticas.
        </p>
        <div className={tStyles.headerActions}>
          <span className={tStyles.status} data-state={dirty ? 'dirty' : 'clean'}>
            {dirty ? 'Alterações não salvas' : savedAt ? `Salvo em ${savedAt}` : 'Nenhuma tática salva'}
          </span>
          <button type="button" className={tStyles.saveBtn} onClick={handleSave} disabled={!complete || !dirty}>
            {justSaved ? 'Salvo!' : 'Salvar tática'}
          </button>
        </div>
      </header>

      <section className={tStyles.presetBar}>
        <div className={tStyles.presetList}>
          {presets.map(p => (
            <button
              key={p.id}
              type="button"
              className={`${tStyles.presetChip} ${p.id === selectedId ? tStyles.presetChipActive : ''}`}
              onClick={() => selectPreset(p.id)}
            >
              {p.name}
            </button>
          ))}
          {isNewDraft && (
            <button type="button" className={`${tStyles.presetChip} ${tStyles.presetChipActive}`} disabled>
              {name.trim() || 'Nova tática'}
            </button>
          )}
          {canAdd && !isNewDraft && (
            <button type="button" className={tStyles.presetAdd} onClick={handleAdd}>
              + Nova
            </button>
          )}
        </div>
        <div className={tStyles.presetMeta}>
          <label className={tStyles.nameField}>
            <span>Nome</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex.: 4-3-3 titular"
              maxLength={32}
            />
          </label>
          {selectedId && presets.some(p => p.id === selectedId) && (
            <button type="button" className={tStyles.deleteBtn} onClick={handleDelete}>
              Excluir
            </button>
          )}
        </div>
      </section>

      <section className={tStyles.setupCard}>
        <FormationPicker value={draft.formationKey} onChange={handleFormationChange} />
      </section>

      <div className={tStyles.toolbar}>
        <div className={tStyles.stats}>
          <span className={tStyles.stat} data-warn={complete ? undefined : 'true'}>
            <strong>
              {filled}/{total}
            </strong>{' '}
            titulares
          </span>
          <span className={tStyles.stat}>
            <strong>
              {draft.bench.length}/{BENCH_MAX}
            </strong>{' '}
            no banco
          </span>
          {average > 0 && (
            <span className={tStyles.stat}>
              <strong>{average}</strong> overall médio
            </span>
          )}
          <span className={tStyles.stat}>{preset.label}</span>
        </div>
        <div className={tStyles.tools}>
          <button type="button" className={tStyles.toolBtn} onClick={handleAutoFill}>
            Escalação automática
          </button>
          <button
            type="button"
            className={tStyles.toolBtn}
            onClick={handleClear}
            disabled={filled === 0 && draft.bench.length === 0}
          >
            Limpar
          </button>
          <button type="button" className={tStyles.toolBtn} onClick={handleDiscard} disabled={!dirty}>
            Descartar
          </button>
        </div>
      </div>

      <div className={tStyles.fieldCard}>
        <FormationField
          players={players}
          formation={draft.formation}
          onFormationChange={formation => setDraft(current => ({ ...current, formation }))}
          bench={draft.bench}
          onBenchChange={bench => setDraft(current => ({ ...current, bench }))}
          showBench
          benchMin={0}
          benchMax={BENCH_MAX}
          slotMode
          preset={preset}
          kitColor={primaryColor}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
        />
      </div>

      {warnings.length > 0 && (
        <section className={tStyles.warnings}>
          <p className={tStyles.warningsTitle}>Pontos de atenção</p>
          <ul className={tStyles.warningsList}>
            {warnings.map(warning => (
              <li key={warning.message}>{warning.message}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
