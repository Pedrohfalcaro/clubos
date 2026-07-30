import { useState } from 'react';
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
  getEligiblePlayerIdsForEvent,
  getFieldPlayerIdsAtMinute,
  isPlayerOnFieldAtMinute,
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

type SubRole = 'scorer' | 'assist';

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
  const [subModal, setSubModal] = useState<{
    playerIn: Player;
    goalIndex: number;
    role: SubRole;
  } | null>(null);

  function resolve(id: string) {
    return players.find(p => p.id === id);
  }

  function optionsForMinute(at: MatchMinute, keepIds: (string | undefined)[]) {
    const ids = new Set(getEligiblePlayerIdsForEvent(starters, bench, teamSubs, at, injuries));
    for (const id of keepIds) {
      if (id) ids.add(id);
    }
    return [...ids]
      .map(id => resolve(id))
      .filter(Boolean)
      .map(p => ({ value: p!.id, label: p!.name }));
  }

  function updateGoal(index: number, patch: Partial<TeamGoalEntry>) {
    onTeamGoalsChange(teamGoals.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  function pickParticipant(index: number, playerId: string, role: SubRole) {
    if (!playerId) {
      if (role === 'scorer') updateGoal(index, { playerId: '', type: 'team' });
      else updateGoal(index, { assistPlayerId: undefined });
      return;
    }

    const goal = teamGoals[index];
    const at = goal?.minute ?? defaultMinute();

    if (isPlayerOnFieldAtMinute(playerId, starters, teamSubs, at, injuries)) {
      if (role === 'scorer') {
        updateGoal(index, { playerId, type: 'team', opponentScorerName: undefined });
      } else {
        updateGoal(index, { assistPlayerId: playerId });
      }
      return;
    }

    const p = resolve(playerId);
    if (!p) return;
    setSubModal({ playerIn: p, goalIndex: index, role });
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

    if (subModal.role === 'scorer') {
      updateGoal(subModal.goalIndex, {
        playerId: data.playerInId,
        type: 'team',
        minute: data.minute,
        opponentScorerName: undefined,
      });
    } else {
      updateGoal(subModal.goalIndex, { assistPlayerId: data.playerInId });
    }
    setSubModal(null);
  }

  const modalGoal = subModal ? teamGoals[subModal.goalIndex] : null;
  const modalMinute = modalGoal?.minute ?? defaultMinute();
  const onFieldForModal = subModal
    ? [...getFieldPlayerIdsAtMinute(starters, teamSubs, modalMinute, injuries)]
        .map(id => players.find(p => p.id === id))
        .filter(Boolean)
        .map(p => ({ id: p!.id, name: p!.name }))
    : [];

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        Gols de <strong>{teamName}</strong>. Assistência é opcional.
      </p>

      <div className={styles.goalList}>
        {teamGoals.map((g, index) => {
          const at = g.minute ?? defaultMinute();
          const squadOptions = optionsForMinute(at, [g.playerId, g.assistPlayerId]);
          const assistOptions = [
            { value: '', label: 'Sem assistência' },
            ...squadOptions.filter(o => o.value !== g.playerId),
          ];

          return (
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
                      onChange={v => pickParticipant(index, v, 'scorer')}
                      placeholder="Quem marcou..."
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Assistência</label>
                    <SearchableSelect
                      options={assistOptions}
                      value={g.assistPlayerId ?? ''}
                      onChange={v => pickParticipant(index, v, 'assist')}
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
          );
        })}
      </div>

      {subModal && (
        <SubstitutionModal
          key={`${subModal.playerIn.id}-${subModal.role}-${subModal.goalIndex}`}
          open
          required
          title="Substituição necessária"
          playerIn={{ id: subModal.playerIn.id, name: subModal.playerIn.name }}
          onFieldOptions={onFieldForModal}
          initialMinute={modalMinute}
          onClose={() => setSubModal(null)}
          onConfirm={handleSubConfirm}
        />
      )}
    </div>
  );
}
