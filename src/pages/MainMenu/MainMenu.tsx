import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import { useAuth } from '../../context/AuthContext';
import styles from './MainMenu.module.css';

export default function MainMenu() {
  const navigate = useNavigate();
  const { loadSavedGame } = useGame();
  const {
    user,
    loading,
    configured,
    hasCloudSave,
    signInWithGoogle,
    signOut,
  } = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

  async function handleLoad() {
    if (!hasCloudSave) return;
    setBusy(true);
    setError('');
    try {
      const mode = await loadSavedGame();
      if (mode === 'player') navigate('/player/dashboard');
      else if (mode === 'coach') navigate('/dashboard');
      else setError('Save encontrado, mas está incompleto.');
    } catch (err) {
      console.error(err);
      setError('Falha ao carregar o save da nuvem.');
    } finally {
      setBusy(false);
    }
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
            onClick={() => navigate('/new/mode')}
            disabled={busy}
          >
            Começar
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={handleLoad}
            disabled={!hasCloudSave || busy}
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

        {!hasCloudSave && (
          <p className={styles.hint}>Nenhuma carreira na nuvem. Inicie uma nova.</p>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
