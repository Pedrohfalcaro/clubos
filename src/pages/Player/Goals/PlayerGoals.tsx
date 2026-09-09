import { useMemo, useState } from 'react';
import { useGame } from '../../../context/GameContext';
import type { MonthlyGoal, MonthlyGoalMetric } from '../../../types/PlayerGoal';
import {
  metricForPosition,
  suggestedTarget,
  computeMonthlyProgress,
  MONTHLY_GOAL_METRIC_LABELS,
} from '../../../utils/playerMonthlyGoals';
import shared from '../PlayerShared.module.css';
import styles from '../../Dashboard/Dashboard.module.css';
import extra from './PlayerGoals.module.css';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function PlayerGoals() {
  const { state, setMonthlyGoal } = useGame();
  const player = state.careerPlayer;

  const currentYear = state.currentDate ? Number(state.currentDate.slice(0, 4)) : null;
  const currentMonth = state.currentDate ? Number(state.currentDate.slice(5, 7)) : null;

  const currentGoal = useMemo(() => {
    if (!player || currentYear == null || currentMonth == null) return undefined;
    return player.monthlyGoals.find(g => g.year === currentYear && g.month === currentMonth);
  }, [player, currentYear, currentMonth]);

  const defaultMetric = player ? metricForPosition(player.position) : 'goals';
  const [editing, setEditing] = useState(!currentGoal);
  const [metric, setMetric] = useState<MonthlyGoalMetric>(currentGoal?.metric ?? defaultMetric);
  const [target, setTarget] = useState(currentGoal?.target ?? suggestedTarget(defaultMetric));
  const [useRating, setUseRating] = useState(currentGoal?.ratingTarget != null);
  const [ratingTarget, setRatingTarget] = useState(currentGoal?.ratingTarget ?? 7);

  const history = useMemo(() => {
    if (!player) return [];
    return [...player.monthlyGoals]
      .filter(g => g.id !== currentGoal?.id)
      .sort((a, b) => (b.year - a.year) || (b.month - a.month));
  }, [player, currentGoal]);

  if (!player) return null;

  function startEditing() {
    setMetric(currentGoal?.metric ?? defaultMetric);
    setTarget(currentGoal?.target ?? suggestedTarget(currentGoal?.metric ?? defaultMetric));
    setUseRating(currentGoal?.ratingTarget != null);
    setRatingTarget(currentGoal?.ratingTarget ?? 7);
    setEditing(true);
  }

  function handleSave() {
    setMonthlyGoal(metric, target, useRating ? ratingTarget : undefined);
    setEditing(false);
  }

  function progressBar(goal: MonthlyGoal) {
    const progress = computeMonthlyProgress(state.matches, goal);
    const pct = Math.min(100, Math.round((progress.metricValue / Math.max(1, goal.target)) * 100));
    const achieved = progress.metMetric && (progress.metRating ?? true);
    return { progress, pct, achieved };
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Metas</h1>
          <p className={styles.sub}>Metas mensais de desempenho — {player.currentClub.name}</p>
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {currentYear != null && currentMonth != null
            ? `${MONTH_NAMES[currentMonth - 1]} de ${currentYear}`
            : 'Mês atual'}
        </h2>

        {!state.currentDate ? (
          <div className={styles.empty}>Ative o calendário contínuo (Dashboard) para definir metas mensais.</div>
        ) : editing ? (
          <div className={extra.form}>
            <div className={extra.formRow}>
              <label>
                <span>Meta principal</span>
                <select
                  className={extra.input}
                  value={metric}
                  onChange={e => {
                    const m = e.target.value as MonthlyGoalMetric;
                    setMetric(m);
                    setTarget(suggestedTarget(m));
                  }}
                >
                  {(Object.keys(MONTHLY_GOAL_METRIC_LABELS) as MonthlyGoalMetric[]).map(m => (
                    <option key={m} value={m}>{MONTHLY_GOAL_METRIC_LABELS[m]}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Alvo no mês</span>
                <input
                  className={extra.input}
                  type="number"
                  min={1}
                  value={target}
                  onChange={e => setTarget(Number(e.target.value))}
                />
              </label>
            </div>
            <label className={extra.checkboxRow}>
              <input type="checkbox" checked={useRating} onChange={e => setUseRating(e.target.checked)} />
              <span>Também definir nota média alvo</span>
            </label>
            {useRating && (
              <input
                className={extra.input}
                type="number"
                min={1}
                max={10}
                step={0.1}
                value={ratingTarget}
                onChange={e => setRatingTarget(Number(e.target.value))}
                style={{ maxWidth: 120 }}
              />
            )}
            <div className={extra.formActions}>
              {currentGoal && (
                <button type="button" className={extra.ghostBtn} onClick={() => setEditing(false)}>Cancelar</button>
              )}
              <button type="button" className={extra.saveBtn} onClick={handleSave}>Salvar meta</button>
            </div>
          </div>
        ) : currentGoal ? (
          (() => {
            const { progress, pct, achieved } = progressBar(currentGoal);
            return (
              <div className={extra.currentCard}>
                <div className={extra.currentHead}>
                  <span className={extra.metricLabel}>{MONTHLY_GOAL_METRIC_LABELS[currentGoal.metric]}</span>
                  <button type="button" className={extra.ghostBtn} onClick={startEditing}>Editar</button>
                </div>
                <div className={shared.confidenceTrack}>
                  <div
                    className={shared.confidenceFill}
                    style={{ width: `${pct}%`, background: achieved ? 'var(--success)' : 'var(--accent)' }}
                  />
                </div>
                <p className={extra.progressText}>
                  {progress.metricValue} / {currentGoal.target} — {progress.matchesPlayed} partida{progress.matchesPlayed === 1 ? '' : 's'} no mês
                </p>
                {currentGoal.ratingTarget != null && (
                  <p className={extra.progressText}>
                    Nota média: {progress.avgRating != null ? progress.avgRating.toFixed(1) : '—'} / {currentGoal.ratingTarget.toFixed(1)}
                    {progress.metRating ? ' ✓' : ''}
                  </p>
                )}
              </div>
            );
          })()
        ) : (
          <div className={styles.empty}>
            Nenhuma meta definida este mês.{' '}
            <button type="button" onClick={startEditing}>Definir agora</button>
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Histórico</h2>
          <div className={extra.historyList}>
            {history.map(goal => {
              const { progress, achieved } = progressBar(goal);
              return (
                <div key={goal.id} className={extra.historyRow}>
                  <span className={extra.historyMonth}>{MONTH_NAMES[goal.month - 1]} {goal.year}</span>
                  <span className={extra.historyMetric}>{MONTHLY_GOAL_METRIC_LABELS[goal.metric]}</span>
                  <span className={extra.historyValue}>{progress.metricValue} / {goal.target}</span>
                  <span className={achieved ? extra.badgeOk : extra.badgeMiss}>
                    {achieved ? 'Batida' : 'Não batida'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
