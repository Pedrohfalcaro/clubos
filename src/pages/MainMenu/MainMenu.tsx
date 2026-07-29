import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import { useAuth } from '../../context/AuthContext';
import {
  formatSlotRecord,
  formatSlotSavedAt,
  type SaveSlotId,
  type SaveSlotSummary,
} from '../../services/saveSlots';
import styles from './MainMenu.module.css';

export default function MainMenu() {
  const navigate = useNavigate();
  const { loadSavedGame, setSaveSlot } = useGame();
  const {
    user,
    loading,
    configured,
    hasCloudSave,
    saveSlots,
    maxSaveSlots,
    signInWithGoogle,
    signOut,
    listSaveSlots,
  } = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pickerMode, setPickerMode] = useState<'load' | 'new' | null>(null);
  const [slots, setSlots] = useState<SaveSlotSummary[]>(saveSlots);

  useEffect(() => {
    setSlots(saveSlots);
  }, [saveSlots]);

  async function handleGoogle() {
    setError('');
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
      setError('Não foi possível entrar com Google. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  async function openLoadPicker() {
    setBusy(true);
    setError('');
    try {
      const list = await listSaveSlots();
      setSlots(list);
      if (!list.some(s => !s.empty)) {
        setError('Nenhuma carreira salva encontrada.');
        return;
      }
      setPickerMode('load');
    } catch (err) {
      console.error(err);
      setError('Falha ao listar salvamentos.');
    } finally {
      setBusy(false);
    }
  }

  async function openNewPicker() {
    setBusy(true);
    setError('');
    try {
      const list = await listSaveSlots();
      setSlots(list);
      setPickerMode('new');
    } catch (err) {
      console.error(err);
      setError('Falha ao preparar nova carreira.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadSlot(slotId: SaveSlotId) {
    setBusy(true);
    setError('');
    try {
      const mode = await loadSavedGame(slotId);
      if (mode === 'player') navigate('/player/dashboard');
      else if (mode === 'coach') navigate('/dashboard');
      else setError('Save encontrado, mas está incompleto.');
    } catch (err) {
      console.error(err);
      setError('Falha ao carregar o save.');
    } finally {
      setBusy(false);
      setPickerMode(null);
    }
  }

  function handleNewSlot(slotId: SaveSlotId) {
    setSaveSlot(slotId);
    setPickerMode(null);
    navigate('/new/mode');
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.content}>
          <div className={styles.logo}>⬡</div>
          <h1 className={styles.title}>ClubOS</h1>
          <p className={styles.hint}>Verificando sessão...</p>
        </div>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className={styles.page}>
        <div className={styles.content}>
          <div className={styles.logo}>⬡</div>
          <h1 className={styles.title}>ClubOS</h1>
          <p className={styles.setupBox}>
            Configure o Firebase para ativar login Google e save na nuvem.
            Copie <code>.env.example</code> para <code>.env</code> e preencha as chaves
            <code> VITE_FIREBASE_*</code>. Ative Authentication → Google e Firestore no console.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.content}>
          <div className={styles.logo}>⬡</div>
          <h1 className={styles.title}>ClubOS</h1>
          <p className={styles.tagline}>Entre com Google para salvar sua carreira na nuvem.</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.googleBtn}
              onClick={handleGoogle}
              disabled={busy}
            >
              {busy ? 'Entrando...' : 'Entrar com Google'}
            </button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>
    );
  }

  const occupied = slots.filter(s => !s.empty).length;
  const hasAnySave = occupied > 0 || hasCloudSave;

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.logo}>⬡</div>
        <h1 className={styles.title}>ClubOS</h1>
        <p className={styles.userLine}>
          {user.photoURL && (
            <img src={user.photoURL} alt="" className={styles.avatar} referrerPolicy="no-referrer" />
          )}
          {user.displayName ?? user.email}
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={openNewPicker}
            disabled={busy}
          >
            Começar
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={openLoadPicker}
            disabled={!hasAnySave || busy}
          >
            {busy ? 'Carregando...' : 'Carregar'}
          </button>
          <button
            type="button"
            className={styles.ghost}
            onClick={handleSignOut}
            disabled={busy}
          >
            Sair da conta
          </button>
        </div>

        <p className={styles.hint}>
          Até {maxSaveSlots} carreiras por conta · {occupied}/{maxSaveSlots} em uso
        </p>

        {!hasAnySave && (
          <p className={styles.hint}>Nenhuma carreira salva ainda. Clique em Começar.</p>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </div>

      {pickerMode && (
        <div className={styles.overlay} onClick={() => !busy && setPickerMode(null)}>
          <div className={styles.slotModal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.slotTitle}>
              {pickerMode === 'load' ? 'Carregar carreira' : 'Escolher slot'}
            </h2>
            <p className={styles.slotSub}>
              {pickerMode === 'load'
                ? 'Selecione um salvamento para continuar'
                : 'Escolha um slot vazio ou sobrescreva um existente'}
            </p>
            <div className={styles.slotList}>
              {slots.map(slot => {
                const disabled = pickerMode === 'load' && slot.empty;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    className={`${styles.slotCard} ${slot.empty ? styles.slotEmpty : ''}`}
                    disabled={disabled || busy}
                    onClick={() =>
                      pickerMode === 'load'
                        ? handleLoadSlot(slot.id)
                        : handleNewSlot(slot.id)
                    }
                  >
                    <span className={styles.slotIndex}>Slot {slot.id}</span>
                    {slot.empty ? (
                      <span className={styles.slotEmptyLabel}>Vazio</span>
                    ) : (
                      <>
                        <strong className={styles.slotName}>
                          {slot.careerMode === 'player'
                            ? `${slot.playerName ?? 'Jogador'} · ${slot.teamName ?? 'Sem clube'}`
                            : slot.teamName ?? 'Clube'}
                        </strong>
                        <span className={styles.slotMeta}>
                          Temporada {slot.season}
                          {slot.careerMode === 'player' ? ' · Carreira jogador' : ' · Treinador'}
                        </span>
                        <span className={styles.slotMeta}>
                          {formatSlotRecord(slot)}
                          {slot.matchesPlayed != null ? ` · ${slot.matchesPlayed} jogos` : ''}
                        </span>
                        <span className={styles.slotDate}>{formatSlotSavedAt(slot.savedAt)}</span>
                      </>
                    )}
                    {pickerMode === 'new' && !slot.empty && (
                      <span className={styles.slotWarn}>Será sobrescrito</span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className={styles.slotCancel}
              onClick={() => setPickerMode(null)}
              disabled={busy}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
