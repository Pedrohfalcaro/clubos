import { useState } from 'react';
import { useGame } from '../../../context/GameContext';
import type { NationalBoardGoalKind, NationalBoardGoalStatus } from '../../../types/NationalTeam';
import { formatGameDate } from '../../../livelife';
import styles from './NationalBoard.module.css';

const GOAL_KINDS: NationalBoardGoalKind[] = ['reach_stage', 'win_tournament', 'avoid_relegation_ranking'];

const GOAL_KIND_LABELS: Record<NationalBoardGoalKind, string> = {
  reach_stage: 'Chegar em uma fase',
  win_tournament: 'Vencer um torneio',
  avoid_relegation_ranking: 'Não cair do ranking',
};

const GOAL_KIND_HINTS: Record<NationalBoardGoalKind, string> = {
  reach_stage: 'Descreva a fase na meta (ex.: "Chegar às quartas de final"). Marque como concluída quando bater.',
  win_tournament: 'Descreva o torneio na meta (ex.: "Vencer a Copa América 2028"). Marque como concluída quando bater.',
  avoid_relegation_ranking: 'Defina a posição mínima do ranking (ex.: 30 = não cair do Top 30).',
};

const STATUS_LABELS: Record<NationalBoardGoalStatus, string> = {
  active: 'Ativa',
  done: 'Concluída',
  failed: 'Fracassada',
};

export default function NationalBoard() {
  const { state, addNationalGoal, updateNationalGoal, removeNationalGoal, adjustFederationMood } = useGame();
  const nationalTeam = state.nationalTeam;
  const [showCreate, setShowCreate] = useState(false);
  const [moodReason, setMoodReason] = useState('');

  if (!nationalTeam) return null;

  const moodTone =
    nationalTeam.federationMood >= 65 ? styles.moodHigh : nationalTeam.federationMood >= 35 ? styles.moodMid : styles.moodLow;

  function applyMoodDelta(delta: number) {
    adjustFederationMood(delta, moodReason.trim() || (delta > 0 ? 'Ajuste manual (+)' : 'Ajuste manual (-)'));
    setMoodReason('');
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Federação</p>
          <h1 className={styles.title}>Diretoria</h1>
        </div>
      </header>

      <section className={styles.moodCard}>
        <div className={styles.moodTop}>
          <span className={styles.moodLabel}>Moral da Federação</span>
          <span className={`${styles.moodValue} ${moodTone}`}>{nationalTeam.federationMood}%</span>
        </div>
        <div className={styles.moodTrack}>
          <div className={`${styles.moodFill} ${moodTone}`} style={{ width: `${nationalTeam.federationMood}%` }} />
        </div>
        <div className={styles.moodAdjust}>
          <input
            className={styles.moodReasonInput}
            type="text"
            placeholder="Motivo (opcional)"
            value={moodReason}
            onChange={e => setMoodReason(e.target.value)}
          />
          <button type="button" className={styles.moodBtn} onClick={() => applyMoodDelta(-5)}>
            −5
          </button>
          <button type="button" className={styles.moodBtn} onClick={() => applyMoodDelta(5)}>
            +5
          </button>
        </div>
        {nationalTeam.federationMoodHistory.length > 0 && (
          <ul className={styles.moodHistory}>
            {nationalTeam.federationMoodHistory.slice(0, 8).map((h, i) => (
              <li key={i}>
                <span className={styles.moodHistoryDate}>
                  {formatGameDate(h.date, { day: '2-digit', month: 'short' })}
                </span>
                <span>{h.reason}</span>
                <span className={styles.moodHistoryValue}>{h.value}%</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={styles.goalsHeader}>
        <p className={styles.sectionTitle}>Metas da Federação</p>
        <button type="button" className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
          + Nova meta
        </button>
      </div>

      {nationalTeam.goals.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nenhuma meta cadastrada ainda.</p>
          <p className={styles.emptyHint}>Crie metas de fase, torneio ou ranking para acompanhar a cobrança da federação.</p>
        </div>
      ) : (
        <ul className={styles.goalList}>
          {nationalTeam.goals.map(goal => (
            <li key={goal.id} className={styles.goalCard}>
              <div className={styles.goalHead}>
                <span className={styles.kindBadge}>{GOAL_KIND_LABELS[goal.kind]}</span>
                <span className={`${styles.statusBadge} ${styles[`status_${goal.status}`]}`}>
                  {STATUS_LABELS[goal.status]}
                </span>
              </div>
              <p className={styles.goalLabel}>{goal.label}</p>

              {goal.kind === 'avoid_relegation_ranking' ? (
                <p className={styles.goalProgressText}>
                  Ranking atual: #{nationalTeam.fifaRanking} · meta: não cair de #{goal.target}
                </p>
              ) : (
                <div className={styles.goalStepper}>
                  <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={() => updateNationalGoal(goal.id, { current: Math.max(0, goal.current - 1) })}
                  >
                    −
                  </button>
                  <span className={styles.stepperValue}>
                    {goal.current}/{goal.target}
                  </span>
                  <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={() => updateNationalGoal(goal.id, { current: goal.current + 1 })}
                  >
                    +
                  </button>
                </div>
              )}

              <div className={styles.goalActions}>
                <select
                  className={styles.statusSelect}
                  value={goal.status}
                  onChange={e =>
                    updateNationalGoal(goal.id, { status: e.target.value as NationalBoardGoalStatus })
                  }
                >
                  <option value="active">Ativa</option>
                  <option value="done">Concluída</option>
                  <option value="failed">Fracassada</option>
                </select>
                <button type="button" className={styles.removeBtn} onClick={() => removeNationalGoal(goal.id)}>
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateGoalModal
          onSubmit={input => {
            addNationalGoal(input);
            setShowCreate(false);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function CreateGoalModal({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: { kind: NationalBoardGoalKind; label: string; target: number }) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<NationalBoardGoalKind>('reach_stage');
  const [label, setLabel] = useState('');
  const [target, setTarget] = useState('1');

  const targetNum = parseInt(target, 10);
  const canSubmit = label.trim().length > 0 && Number.isInteger(targetNum) && targetNum > 0;

  function submit() {
    if (!canSubmit) return;
    onSubmit({ kind, label: label.trim(), target: targetNum });
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <p className={styles.modalTitle}>Nova meta</p>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Tipo</label>
          <div className={styles.pillGrid}>
            {GOAL_KINDS.map(k => (
              <button
                key={k}
                type="button"
                className={`${styles.pillBtn} ${kind === k ? styles.pillActive : ''}`}
                onClick={() => setKind(k)}
              >
                {GOAL_KIND_LABELS[k]}
              </button>
            ))}
          </div>
          <span className={styles.hint}>{GOAL_KIND_HINTS[kind]}</span>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Descrição</label>
          <input
            className={styles.formInput}
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="ex.: Chegar às quartas de final"
            autoFocus
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>
            {kind === 'avoid_relegation_ranking' ? 'Posição mínima do ranking' : 'Meta (número)'}
          </label>
          <input
            className={styles.formInput}
            type="number"
            min={1}
            value={target}
            onChange={e => setTarget(e.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.btnSecondary} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={styles.btnPrimary} onClick={submit} disabled={!canSubmit}>
            Criar meta
          </button>
        </div>
      </div>
    </div>
  );
}
