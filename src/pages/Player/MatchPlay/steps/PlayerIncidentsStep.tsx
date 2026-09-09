import { useState } from 'react';
import type { TeamCardEntry, MatchMinute } from '../../../../types/Match';
import type { Teammate } from '../../../../types/Teammate';
import MinuteInput from '../../../../components/MinuteInput/MinuteInput';
import { addDaysIso } from '../../../../livelife';
import { defaultMinute, formatMinute, uid } from '../../../../utils/matchEvents';
import stepStyles from '../../../MatchPlay/steps/steps.module.css';

export interface PlayerInjuryDraft {
  minute: MatchMinute;
  type: string;
  returnDate: string;
}

export interface SubOutDraft {
  minute: MatchMinute;
  replacementId: string;
  replacementName: string;
}

type FormKind = 'yellow' | 'red' | 'injury' | 'sub' | null;

interface PlayerIncidentsStepProps {
  selfId: string;
  selfName: string;
  currentDate: string | null;
  teammates: Teammate[];
  cards: TeamCardEntry[];
  onCardsChange: (cards: TeamCardEntry[]) => void;
  injury: PlayerInjuryDraft | null;
  onInjuryChange: (injury: PlayerInjuryDraft | null) => void;
  subOut: SubOutDraft | null;
  onSubOutChange: (subOut: SubOutDraft | null) => void;
}

