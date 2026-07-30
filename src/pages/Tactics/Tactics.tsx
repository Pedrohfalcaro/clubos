import { useEffect, useMemo, useRef, useState } from 'react';
import FormationField from '../../components/FormationField/FormationField';
import FormationPicker from '../../components/FormationPicker/FormationPicker';
import { useGame } from '../../context/GameContext';
import type { FormationKey, TacticsDraft, TacticsPreset } from '../../types/Tactics';
import { MAX_TACTICS_PRESETS } from '../../types/Tactics';
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
} from '../../utils/formations';
import { DEFAULT_STYLE_KEY } from '../../utils/tacticalStyles';
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY } from '../../utils/clubColors';
import styles from './Tactics.module.css';

const BENCH_MAX = 9;

function signature(tactics: TacticsDraft): string {
  return JSON.stringify([
    tactics.formationKey,
    tactics.formation.map(f => `${f.slot}:${f.playerId}`),
    tactics.bench,
  ]);
}

export default function Tactics() {
  const {
    state,
    saveTacticsPreset,
    deleteTacticsPreset,
    setActiveTactics,
  } = useGame();
  const players = state.players;
  const primaryColor = state.team?.primaryColor ?? DEFAULT_PRIMARY;
  const secondaryColor = state.team?.secondaryColor ?? DEFAULT_SECONDARY;
  const presets = state.tacticsPresets;

  const [selectedId, setSelectedId] = useState<string | null>(
    () => state.activeTacticsId ?? presets[0]?.id ?? null,
  );
  const [name, setName] = useState('');
  const [draft, setDraft] = useState<TacticsDraft>(() =>
    resolveTactics(
      presets.find(p => p.id === (state.activeTacticsId ?? presets[0]?.id)) ?? null,
      players,
    ),
  );
  const [justSaved, setJustSaved] = useState(false);

  const selected = useMemo(
    () => presets.find(p => p.id === selectedId) ?? null,
    [presets, selectedId],
  );

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

    // ID de rascunho "+ Nova" ainda não persistido — não voltar ao primeiro preset
    if (selectedId) return;

    const fallback = presets[0] ?? null;
    setSelectedId(fallback?.id ?? null);
    setName(fallback?.name ?? '');
    setDraft(resolveTactics(fallback, players));
  }, [presets, selectedId, players]);

  const isNewDraft = Boolean(selectedId && !selected);

  const savedDraft = useMemo(
    () => resolveTactics(selected, players),
    [selected, players],
  );

  const preset = getFormationPreset(draft.formationKey);
  const total = preset.slots.length;
  const filled = countFilledSlots(draft.formation, draft.formationKey, players);
  const complete = filled === total;
  const dirty =
    isNewDraft ||
    signature(draft) !== signature(savedDraft) ||
    (name.trim() || 'Tática') !== (selected?.name ?? '');
  const warnings = lineupWarnings(draft.formation, draft.formationKey, players, draft.bench);
  const average = lineupAverageOverall(draft.formation, players);
  const canAdd = presets.length < MAX_TACTICS_PRESETS;

  function selectPreset(id: string) {
    setSelectedId(id);
    setActiveTactics(id);
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
    const best = buildBestLineup(draft.formationKey, players, 7);
    setDraft(current => ({ ...current, ...best }));
  }

  function handleClear() {
    setDraft(current => ({ ...current, formation: [], bench: [] }));
  }

  function handleSave() {
    // Sempre gerar id novo se ainda for rascunho — evita sobrescrever a tática anterior
    const id =
      selectedId && presets.some(p => p.id === selectedId)
        ? selectedId
        : createTacticsPresetId();
    const presetPayload: TacticsPreset = {
      id,
      name: name.trim() || `Tática ${presets.length + 1}`,
      formationKey: draft.formationKey,
      style: draft.style || DEFAULT_STYLE_KEY,
      formation: normalizeFormation(draft.formation, draft.formationKey, players),
      bench: draft.bench,
      updatedAt: new Date().toISOString(),
    };
    saveTacticsPreset(presetPayload);
    setSelectedId(id);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2000);
  }

  function handleAdd() {
    if (!canAdd) return;
    const id = createTacticsPresetId();
    const base = resolveTactics(null, players);
    // Preenche XI pra já poder persistir (normalize rejeita tática vazia)
    const filled =
      players.length > 0
        ? { ...base, ...buildBestLineup(base.formationKey, players, 7) }
        : base;
    const nameStr = `Tática ${presets.length + 1}`;

    if (filled.formation.length > 0) {
      saveTacticsPreset({
        id,
        name: nameStr,
        formationKey: filled.formationKey,
        style: filled.style || DEFAULT_STYLE_KEY,
        formation: normalizeFormation(filled.formation, filled.formationKey, players),
        bench: filled.bench,
        updatedAt: new Date().toISOString(),
      });
    }

    setSelectedId(id);
    setName(nameStr);
    setDraft(filled);
  }

  function handleDelete() {
    if (!selectedId || presets.length === 0) return;
    if (!window.confirm('Excluir esta tática?')) return;
    const remaining = presets.filter(p => p.id !== selectedId);
    deleteTacticsPreset(selectedId);
    const next = remaining[0] ?? null;
    setSelectedId(next?.id ?? null);
    setName(next?.name ?? '');
    setDraft(resolveTactics(next, players));
  }

  function handleDiscard() {
    if (isNewDraft) {
      const fallback = presets[0] ?? null;
      setSelectedId(fallback?.id ?? null);
      setName(fallback?.name ?? '');
      setDraft(resolveTactics(fallback, players));
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
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Táticas</h1>
          <p className={styles.sub}>
            Salve até {MAX_TACTICS_PRESETS} táticas nomeadas e escolha qual usar na partida.
          </p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.status} data-state={dirty ? 'dirty' : 'clean'}>
            {dirty
              ? 'Alterações não salvas'
              : savedAt
                ? `Salvo em ${savedAt}`
                : 'Nenhuma tática salva'}
          </span>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!complete || !dirty}
          >
            {justSaved ? 'Salvo!' : 'Salvar tática'}
          </button>
        </div>
      </header>

      <section className={styles.presetBar}>
        <div className={styles.presetList}>
          {presets.map(p => (
            <button
              key={p.id}
              type="button"
              className={`${styles.presetChip} ${p.id === selectedId ? styles.presetChipActive : ''}`}
              onClick={() => selectPreset(p.id)}
            >
              {p.name}
            </button>
          ))}
          {isNewDraft && (
            <button
              type="button"
              className={`${styles.presetChip} ${styles.presetChipActive}`}
              disabled
            >
              {name.trim() || 'Nova tática'}
            </button>
          )}
          {canAdd && !isNewDraft && (
            <button type="button" className={styles.presetAdd} onClick={handleAdd}>
              + Nova
            </button>
          )}
        </div>
        <div className={styles.presetMeta}>
          <label className={styles.nameField}>
            <span>Nome</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex.: Casa 4-3-3"
              maxLength={32}
            />
          </label>
          {selectedId && presets.some(p => p.id === selectedId) && (
            <button type="button" className={styles.deleteBtn} onClick={handleDelete}>
              Excluir
            </button>
          )}
        </div>
      </section>

      <section className={styles.setupCard}>
        <FormationPicker value={draft.formationKey} onChange={handleFormationChange} />
      </section>

      <div className={styles.toolbar}>
        <div className={styles.stats}>
          <span className={styles.stat} data-warn={complete ? undefined : 'true'}>
            <strong>
              {filled}/{total}
            </strong>{' '}
            titulares
          </span>
          <span className={styles.stat}>
            <strong>
              {draft.bench.length}/{BENCH_MAX}
            </strong>{' '}
            no banco
          </span>
          {average > 0 && (
            <span className={styles.stat}>
              <strong>{average}</strong> overall médio
            </span>
          )}
          <span className={styles.stat}>{preset.label}</span>
        </div>
        <div className={styles.tools}>
          <button type="button" className={styles.toolBtn} onClick={handleAutoFill}>
            Escalação automática
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={handleClear}
            disabled={filled === 0 && draft.bench.length === 0}
          >
            Limpar
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={handleDiscard}
            disabled={!dirty}
          >
            Descartar
          </button>
        </div>
      </div>

      <div className={styles.fieldCard}>
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
        <section className={styles.warnings}>
          <p className={styles.warningsTitle}>Pontos de atenção</p>
          <ul className={styles.warningsList}>
            {warnings.map(warning => (
              <li key={warning.message}>{warning.message}</li>
            ))}
          </ul>
        </section>
      )}

      <p className={styles.hint}>
        Use XI / B na lista, arraste para o campo ou banco, ou toque num slot e depois no jogador.
        Trocar de formação ou variante mantém os mesmos jogadores, reposicionados por função.
      </p>
    </div>
  );
}
