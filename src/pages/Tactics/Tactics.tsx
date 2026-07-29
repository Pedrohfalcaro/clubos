import { useEffect, useMemo, useRef, useState } from 'react';
import FormationField from '../../components/FormationField/FormationField';
import FormationPicker from '../../components/FormationPicker/FormationPicker';
import { useGame } from '../../context/GameContext';
import type { FormationKey, TacticsDraft } from '../../types/Tactics';
import {
  buildBestLineup,
  countFilledSlots,
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
  const { state, saveTactics } = useGame();
  const players = state.players;
  const primaryColor = state.team?.primaryColor ?? DEFAULT_PRIMARY;
  const secondaryColor = state.team?.secondaryColor ?? DEFAULT_SECONDARY;

  const saved = useMemo(() => resolveTactics(state.tactics, players), [state.tactics, players]);
  const [draft, setDraft] = useState<TacticsDraft>(saved);
  const [justSaved, setJustSaved] = useState(false);

  const syncedFrom = useRef(state.tactics);
  useEffect(() => {
    if (syncedFrom.current === state.tactics) return;
    syncedFrom.current = state.tactics;
    setDraft(resolveTactics(state.tactics, players));
  }, [state.tactics, players]);

  const preset = getFormationPreset(draft.formationKey);
  const total = preset.slots.length;
  const filled = countFilledSlots(draft.formation, draft.formationKey, players);
  const complete = filled === total;
  const dirty = signature(draft) !== signature(saved);
  const warnings = lineupWarnings(draft.formation, draft.formationKey, players, draft.bench);
  const average = lineupAverageOverall(draft.formation, players);

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
    saveTactics({
      formationKey: draft.formationKey,
      style: draft.style || DEFAULT_STYLE_KEY,
      formation: normalizeFormation(draft.formation, draft.formationKey, players),
      bench: draft.bench,
    });
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2000);
  }

  const savedAt = state.tactics?.updatedAt
    ? new Date(state.tactics.updatedAt).toLocaleString('pt-BR', {
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
            Escolha a formação e a variante, depois monte titulares e banco.
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
            onClick={() => setDraft(saved)}
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