export default function PlayerIncidentsStep({
  selfId,
  selfName,
  currentDate,
  teammates,
  cards,
  onCardsChange,
  injury,
  onInjuryChange,
  subOut,
  onSubOutChange,
}: PlayerIncidentsStepProps) {
  const [form, setForm] = useState<FormKind>(null);
  const [minute, setMinute] = useState<MatchMinute>(defaultMinute());
  const [injuryType, setInjuryType] = useState('');
  const [returnDate, setReturnDate] = useState(() => addDaysIso(currentDate ?? new Date().toISOString().slice(0, 10), 14));
  const [replacementId, setReplacementId] = useState('');

  function resetForm() {
    setForm(null);
    setMinute(defaultMinute());
    setInjuryType('');
    setReturnDate(addDaysIso(currentDate ?? new Date().toISOString().slice(0, 10), 14));
    setReplacementId('');
  }

  function submitCard(type: 'yellow' | 'red') {
    onCardsChange([...cards, { id: uid(), playerId: selfId, playerName: selfName, type, minute }]);
    resetForm();
  }

  function submitInjury() {
    if (!injuryType.trim() || !returnDate) return;
    onInjuryChange({ minute, type: injuryType.trim(), returnDate });
    // Lesão obriga sair de campo — já abre a substituição com o mesmo minuto.
    setForm('sub');
    setMinute(minute);
    setInjuryType('');
    setReturnDate(addDaysIso(currentDate ?? new Date().toISOString().slice(0, 10), 14));
  }

  function submitSub() {
    const t = teammates.find(x => x.id === replacementId);
    if (!t) return;
    onSubOutChange({ minute, replacementId: t.id, replacementName: t.name });
    resetForm();
  }

  return (
    <div className={stepStyles.wrap}>
      <p className={stepStyles.hint}>
        Suas incidências na partida — cartão ou lesão já marcam seu nome, só falta o minuto.
      </p>

      {injury && !subOut && (
        <p className={stepStyles.fieldError}>
          Lesão registrada aos {formatMinute(injury.minute)} — você precisa sair de campo. Registre quem entrou no seu lugar.
        </p>
      )}

      {!form && (
        <div className={stepStyles.eventActions}>
          <button type="button" className={stepStyles.eventBtn} onClick={() => setForm('yellow')}>
            <span className={stepStyles.eventIcon}>🟨</span>
            Cartão amarelo
          </button>
          <button type="button" className={stepStyles.eventBtn} onClick={() => setForm('red')}>
            <span className={stepStyles.eventIcon}>🟥</span>
            Cartão vermelho
          </button>
          {!injury && (
            <button type="button" className={stepStyles.eventBtn} onClick={() => setForm('injury')}>
              <span className={stepStyles.eventIconInjury} aria-hidden>✚</span>
              Lesão
            </button>
          )}
          {!subOut && (
            <button type="button" className={stepStyles.eventBtn} onClick={() => setForm('sub')}>
              <span className={stepStyles.eventIcon}>🔄</span>
              Substituição
            </button>
          )}
        </div>
      )}

      {(form === 'yellow' || form === 'red') && (
        <div className={stepStyles.formSheet}>
          <h3 className={stepStyles.formSheetTitle}>
            {form === 'yellow' ? 'Cartão amarelo' : 'Cartão vermelho'} — {selfName}
          </h3>
          <div className={stepStyles.field}>
            <label>Minuto</label>
            <MinuteInput value={minute} onChange={setMinute} />
          </div>
          <div className={stepStyles.formActions}>
            <button type="button" className={stepStyles.ghostBtn} onClick={resetForm}>Cancelar</button>
            <button type="button" className={stepStyles.primaryBtn} onClick={() => submitCard(form)}>Adicionar</button>
          </div>
        </div>
      )}

      {form === 'injury' && (
        <div className={stepStyles.formSheet}>
          <h3 className={stepStyles.formSheetTitle}>Lesão — {selfName}</h3>
          <div className={stepStyles.field}>
            <label>Minuto</label>
            <MinuteInput value={minute} onChange={setMinute} />
          </div>
          <div className={stepStyles.field}>
            <label>Tipo de lesão *</label>
            <input
              className={stepStyles.input}
              value={injuryType}
              onChange={e => setInjuryType(e.target.value)}
              placeholder="Ex: Entorse no tornozelo"
            />
          </div>
          <div className={stepStyles.field}>
            <label>Retorno previsto *</label>
            <input
              className={stepStyles.input}
              type="date"
              value={returnDate}
              min={currentDate ?? undefined}
              onChange={e => setReturnDate(e.target.value)}
            />
          </div>
          <div className={stepStyles.formActions}>
            <button type="button" className={stepStyles.ghostBtn} onClick={resetForm}>Cancelar</button>
            <button
              type="button"
              className={stepStyles.primaryBtn}
              disabled={!injuryType.trim() || !returnDate}
              onClick={submitInjury}
            >
              Confirmar lesão (e sair de campo)
            </button>
          </div>
        </div>
      )}

      {form === 'sub' && (
        <div className={stepStyles.formSheet}>
          <h3 className={stepStyles.formSheetTitle}>Substituição — {selfName} sai</h3>
          <div className={stepStyles.field}>
            <label>Minuto</label>
            <MinuteInput value={minute} onChange={setMinute} />
          </div>
          <div className={stepStyles.field}>
            <label>Quem entra *</label>
            <select
              className={stepStyles.input}
              value={replacementId}
              onChange={e => setReplacementId(e.target.value)}
            >
              <option value="">Selecionar colega...</option>
              {teammates.slice().sort((a, b) => a.number - b.number).map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.number})</option>
              ))}
            </select>
          </div>
          <div className={stepStyles.formActions}>
            {!injury && (
              <button type="button" className={stepStyles.ghostBtn} onClick={resetForm}>Cancelar</button>
            )}
            <button
              type="button"
              className={stepStyles.primaryBtn}
              disabled={!replacementId}
              onClick={submitSub}
            >
              Confirmar substituição
            </button>
          </div>
        </div>
      )}

      <div className={stepStyles.eventList}>
        {cards.map(c => (
          <div key={c.id} className={stepStyles.eventItem}>
            <span className={stepStyles.eventItemIcon}>{c.type === 'yellow' ? '🟨' : '🟥'}</span>
            <div className={stepStyles.eventItemBody}>
              <p className={stepStyles.eventItemTitle}>{c.playerName}</p>
              <p className={stepStyles.eventItemMeta}>{formatMinute(c.minute)}</p>
            </div>
            <button
              type="button"
              className={stepStyles.removeBtn}
              onClick={() => onCardsChange(cards.filter(x => x.id !== c.id))}
              aria-label="Remover"
            >
              ×
            </button>
          </div>
        ))}
        {injury && (
          <div className={stepStyles.eventItem}>
            <span className={stepStyles.eventItemIconInjury} aria-hidden>✚</span>
            <div className={stepStyles.eventItemBody}>
              <p className={stepStyles.eventItemTitle}>{selfName} · {injury.type}</p>
              <p className={stepStyles.eventItemMeta}>
                {formatMinute(injury.minute)} · retorno {new Date(`${injury.returnDate}T12:00:00`).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <button
              type="button"
              className={stepStyles.removeBtn}
              onClick={() => onInjuryChange(null)}
              aria-label="Remover"
            >
              ×
            </button>
          </div>
        )}
        {subOut && (
          <div className={stepStyles.eventItem}>
            <span className={stepStyles.eventItemIcon}>🔄</span>
            <div className={stepStyles.eventItemBody}>
              <p className={stepStyles.eventItemTitle}>{selfName} sai · {subOut.replacementName} entra</p>
              <p className={stepStyles.eventItemMeta}>{formatMinute(subOut.minute)}</p>
            </div>
            <button
              type="button"
              className={stepStyles.removeBtn}
              onClick={() => onSubOutChange(null)}
              aria-label="Remover"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
