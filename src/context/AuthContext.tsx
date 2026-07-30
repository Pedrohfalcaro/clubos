import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
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
  cloudListSlots,
  cloudLoadSlot,
  cloudSaveSlot,
  migrateLegacyCloudSave,
} from '../services/cloudSave';
import {
  clearGame,
  loadGame,
  type GameSave,
} from '../services/storage';
import {
  getActiveSlotId,
  isCompleteSave,
  listLocalSlotSummaries,
  MAX_SAVE_SLOTS,
  mirrorActiveToLegacy,
  pickBestSave,
  SAVE_SLOT_IDS,
  saveLocalSlot,
  savedAtMs,
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
  /** Grava local imediatamente; nuvem opcional (default true). */
  persistSave: (
    data: Omit<GameSave, 'savedAt' | 'version'>,
    slotId?: SaveSlotId,
    options?: { cloud?: boolean },
  ) => Promise<GameSave>;
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
    const cloudOk = c && !c.empty;
    const localOk = l && !l.empty;
    if (cloudOk && localOk) {
      return savedAtMs(l) > savedAtMs(c) ? l! : c!;
    }
    if (cloudOk) return c!;
    if (localOk) return l!;
    return c ?? l ?? { id, empty: true };
  });
}

async function pushSaveToCloud(
  uid: string,
  slotId: SaveSlotId,
  save: GameSave,
): Promise<void> {
  await cloudSaveSlot(uid, slotId, {
    ...save,
    slotId,
    version: save.version ?? '0.6.0',
    savedAt: save.savedAt || new Date().toISOString(),
  });
}

/** Sobe o local para a nuvem quando for mais novo ou a nuvem estiver incompleta/vazia. */
async function syncLocalSlotsToCloud(uid: string): Promise<void> {
  for (const id of SAVE_SLOT_IDS) {
    const local = loadGame(id);
    if (!isCompleteSave(local)) continue;

    let cloud: GameSave | null = null;
    try {
      cloud = await cloudLoadSlot(uid, id);
    } catch {
      cloud = null;
    }

    const shouldUpload =
      !cloud ||
      !isCompleteSave(cloud) ||
      savedAtMs(local) > savedAtMs(cloud);

    if (!shouldUpload) continue;

    try {
      await pushSaveToCloud(uid, id, local!);
    } catch (err) {
      console.warn(`Upload do slot ${id} para a nuvem falhou`, err);
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  const [hasCloudSave, setHasCloudSave] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [activeSlotId, setActiveSlotIdState] = useState<SaveSlotId>(() => getActiveSlotId());
  const [saveSlots, setSaveSlots] = useState<SaveSlotSummary[]>(() => listLocalSlotSummaries());

  const userRef = useRef(user);
  userRef.current = user;
  const activeSlotIdRef = useRef(activeSlotId);
  activeSlotIdRef.current = activeSlotId;

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
          await syncLocalSlotsToCloud(next.uid);
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

  const signInWithGoogle = useCallback(async () => {
    if (!configured) {
      throw new Error('Firebase não configurado');
    }
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  }, [configured]);

  const signOut = useCallback(async () => {
    if (!configured) return;
    await firebaseSignOut(getFirebaseAuth());
    clearGame();
    applySlots(listLocalSlotSummaries());
  }, [configured]);

  const setActiveSlot = useCallback((slotId: SaveSlotId) => {
    setActiveSlotId(slotId);
    setActiveSlotIdState(slotId);
  }, []);

  const persistSave = useCallback(
    async (
      data: Omit<GameSave, 'savedAt' | 'version'>,
      slotId?: SaveSlotId,
      options: { cloud?: boolean } = {},
    ): Promise<GameSave> => {
      const writeCloud = options.cloud !== false;
      const resolvedSlot = slotId ?? activeSlotIdRef.current;
      const save: GameSave = {
        ...data,
        slotId: resolvedSlot,
        version: '0.6.0',
        savedAt: new Date().toISOString(),
      };

      // localStorage síncrono — mesmo savedAt que vai para a nuvem
      saveLocalSlot(resolvedSlot, save);
      mirrorActiveToLegacy(save);
      setActiveSlotId(resolvedSlot);
      if (resolvedSlot !== activeSlotIdRef.current) {
        setActiveSlotIdState(resolvedSlot);
      }

      const currentUser = userRef.current;
      if (!writeCloud || !currentUser || !configured) return save;

      try {
        await pushSaveToCloud(currentUser.uid, resolvedSlot, save);
        await refreshSlots(currentUser.uid);
      } catch (err) {
        console.error('Falha ao salvar na nuvem (mantido local)', err);
        applySlots(listLocalSlotSummaries());
      }
      return save;
    },
    [configured],
  );

  const fetchCloudSave = useCallback(
    async (slotId?: SaveSlotId): Promise<GameSave | null> => {
      const resolvedSlot = slotId ?? activeSlotIdRef.current;
      const local = loadGame(resolvedSlot);
      const currentUser = userRef.current;

      if (!currentUser || !configured) {
        if (local) setActiveSlot(resolvedSlot);
        return local;
      }

      let cloud: GameSave | null = null;
      try {
        cloud = await cloudLoadSlot(currentUser.uid, resolvedSlot);
      } catch (err) {
        console.warn('Falha ao carregar slot da nuvem, tentando local', err);
      }

      if (!cloud) {
        try {
          await migrateLegacyCloudSave(currentUser.uid);
          cloud = await cloudLoadSlot(currentUser.uid, resolvedSlot);
        } catch {
          /* fall through */
        }
      }

      const best = pickBestSave(cloud, local);
      if (!best) return null;

      setActiveSlot(resolvedSlot);

      const localIsBest = !!local && isCompleteSave(local) && best === local;
      if (localIsBest) {
        try {
          await pushSaveToCloud(currentUser.uid, resolvedSlot, local!);
          await refreshSlots(currentUser.uid);
        } catch (err) {
          console.warn('Falha ao subir save local mais novo', err);
        }
        return local;
      }

      saveLocalSlot(resolvedSlot, { ...best, slotId: resolvedSlot });
      mirrorActiveToLegacy({ ...best, slotId: resolvedSlot });
      await refreshSlots(currentUser.uid);
      return best;
    },
    [configured, setActiveSlot],
  );

  const listSaveSlots = useCallback(async (): Promise<SaveSlotSummary[]> => {
    const local = listLocalSlotSummaries();
    const currentUser = userRef.current;
    if (!currentUser || !configured) {
      applySlots(local);
      return local;
    }
    try {
      const cloud = await cloudListSlots(currentUser.uid);
      const merged = mergeSlotLists(cloud, local);
      applySlots(merged);
      return merged;
    } catch (err) {
      console.error('Falha ao listar saves; usando local', err);
      applySlots(local);
      return local;
    }
  }, [configured]);

  const refreshCloudSaveFlag = useCallback(async () => {
    await refreshSlots(userRef.current?.uid);
  }, [configured]);

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
