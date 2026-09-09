import { useState } from 'react';
import type { Teammate } from '../../../../types/Teammate';
import type { MatchMinute } from '../../../../types/Match';
import MinuteInput from '../../../../components/MinuteInput/MinuteInput';
import { defaultMinute } from '../../../../utils/matchEvents';
import stepStyles from '../../../MatchPlay/steps/steps.module.css';
import extra from '../PlayerMatchPlay.module.css';

interface PlayerReserveModalProps {
  teammates: Teammate[];
  onEntered: (minute: MatchMinute, replacedTeammateId: string) => void;
  onNotEntered: () => void;
  onClose: () => void;
}

export default function PlayerReserveModal({
  teammates,
  onEntered,
  onNotEntered,
  onClose,
}: PlayerReserveModalProps) {
  const [minute, setMinute] = useState<MatchMinute>(defaultMinute());
  const [replacedId, setReplacedId] = useState('');

  return (
    <div className={extra.overlay} onClick={onClose}>
      <div className={extra.modal} onClick={e => e.stopPropagation()}>
        <h2 className={extra.modalTitle}>Você entrou em campo?</h2>
        <div className={stepStyles.field}>
          <label>Minuto que entrou</label>
          <MinuteInput value={minute} onChange={setMinute} />
        </div>
        {teammates.length > 0 ? (
          <div className={stepStyles.field}>
            <label>No lugar de quem</label>
            <select className={extra.select} value={replacedId} onChange={e => setReplacedId(e.target.value)}>
              <option value="">Selecionar colega...</option>
              {teammates
                .slice()
                .sort((a, b) => a.number - b.number)
                .map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.number})</option>
                ))}
            </select>
          </div>
        ) : (
          <p className={stepStyles.hint}>Seu elenco está vazio — monte-o em Time → Elenco para registrar quem você substituiu.</p>
        )}
        <div className={extra.modalActions}>
          <button type="button" className={extra.cancelBtn} onClick={onNotEntered}>
            Não entrou
          </button>
          <button
            type="button"
            className={extra.confirmBtn}
            disabled={teammates.length > 0 && !replacedId}
            onClick={() => onEntered(minute, replacedId)}
          >
            Entrou →
          </button>
        </div>
      </div>
    </div>
  );
}
