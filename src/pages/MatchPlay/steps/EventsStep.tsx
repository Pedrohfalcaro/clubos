import { useMemo, useState } from 'react';
import MinuteInput from '../../../components/MinuteInput/MinuteInput';
import SearchableSelect from '../../../components/SearchableSelect/SearchableSelect';
import type { Player } from '../../../types/Player';
import type {
  MatchMinute,
  SubstitutionEvent,
  TeamCardEntry,
  TeamInjuryEntry,
} from '../../../types/Match';
import { defaultMinute, formatMinute, uid } from '../../../utils/matchEvents';
import {
  getBenchAvailableIds,
  getFieldPlayerIds,
} from '../../../utils/matchPlayHelpers';
import styles from './steps.module.css';

type FormKind = 'yellow' | 'red' | 'injury' | 'sub' | null;

interface EventsStepProps {
  players: Player[];
  starters: string[];
  bench: string[];
  teamSubs: SubstitutionEvent[];
  onTeamSubsChange: (s: SubstitutionEvent[]) => void;
  teamCards: TeamCardEntry[];
  onTeamCardsChange: (c: TeamCardEntry[]) => void;
  injuries: TeamInjuryEntry[];
  onInjuriesChange: (i: TeamInjuryEntry[]) => void;
}

export default function EventsStep({
  players,
  starters,
  bench,
  teamSubs,
  onTeamSubsChange,
  teamCards,
  onTeamCardsChange,
  injuries,
  onInjuriesChange,
}: EventsStepProps) {
  const [form, setForm] = useState<FormKind>(null);
  const [playerId, setPlayerId] = useState('');
  const [playerOutId, setPlayerOutId] = useState('');
  const [playerInId, setPlayerInId] = useState('');
  const [minute, setMinute] = useState<MatchMinute>(defaultMinute());
  const [note, setNote] = useState('');

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

  const benchOptions = useMemo(
    () =>
      getBenchAvailableIds(starters, bench, teamSubs, injuries)
        .map(id => players.find(p => p.id === id))
        .filter(Boolean)
        .map(p => ({ value: p!.id, label: p!.name })),
    [starters, bench, teamSubs, injuries, players],
  );

  function resetForm() {
    setForm(null);
    setPlayerId('');
    setPlayerOutId('');
    setPlayerInId('');
    setMinute(defaultMinute());
    setNote('');
  }

  function resolve(id: string) {
    return players.find(p => p.id === id);
  }

  function submitCard(type: 'yellow' | 'red') {
    const p = resolve(playerId);
    if (!p || !fieldIds.has(playerId)) return;
    onTeamCardsChange([
      ...teamCards,
      {
        id: uid(),
        playerId: p.id,
        playerName: p.name,
        type,
        minute,
      },
    ]);
    resetForm();
  }

  function submitInjury() {
    const p = resolve(playerId);
    if (!p || !fieldIds.has(playerId)) return;
    onInjuriesChange([
      ...injuries,
      {
        id: uid(),
        playerId: p.id,
        playerName: p.name,
        minute,
        note: note.trim() || undefined,
      },
    ]);
    resetForm();
  }

  function submitSub() {
    const pin = resolve(playerInId);
    const pout = resolve(playerOutId);
    if (!pin || !pout) return;
    if (!fieldIds.has(playerOutId)) return;
    if (!benchOptions.some(o => o.value === playerInId)) return;
    onTeamSubsChange([
      ...teamSubs,
      {
        id: uid(),
        playerInId: pin.id,
        playerInName: pin.name,
        playerOutId: pout.id,
        playerOutName: pout.name,
        minute,
        side: 'team',
      },
    ]);
    resetForm();
  }

  const teamSubsOnly = teamSubs.filter(s => s.side === 'team');

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        Incidências do seu time. Só quem está em campo pode receber cartão ou se machucar.
        Quem sai na substituição não volta nesta partida.
      </p>

      {!form && (
        <div className={styles.eventActions}>
          <button type="button" className={styles.eventBtn} onClick={() => setForm('yellow')}>
            <span className={styles.eventIcon}>🟨</span>
            Cartão amarelo
          </button>
          <button type="button" className={styles.eventBtn} onClick={() => setForm('red')}>
            <span className={styles.eventIcon}>🟥</span>
            Cartão vermelho
          </button>
          <button type="button" className={styles.eventBtn} onClick={() => setForm('injury')}>
            <span className={styles.eventIcon}>✚</span>
            Lesão
          </button>
          <button type="button" className={styles.eventBtn} onClick={() => setForm('sub')}>
            <span className={styles.eventIcon}>⇅</span>
            Substituição
          </button>
        </div>
      )}

      {form === 'yellow' || form === 'red' ? (
        <div className={styles.formSheet}>
          <h3 className={styles.formSheetTitle}>
            {form === 'yellow' ? 'Cartão amarelo' : 'Cartão vermelho'}
          </h3>
          <div className={styles.field}>
            <label>Jogador em campo</label>
            <SearchableSelect
              options={fieldOptions}
              value={playerId}
              onChange={setPlayerId}
              placeholder="Selecionar..."
            />
          </div>
          <div className={styles.field}>
            <label>Minuto</label>
            <MinuteInput value={minute} onChange={setMinute} />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.ghostBtn} onClick={resetForm}>
              Cancelar
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={!playerId}
              onClick={() => submitCard(form)}
            >
              Adicionar
            </button>
          </div>
        </div>
      ) : null}

      {form === 'injury' && (
        <div className={styles.formSheet}>
          <h3 className={styles.formSheetTitle}>Lesão</h3>
          <div className={styles.field}>
            <label>Jogador em campo</label>
            <SearchableSelect
              options={fieldOptions}
              value={playerId}
              onChange={setPlayerId}
              placeholder="Selecionar..."
            />
          </div>
          <div className={styles.field}>
            <label>Minuto</label>
            <MinuteInput value={minute} onChange={setMinute} />
          </div>
          <div className={styles.field}>
            <label>Detalhe (opcional)</label>
            <input
              className={styles.input}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ex: entorse no tornozelo"
            />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.ghostBtn} onClick={resetForm}>
              Cancelar
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={!playerId}
              onClick={submitInjury}
            >
              Adicionar
            </button>
          </div>
        </div>
      )}

      {form === 'sub' && (
        <div className={styles.formSheet}>
          <h3 className={styles.formSheetTitle}>Substituição</h3>
          <div className={styles.field}>
            <label>Sai (em campo)</label>
            <SearchableSelect
              options={fieldOptions}
              value={playerOutId}
              onChange={setPlayerOutId}
              placeholder="Quem sai..."
            />
          </div>
          <div className={styles.field}>
            <label>Entra (banco)</label>
            <SearchableSelect
              options={benchOptions}
              value={playerInId}
              onChange={setPlayerInId}
              placeholder="Quem entra..."
            />
          </div>
          <div className={styles.field}>
            <label>Minuto</label>
            <MinuteInput value={minute} onChange={setMinute} />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.ghostBtn} onClick={resetForm}>
              Cancelar
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={!playerOutId || !playerInId}
              onClick={submitSub}
            >
              Confirmar
            </button>
          </div>
        </div>
      )}

      <div className={styles.eventList}>
        {teamCards.map(c => (
          <div key={c.id} className={styles.eventItem}>
            <span className={styles.eventItemIcon}>{c.type === 'yellow' ? '🟨' : '🟥'}</span>
            <div className={styles.eventItemBody}>
              <p className={styles.eventItemTitle}>{c.playerName}</p>
              <p className={styles.eventItemMeta}>{formatMinute(c.minute)}</p>
            </div>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => onTeamCardsChange(teamCards.filter(x => x.id !== c.id))}
              aria-label="Remover"
            >
              ×
            </button>
          </div>
        ))}
        {injuries.map(i => (
          <div key={i.id} className={styles.eventItem}>
            <span className={styles.eventItemIcon}>✚</span>
            <div className={styles.eventItemBody}>
              <p className={styles.eventItemTitle}>{i.playerName}</p>
              <p className={styles.eventItemMeta}>
                {formatMinute(i.minute)}
                {i.note ? ` · ${i.note}` : ' · Lesão'}
              </p>
            </div>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => onInjuriesChange(injuries.filter(x => x.id !== i.id))}
              aria-label="Remover"
            >
              ×
            </button>
          </div>
        ))}
        {teamSubsOnly.map(s => (
          <div key={s.id} className={styles.eventItem}>
            <span className={styles.eventItemIcon}>⇅</span>
            <div className={styles.eventItemBody}>
              <p className={styles.eventItemTitle}>
                {s.playerInName} ← {s.playerOutName}
              </p>
              <p className={styles.eventItemMeta}>{formatMinute(s.minute)}</p>
            </div>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => onTeamSubsChange(teamSubs.filter(x => x.id !== s.id))}
              aria-label="Remover"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
