import { useMemo, useState } from 'react';
import MinuteInput from '../../../components/MinuteInput/MinuteInput';
import SearchableSelect from '../../../components/SearchableSelect/SearchableSelect';
import SubstitutionModal from '../../../components/SubstitutionModal/SubstitutionModal';
import type { Player } from '../../../types/Player';
import type {
  MatchMinute,
  SubstitutionEvent,
  TeamGoalEntry,
  TeamInjuryEntry,
} from '../../../types/Match';
import { defaultMinute, uid } from '../../../utils/matchEvents';
import {
  getFieldPlayerIds,
  getBenchAvailableIds,
  isPlayerOnField,
} from '../../../utils/matchPlayHelpers';
import styles from './steps.module.css';

interface TeamGoalsStepProps {
  teamName: string;
  players: Player[];
  starters: string[];
  bench: string[];
  teamGoals: TeamGoalEntry[];
  onTeamGoalsChange: (g: TeamGoalEntry[]) => void;
  teamSubs: SubstitutionEvent[];
  onTeamSubsChange: (s: SubstitutionEvent[]) => void;
  injuries: TeamInjuryEntry[];
}

export default function TeamGoalsStep({
  teamName,
  players,
  starters,
  bench,
  teamGoals,
  onTeamGoalsChange,
  teamSubs,
  onTeamSubsChange,
  injuries,
}: TeamGoalsStepProps) {
  const [subModal, setSubModal] = useState<{ playerIn: Player; goalIndex: number } | null>(null);

  const fieldIds = useMemo(
    () => getFieldPlayerIds(starters, teamSubs, injuries),
    [starters, teamSubs, injuries],
  );

  const fieldOptions = useMemo(
    () =>
      [...fieldIds]
        .map(id => players.find(p => p.id === id))
        .filter(Boolean)
        .map(p => ({ value: p!.id, label: p!.name })),
    [fieldIds, players],
  );

  const squadOptions = useMemo(() => {
    const permanentlyAvailable = new Set([
      ...fieldIds,
      ...getBenchAvailableIds(starters, bench, teamSubs, injuries),
    ]);
    return [...permanentlyAvailable]
      .map(id => players.find(p => p.id === id))
      .filter(Boolean)
      .map(p => ({ value: p!.id, label: p!.name }));
  }, [fieldIds, starters, bench, teamSubs, injuries, players]);

  function resolve(id: string) {
    return players.find(p => p.id === id);
  }

  function updateGoal(index: number, patch: Partial<TeamGoalEntry>) {
    onTeamGoalsChange(teamGoals.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  function handleScorerPick(index: number, playerId: string) {
    if (!playerId) {
      updateGoal(index, { playerId: '', type: 'team' });
      return;
    }
    if (isPlayerOnField(playerId, starters, teamSubs, injuries)) {
      updateGoal(index, { playerId, type: 'team', opponentScorerName: undefined });
      return;
    }
    const p = resolve(playerId);
    if (!p) return;
    setSubModal({ playerIn: p, goalIndex: index });
  }

  function handleSubConfirm(data: { playerInId: string; playerOutId: string; minute: MatchMinute }) {
    if (!subModal) return;
    const pin = resolve(data.playerInId);
    const pout = resolve(data.playerOutId);
    if (!pin || !pout) return;
    onTeamSubsChange([
      ...teamSubs,
      {
        id: uid(),
        playerInId: data.playerInId,
        playerInName: pin.name,
        playerOutId: data.playerOutId,
        playerOutName: pout.name,
        minute: data.minute,
        side: 'team',
      },
    ]);
    updateGoal(subModal.goalIndex, {
      playerId: data.playerInId,
      type: 'team',
      minute: data.minute,
      opponentScorerName: undefined,
    });
    setSubModal(null);
  }

  const onFieldForModal = [...fieldIds]
    .map(id => resolve(id))
    .filter(Boolean)
    .map(p => ({ id: p!.id, name: p!.name }));

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        Gols de <strong>{teamName}</strong>. Assistência é opcional.
      </p>

      <div className={styles.goalList}>
        {teamGoals.map((g, index) => (
          <div key={g.id} className={styles.goalCard}>
            <div className={styles.goalHead}>
              <span className={styles.goalIndex}>Gol {index + 1}</span>
              <div className={styles.toggleRow}>
                <button
                  type="button"
                  className={`${styles.chip} ${g.type === 'team' ? styles.chipOn : ''}`}
                  onClick={() =>
                    updateGoal(index, {
                      type: 'team',
                      opponentScorerName: undefined,
                      playerId: g.playerId ?? '',
                    })
                  }
                >
                  Nosso
                </button>
                <button
                  type="button"
                  className={`${styles.chip} ${g.type === 'own' ? styles.chipOn : ''}`}
                  onClick={() =>
                    updateGoal(index, {
                      type: 'own',
                      playerId: undefined,
                      assistPlayerId: undefined,
                    })
                  }
                >
                  Contra
                </button>
              </div>
            </div>

            {g.type === 'own' ? (
              <div className={`${styles.fields} ${styles.fieldsWide}`}>
                <div className={styles.field}>
                  <label>Quem marcou (adversário)</label>
                  <input
                    className={styles.input}
                    value={g.opponentScorerName ?? ''}
                    onChange={e => updateGoal(index, { opponentScorerName: e.target.value })}
                    placeholder="Nome do jogador"
                  />
                </div>
                <div className={styles.field}>
                  <label>Minuto</label>
                  <MinuteInput
                    value={g.minute}
                    onChange={m => updateGoal(index, { minute: m })}
                  />
                </div>
              </div>
            ) : (
              <div className={styles.fields}>
                <div className={styles.field}>
                  <label>Autor</label>
                  <SearchableSelect
                    options={squadOptions}
                    value={g.playerId ?? ''}
                    onChange={v => handleScorerPick(index, v)}
                    placeholder="Quem marcou..."
                  />
                </div>
                <div className={styles.field}>
                  <label>Assistência</label>
                  <SearchableSelect
                    options={[
                      { value: '', label: 'Sem assistência' },
                      ...fieldOptions.filter(o => o.value !== g.playerId),
                    ]}
                    value={g.assistPlayerId ?? ''}
                    onChange={v => updateGoal(index, { assistPlayerId: v || undefined })}
                    placeholder="Opcional"
                  />
                </div>
                <div className={styles.field}>
                  <label>Minuto</label>
                  <MinuteInput
                    value={g.minute ?? defaultMinute()}
                    onChange={m => updateGoal(index, { minute: m })}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {subModal && (
        <SubstitutionModal
          open
          required
          title="Substituição necessária"
          playerIn={{ id: subModal.playerIn.id, name: subModal.playerIn.name }}
          onFieldOptions={onFieldForModal}
          onClose={() => setSubModal(null)}
          onConfirm={handleSubConfirm}
        />
      )}
    </div>
  );
}
