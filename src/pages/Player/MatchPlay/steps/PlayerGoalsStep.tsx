import type { Teammate } from '../../../../types/Teammate';
import type { TeamGoalEntry, MatchMinute } from '../../../../types/Match';
import MinuteInput from '../../../../components/MinuteInput/MinuteInput';
import { defaultMinute } from '../../../../utils/matchEvents';
import stepStyles from '../../../MatchPlay/steps/steps.module.css';
import extra from '../PlayerMatchPlay.module.css';

interface ScorerOption {
  id: string;
  name: string;
  gold: boolean;
}

interface PlayerGoalsStepProps {
  teamName: string;
  selfId: string;
  selfName: string;
  /** Falso quando você não jogou (reserva que não entrou / não relacionado) — só colegas marcam. */
  includeSelf: boolean;
  teammates: Teammate[];
  teamGoals: TeamGoalEntry[];
  onTeamGoalsChange: (goals: TeamGoalEntry[]) => void;
}

export default function PlayerGoalsStep({
  teamName,
  selfId,
  selfName,
  includeSelf,
  teammates,
  teamGoals,
  onTeamGoalsChange,
}: PlayerGoalsStepProps) {
  const scorerOptions: ScorerOption[] = [
    ...(includeSelf ? [{ id: selfId, name: selfName, gold: true }] : []),
    ...teammates
      .slice()
      .sort((a, b) => a.number - b.number)
      .map(t => ({ id: t.id, name: `${t.name} (${t.number})`, gold: false })),
  ];

  function update(index: number, patch: Partial<TeamGoalEntry>) {
    onTeamGoalsChange(teamGoals.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  return (
    <div className={stepStyles.wrap}>
      <p className={stepStyles.hint}>
        Gols de <strong>{teamName}</strong>.
        {includeSelf ? ' Seu nome vem primeiro na lista.' : ' Você não jogou — só colegas podem ter marcado.'}
      </p>

      <div className={stepStyles.goalList}>
        {teamGoals.map((g, index) => {
          const assistOptions = scorerOptions.filter(o => o.id !== g.playerId);
          return (
            <div key={g.id} className={stepStyles.goalCard}>
              <div className={stepStyles.goalHead}>
                <span className={stepStyles.goalIndex}>Gol {index + 1}</span>
              </div>
              <div className={`${stepStyles.fields} ${stepStyles.fieldsWide}`}>
                <div className={stepStyles.field}>
                  <label>Autor</label>
                  <select
                    className={extra.select}
                    value={g.playerId ?? ''}
                    onChange={e => update(index, { playerId: e.target.value || undefined })}
                  >
                    <option value="">Quem marcou...</option>
                    {scorerOptions.map(o => (
                      <option key={o.id} value={o.id} style={o.gold ? { color: '#d4af37', fontWeight: 700 } : undefined}>
                        {o.gold ? '★ ' : ''}{o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={stepStyles.field}>
                  <label>Assistência</label>
                  <select
                    className={extra.select}
                    value={g.assistPlayerId ?? ''}
                    onChange={e => update(index, { assistPlayerId: e.target.value || undefined })}
                  >
                    <option value="">Sem assistência</option>
                    {assistOptions.map(o => (
                      <option key={o.id} value={o.id} style={o.gold ? { color: '#d4af37', fontWeight: 700 } : undefined}>
                        {o.gold ? '★ ' : ''}{o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={stepStyles.field}>
                  <label>Minuto</label>
                  <MinuteInput
                    value={g.minute ?? defaultMinute()}
                    onChange={(m: MatchMinute) => update(index, { minute: m })}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
