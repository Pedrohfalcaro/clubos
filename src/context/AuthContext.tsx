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
import {
  cloudHasAnySave,
  cloudListSlots,
  cloudLoadSlot,
  cloudSaveSlot,
  migrateLegacyCloudSave,
} from '../services/cloudSave';
import {
  clearGame,
  hasSave as hasLocalSave,
  loadGame,
  saveGame as saveLocalGame,
  type GameSave,
} from '../services/storage';
import {
  getActiveSlotId,
  listLocalSlotSummaries,
  MAX_SAVE_SLOTS,
  SAVE_SLOT_IDS,
  setActiveSlotId,
  type SaveSlotId,
  type SaveSlotSummary,
} from '../services/saveSlots';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  cloudReady: boolean;
  /** True se há ao menos um slot ocupado (nuvem ou local). */
  hasCloudSave: boolean;
  activeSlotId: SaveSlotId;
  saveSlots: SaveSlotSummary[];
  maxSaveSlots: number;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  persistSave: (
    data: Omit<GameSave, 'savedAt' | 'version'>,
    slotId?: SaveSlotId,
  ) => Promise<void>;
  fetchCloudSave: (slotId?: SaveSlotId) => Promise<GameSave | null>;
  listSaveSlots: () => Promise<SaveSlotSummary[]>;
  refreshCloudSaveFlag: () => Promise<void>;
  setActiveSlot: (slotId: SaveSlotId) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mergeSlotLists(
  cloud: SaveSlotSummary[],
  local: SaveSlotSummary[],
): SaveSlotSummary[] {
  return SAVE_SLOT_IDS.map(id => {
    const c = cloud.find(s => s.id === id);
    const l = local.find(s => s.id === id);
    if (c && !c.empty) return c;
    if (l && !l.empty) return l;
    return c ?? l ?? { id, empty: true };
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  const [hasCloudSave, setHasCloudSave] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [activeSlotId, setActiveSlotIdState] = useState<SaveSlotId>(() => getActiveSlotId());
  const [saveSlots, setSaveSlots] = useState<SaveSlotSummary[]>(() => listLocalSlotSummaries());

  function applySlots(slots: SaveSlotSummary[]) {
    setSaveSlots(slots);
    setHasCloudSave(slots.some(s => !s.empty));
  }

  async function refreshSlots(uid?: string | null) {
    const local = listLocalSlotSummaries();
    if (uid && configured) {
      try {
        const cloud = await cloudListSlots(uid);
        applySlots(mergeSlotLists(cloud, local));
        return;
      } catch (err) {
        console.error('Falha ao listar saves na nuvem', err);
      }
    }
    applySlots(local);
  }

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      applySlots(listLocalSlotSummaries());
      return;
    }

    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async next => {
      setUser(next);
      if (next) {
        try {
          const exists = await cloudHasAnySave(next.uid);
          if (!exists && hasLocalSave()) {
            const local = loadGame();
            if (local) {
              try {
                await cloudSaveSlot(next.uid, '1', {
                  ...local,
                  version: local.version ?? '0.6.0',
                  savedAt: local.savedAt ?? new Date().toISOString(),
                  slotId: '1',
                });
              } catch (err) {
                console.warn('Upload do save local para a nuvem falhou', err);
              }
              setActiveSlotId('1');
              setActiveSlotIdState('1');
            }
          }
        } catch (err) {
          console.error('Falha ao sincronizar save na nuvem', err);
        }
        await refreshSlots(next.uid);
        setCloudReady(true);
      } else {
        setCloudReady(false);
        applySlots(listLocalSlotSummaries());
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
    applySlots(listLocalSlotSummaries());
  }

  function setActiveSlot(slotId: SaveSlotId) {
    setActiveSlotId(slotId);
    setActiveSlotIdState(slotId);
  }

  async function persistSave(
    data: Omit<GameSave, 'savedAt' | 'version'>,
    slotId: SaveSlotId = activeSlotId,
  ) {
    saveLocalGame(data, slotId);
    setActiveSlot(slotId);
    applySlots(listLocalSlotSummaries());

    if (!user || !configured) return;

    const save: GameSave = {
      ...data,
      slotId,
      version: '0.6.0',
      savedAt: new Date().toISOString(),
    };
    try {
      await cloudSaveSlot(user.uid, slotId, save);
      await refreshSlots(user.uid);
    } catch (err) {
      console.error('Falha ao salvar na nuvem (mantido local)', err);
    }
  }

  async function fetchCloudSave(slotId: SaveSlotId = activeSlotId): Promise<GameSave | null> {
    if (!user || !configured) {
      const local = loadGame(slotId);
      if (local) setActiveSlot(slotId);
      return local;
    }

    try {
      const cloud = await cloudLoadSlot(user.uid, slotId);
      if (cloud) {
        const { savedAt: _s, version: _v, ...rest } = cloud;
        saveLocalGame(rest, slotId);
        setActiveSlot(slotId);
        await refreshSlots(user.uid);
        return cloud;
      }
    } catch (err) {
      console.warn('Falha ao carregar slot da nuvem, tentando local', err);
    }

    // Legado / local
    try {
      await migrateLegacyCloudSave(user.uid);
      const again = await cloudLoadSlot(user.uid, slotId);
      if (again) {
        const { savedAt: _s, version: _v, ...rest } = again;
        saveLocalGame(rest, slotId);
        setActiveSlot(slotId);
        return again;
      }
    } catch {
      /* fall through */
    }

    const local = loadGame(slotId);
    if (local) setActiveSlot(slotId);
    return local;
  }

  async function listSaveSlots(): Promise<SaveSlotSummary[]> {
    const local = listLocalSlotSummaries();
    if (!user || !configured) {
      applySlots(local);
      return local;
    }
    try {
      const cloud = await cloudListSlots(user.uid);
      const merged = mergeSlotLists(cloud, local);
      applySlots(merged);
      return merged;
    } catch (err) {
      console.error('Falha ao listar saves; usando local', err);
      applySlots(local);
      return local;
    }
  }

  async function refreshCloudSaveFlag() {
    await refreshSlots(user?.uid);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        configured,
        cloudReady,
        hasCloudSave,
        activeSlotId,
        saveSlots,
        maxSaveSlots: MAX_SAVE_SLOTS,
        signInWithGoogle,
        signOut,
        persistSave,
        fetchCloudSave,
        listSaveSlots,
        refreshCloudSaveFlag,
        setActiveSlot,
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
