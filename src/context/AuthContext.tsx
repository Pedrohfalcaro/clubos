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
  isSavePreferable,
  listLocalSlotSummaries,
  MAX_SAVE_SLOTS,
  mirrorActiveToLegacy,
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
  /** Último erro de sync com a nuvem (null se ok). */
  cloudSyncError: string | null;
  lastCloudSyncAt: string | null;
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
      // Para a lista, preferir o savedAt mais recente no card;
      // o progresso real é resolvido no fetchCloudSave.
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

/** Sobe o local para a nuvem quando tiver mais progresso (ou nuvem vazia/incompleta). */
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

    if (!isSavePreferable(local, cloud)) continue;

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
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);

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
    const unsub = onAuthStateChanged(auth, next => {
      setUser(next);
      // Libera a UI assim que a sessão Auth estiver resolvida.
      // Sync/listagem na nuvem NÃO pode bloquear "Verificando sessão..." —
      // getDocFromServer pode demorar ou pendurar com rede ruim / regras desatualizadas.
      setLoading(false);

      if (!next) {
        setCloudReady(false);
        applySlots(listLocalSlotSummaries());
        return;
      }

      void (async () => {
        try {
          await syncLocalSlotsToCloud(next.uid);
        } catch (err) {
          console.error('Falha ao sincronizar save na nuvem', err);
        }
        try {
          await refreshSlots(next.uid);
        } catch (err) {
          console.error('Falha ao listar slots após login', err);
          applySlots(listLocalSlotSummaries());
        }
        setCloudReady(true);
      })();
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

      // Evita subir um save “tocado” (novo savedAt) por cima de outro aparelho com mais jogos
      try {
        const cloud = await cloudLoadSlot(currentUser.uid, resolvedSlot);
        if (cloud && !isSavePreferable(save, cloud)) {
          return save;
        }
      } catch {
        /* se não ler a nuvem, tenta subir mesmo assim */
      }

      try {
        await pushSaveToCloud(currentUser.uid, resolvedSlot, save);
        await refreshSlots(currentUser.uid);
        setCloudSyncError(null);
        setLastCloudSyncAt(save.savedAt);
      } catch (err) {
        console.error('Falha ao salvar na nuvem (mantido local)', err);
        applySlots(listLocalSlotSummaries());
        const msg =
          err instanceof Error
            ? err.message
            : 'Falha ao salvar na nuvem';
        setCloudSyncError(msg);
        // Propaga erro para o GameContext manter fila de retry
        throw err instanceof Error ? err : new Error('Falha ao salvar na nuvem');
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
        return isCompleteSave(local) ? local : null;
      }

      // Tem save local completo: abre NA HORA e sincroniza nuvem em background.
      // Antes o load esperava upload/migração e o menu ficava travado no slot.
      if (isCompleteSave(local)) {
        setActiveSlot(resolvedSlot);
        void (async () => {
          try {
            let cloud: GameSave | null = null;
            try {
              cloud = await cloudLoadSlot(currentUser.uid, resolvedSlot);
            } catch (err) {
              console.warn('Falha ao ler nuvem em background', err);
            }
            if (!cloud) {
              void migrateLegacyCloudSave(currentUser.uid).catch(() => {});
            }
            if (isSavePreferable(local, cloud)) {
              try {
                await pushSaveToCloud(currentUser.uid, resolvedSlot, local!);
                await refreshSlots(currentUser.uid);
                setCloudSyncError(null);
                setLastCloudSyncAt(local!.savedAt);
              } catch (err) {
                console.warn('Falha ao subir save local preferível', err);
                setCloudSyncError(
                  err instanceof Error ? err.message : 'Falha ao subir save',
                );
              }
            } else if (isCompleteSave(cloud) && isSavePreferable(cloud, local)) {
              // Nuvem mais nova — espelha local (próximo load já pega)
              saveLocalSlot(resolvedSlot, { ...cloud!, slotId: resolvedSlot });
              mirrorActiveToLegacy({ ...cloud!, slotId: resolvedSlot });
              await refreshSlots(currentUser.uid);
              setCloudSyncError(null);
            }
          } catch (err) {
            console.warn('Sync background após load falhou', err);
          }
        })();
        return local;
      }

      // Sem local: precisa da nuvem (com timeout geral)
      let cloud: GameSave | null = null;
      let cloudError: string | null = null;
      try {
        cloud = await cloudLoadSlot(currentUser.uid, resolvedSlot);
      } catch (err) {
        cloudError = err instanceof Error ? err.message : 'Falha ao ler nuvem';
        console.warn('Falha ao carregar slot da nuvem', err);
      }

      if (!cloud) {
        void migrateLegacyCloudSave(currentUser.uid).catch(() => {});
      }

      if (!isCompleteSave(cloud)) {
        if (cloudError) setCloudSyncError(cloudError);
        return null;
      }

      setActiveSlot(resolvedSlot);
      saveLocalSlot(resolvedSlot, { ...cloud!, slotId: resolvedSlot });
      mirrorActiveToLegacy({ ...cloud!, slotId: resolvedSlot });
      void refreshSlots(currentUser.uid).catch(() => {});
      setCloudSyncError(null);
      return cloud;
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
        cloudSyncError,
        lastCloudSyncAt,
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
