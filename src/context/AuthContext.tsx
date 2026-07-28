import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '../services/firebase';
import { cloudHasSave, cloudLoadSave, cloudSaveGame } from '../services/cloudSave';
import {
  clearGame,
  hasSave as hasLocalSave,
  loadGame,
  saveGame as saveLocalGame,
  type GameSave,
} from '../services/storage';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  cloudReady: boolean;
  hasCloudSave: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  persistSave: (data: Omit<GameSave, 'savedAt' | 'version'>) => Promise<void>;
  fetchCloudSave: () => Promise<GameSave | null>;
  refreshCloudSaveFlag: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  const [hasCloudSave, setHasCloudSave] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async next => {
      setUser(next);
      if (next) {
        try {
          // Migrate local save to cloud on first login if cloud is empty
          const exists = await cloudHasSave(next.uid);
          if (!exists && hasLocalSave()) {
            const local = loadGame();
            if (local) {
              await cloudSaveGame(next.uid, local);
            }
          }
          const after = await cloudHasSave(next.uid);
          setHasCloudSave(after);
        } catch (err) {
          console.error('Falha ao sincronizar save na nuvem', err);
          setHasCloudSave(false);
        }
        setCloudReady(true);
      } else {
        setHasCloudSave(false);
        setCloudReady(false);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [configured]);

  async function signInWithGoogle() {
    if (!configured) {
      throw new Error('Firebase não configurado');
    }
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  }

  async function signOut() {
    if (!configured) return;
    await firebaseSignOut(getFirebaseAuth());
    clearGame();
  }

  async function persistSave(data: Omit<GameSave, 'savedAt' | 'version'>) {
    // Always keep a local cache for fast resume in the same browser
    saveLocalGame(data);

    if (!user || !configured) return;

    const save: GameSave = {
      ...data,
      version: '0.5.0',
      savedAt: new Date().toISOString(),
    };
    await cloudSaveGame(user.uid, save);
    setHasCloudSave(true);
  }

  async function fetchCloudSave(): Promise<GameSave | null> {
    if (!user || !configured) return loadGame();
    const cloud = await cloudLoadSave(user.uid);
    if (cloud) {
      // Mirror to local cache
      const { savedAt: _s, version: _v, ...rest } = cloud;
      saveLocalGame(rest);
      setHasCloudSave(true);
      return cloud;
    }
    return loadGame();
  }

  async function refreshCloudSaveFlag() {
    if (!user || !configured) {
      setHasCloudSave(false);
      return;
    }
    setHasCloudSave(await cloudHasSave(user.uid));
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        configured,
        cloudReady,
        hasCloudSave,
        signInWithGoogle,
        signOut,
        persistSave,
        fetchCloudSave,
        refreshCloudSaveFlag,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
