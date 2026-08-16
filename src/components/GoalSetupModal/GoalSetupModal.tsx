import { useMemo, useState } from 'react';
import type { SeasonCompetition } from '../../types/Competition';
import { KNOCKOUT_STAGE_RANK } from '../../types/Competition';
import { hasKnockoutStage, hasLeagueStage } from '../../utils/competitionEngine';
import { defaultLeagueTargetForTier } from '../../utils/boardGoals';
import type { BoardGoal, BoardGoalPriority, CupStage, LeagueTier } from '../../types/Board';
import { CUP_STAGE_LABELS, LEAGUE_TIER_LABELS, PRIORITY_LABELS } from '../../types/Board';
import styles from './GoalSetupModal.module.css';

const LEAGUE_TIERS: LeagueTier[] = ['champion', 'g4', 'continental', 'mid_table', 'relegation_escape'];
const CUP_STAGES: CupStage[] = ['r16', 'qf', 'sf', 'final', 'champion'];
const PRIORITIES: BoardGoalPriority[] = ['low', 'medium', 'high', 'critical'];

type GoalMode = 'league' | 'cup';

export interface GoalSetupModalProps {
  competition: SeasonCompetition;
  season: number;
  onSubmit: (goal: BoardGoal) => void;
  onSkip: () => void;
}

export default function GoalSetupModal({ competition, season, onSubmit, onSkip }: GoalSetupModalProps) {
  // Em competições liga + mata-mata (`league_knockout`), só a fase da copa é oferecida como
  // meta — a fase de liga ali é só classificatória, não é o objetivo em si.
  const canCup = hasKnockoutStage(competition.format);
  const canLeague = hasLeagueStage(competition.format) && !canCup;

  const mode: GoalMode = canLeague ? 'league' : 'cup';
  const [tier, setTier] = useState<LeagueTier>('g4');
  const [cupStage, setCupStage] = useState<CupStage>('sf');
  const [priority, setPriority] = useState<BoardGoalPriority>('medium');
  const [totalMatchdays, setTotalMatchdays] = useState('38');

  const teamCount = competition.leagueTable?.length ?? 20;
  const suggestedTarget = useMemo(
    () => defaultLeagueTargetForTier(tier, teamCount),
    [tier, teamCount],
  );
  const [target, setTarget] = useState(String(suggestedTarget));

  function applyTier(t: LeagueTier) {
    setTier(t);
    setTarget(String(defaultLeagueTargetForTier(t, teamCount)));
  }

  function submit() {
    if (mode === 'league') {
      const n = parseInt(target, 10);
      if (isNaN(n) || n < 1) return;
      const rounds = Math.max(1, parseInt(totalMatchdays, 10) || 38);
      const goal: BoardGoal = {
        id: `goal-${Date.now()}`,
        season,
        kind: 'league_position',
        label: `${LEAGUE_TIER_LABELS[tier]} — ${competition.name}`,
        target: n,
        current: 0,
        status: 'active',
        competitionId: competition.id,
        priority,
        leagueTier: tier,
        totalMatchdays: rounds,
        pacingTickedGames: 0,
      };
      onSubmit(goal);
      return;
    }

    if (cupStage === 'champion') {
      const goal: BoardGoal = {
        id: `goal-${Date.now()}`,
        season,
        kind: 'win_competition',
        label: `Campeão — ${competition.name}`,
        target: 1,
        current: 0,
        status: 'active',
        competitionId: competition.id,
        priority,
        cupStageTarget: 'champion',
      };
      onSubmit(goal);
      return;
    }

    const goal: BoardGoal = {
      id: `goal-${Date.now()}`,
      season,
      kind: 'cup_stage',
      label: `${CUP_STAGE_LABELS[cupStage]} — ${competition.name}`,
      target: KNOCKOUT_STAGE_RANK[cupStage],
      current: 0,
      status: 'active',
      competitionId: competition.id,
      priority,
      cupStageTarget: cupStage,
    };
    onSubmit(goal);
  }

  return (
    <div className={styles.overlay} onClick={onSkip}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <p className={styles.title}>Definir meta da temporada</p>
        <p className={styles.subtitle}>{competition.name}</p>

        {mode === 'league' && canLeague && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Faixa desejada</label>
              <div className={styles.tierGrid}>
                {LEAGUE_TIERS.map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`${styles.tierBtn} ${tier === t ? styles.tierActive : ''}`}
                    onClick={() => applyTier(t)}
                  >
                    {LEAGUE_TIER_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Posição alvo</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min={1}
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Rodadas totais</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min={1}
                  value={totalMatchdays}
                  onChange={e => setTotalMatchdays(e.target.value)}
                />
              </div>
            </div>
            <span className={styles.hint}>
              Usado para saber o ritmo do campeonato e avisar quando as rodadas terminarem.
            </span>
          </>
        )}

        {mode === 'cup' && canCup && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Fase mínima desejada</label>
            <div className={styles.tierGrid}>
              {CUP_STAGES.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`${styles.tierBtn} ${cupStage === s ? styles.tierActive : ''}`}
                  onClick={() => setCupStage(s)}
                >
                  {CUP_STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Prioridade</label>
          <div className={styles.tierGrid}>
            {PRIORITIES.map(p => (
              <button
                key={p}
                type="button"
                className={`${styles.tierBtn} ${priority === p ? styles.tierActive : ''}`}
                onClick={() => setPriority(p)}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
          <span className={styles.hint}>
            Prioridades mais altas aumentam o impacto na Confiança da Diretoria ao concluir ou falhar.
          </span>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.btnSecondary} onClick={onSkip}>
            Pular
          </button>
          <button type="button" className={styles.btnPrimary} onClick={submit}>
            Definir meta
          </button>
        </div>
      </div>
    </div>
  );
}
