import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../../context/GameContext';
import {
  FIFA_WINDOW_TYPE_LABELS,
  CALL_UP_LIST_SIZES,
  type CallUpListSize,
  type FifaWindowType,
} from '../../../types/NationalTeam';
import { formatGameDate } from '../../../livelife';
import { suggestWindowLabel, sortWindowsByStart, isDateWithinWindow } from '../../../utils/nationalWindows';
import styles from './NationalWindows.module.css';

const WINDOW_TYPES: FifaWindowType[] = ['eliminatorias', 'amistoso', 'copa_mundo', 'copa_continental', 'outros'];

interface CreateWindowInput {
  label?: string;
  type: FifaWindowType;
  typeOther?: string;
  startDate: string;
  endDate: string;
  listSize: CallUpListSize;
}

export default function NationalWindows() {
  const { state, addFifaWindow } = useGame();
  const navigate = useNavigate();
  const nationalTeam = state.nationalTeam;
  const [showCreate, setShowCreate] = useState(false);

  if (!nationalTeam) return null;

  const sortedWindows = sortWindowsByStart(nationalTeam.windows);
  const currentDate = state.currentDate;

  function handleCreateWindow(input: CreateWindowInput) {
    const id = addFifaWindow(input);
    setShowCreate(false);
    navigate(`/national/windows/${id}`);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Calendário Internacional</p>
          <h1 className={styles.title}>Datas FIFA</h1>
          <p className={styles.hint}>
            Cada Data FIFA é um hub — clique numa para configurar jogos, convocação e tática.
          </p>
        </div>
        <button type="button" className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
          + Adicionar Data FIFA
        </button>
      </header>

      {sortedWindows.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nenhuma Data FIFA cadastrada ainda.</p>
          <p className={styles.emptyHint}>
            Crie a primeira janela para mapear jogos e, depois, convocar atletas.
          </p>
        </div>
      ) : (
        <ul className={styles.windowCardList}>
          {sortedWindows.map(w => {
            const isActive = !w.closed && (currentDate ? isDateWithinWindow(w, currentDate) : false);
            const played = w.games.filter(g => g.played).length;
            return (
              <li key={w.id}>
                <button
                  type="button"
                  className={`${styles.windowListCard} ${isActive ? styles.windowListCardActive : ''}`}
                  onClick={() => navigate(`/national/windows/${w.id}`)}
                >
                  <div className={styles.windowListCardHead}>
                    <p className={styles.gameOpponent}>{w.label}</p>
                    {w.closed ? (
                      <span className={styles.scoreBadge}>finalizada</span>
                    ) : (
                      isActive && <span className={styles.scoreBadge}>ativa agora</span>
                    )}
                  </div>
                  <p className={styles.gameMeta}>
                    {FIFA_WINDOW_TYPE_LABELS[w.type]}
                    {w.type === 'outros' && w.typeOther ? ` · ${w.typeOther}` : ''}
                    {' · '}
                    {formatGameDate(w.startDate, { day: '2-digit', month: 'short' })}
                    {' – '}
                    {formatGameDate(w.endDate, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  <p className={styles.gameMeta}>
                    {w.callUpIds.length}/{w.listSize} convocados · {played}/{w.games.length} jogos disputados
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showCreate && (
        <CreateWindowModal onSubmit={handleCreateWindow} onCancel={() => setShowCreate(false)} />
      )}
    </div>
  );
}

function CreateWindowModal({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: CreateWindowInput) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<FifaWindowType>('amistoso');
  const [typeOther, setTypeOther] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [listSize, setListSize] = useState<CallUpListSize>(23);
  const [labelOverride, setLabelOverride] = useState('');

  const suggested = startDate ? suggestWindowLabel(startDate, type, typeOther) : '';
  const canSubmit =
    startDate.trim().length > 0 &&
    endDate.trim().length > 0 &&
    endDate >= startDate &&
    (type !== 'outros' || typeOther.trim().length > 0);

  function submit() {
    if (!canSubmit) return;
    onSubmit({
      label: labelOverride.trim() || undefined,
      type,
      typeOther: type === 'outros' ? typeOther.trim() : undefined,
      startDate,
      endDate,
      listSize,
    });
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <p className={styles.modalTitle}>Adicionar Data FIFA</p>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Tipo de competição</label>
          <div className={styles.pillGrid}>
            {WINDOW_TYPES.map(t => (
              <button
                key={t}
                type="button"
                className={`${styles.pillBtn} ${type === t ? styles.pillActive : ''}`}
                onClick={() => setType(t)}
              >
                {FIFA_WINDOW_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {type === 'outros' && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Descreva a competição</label>
            <input
              className={styles.formInput}
              type="text"
              value={typeOther}
              onChange={e => setTypeOther(e.target.value)}
              placeholder="ex.: Torneio amistoso de verão"
            />
          </div>
        )}

        <div className={styles.row}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Início da janela</label>
            <input
              className={styles.formInput}
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Fim da janela</label>
            <input
              className={styles.formInput}
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Tamanho da convocação</label>
          <div className={styles.pillGrid}>
            {CALL_UP_LIST_SIZES.map(size => (
              <button
                key={size}
                type="button"
                className={`${styles.pillBtn} ${listSize === size ? styles.pillActive : ''}`}
                onClick={() => setListSize(size)}
              >
                {size} jogadores
              </button>
            ))}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Nome (opcional — sugestão automática)</label>
          <input
            className={styles.formInput}
            type="text"
            value={labelOverride}
            onChange={e => setLabelOverride(e.target.value)}
            placeholder={suggested || 'ex.: OUT/2026'}
          />
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.btnSecondary} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={styles.btnPrimary} onClick={submit} disabled={!canSubmit}>
            Criar Data FIFA
          </button>
        </div>
      </div>
    </div>
  );
}
