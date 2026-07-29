import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { migrateSave, type GameSave } from './storage';
import { getFirestoreDb } from './firebase';
import {
  emptySlotSummary,
  MAX_SAVE_SLOTS,
  SAVE_SLOT_IDS,
  summarizeSave,
  type SaveSlotId,
  type SaveSlotSummary,
} from './saveSlots';

function slotRef(uid: string, slotId: SaveSlotId) {
  return doc(getFirestoreDb(), 'users', uid, 'saves', slotId);
}

function legacySaveRef(uid: string) {
  return doc(getFirestoreDb(), 'users', uid, 'data', 'save');
}

export async function cloudLoadSlot(
  uid: string,
  slotId: SaveSlotId,
): Promise<GameSave | null> {
  const snap = await getDoc(slotRef(uid, slotId));
  if (!snap.exists()) return null;
  return migrateSave(snap.data() as GameSave);
}

export async function cloudSaveSlot(
  uid: string,
  slotId: SaveSlotId,
  save: GameSave,
): Promise<void> {
  const clean = JSON.parse(JSON.stringify(save)) as GameSave;
  await setDoc(slotRef(uid, slotId), clean, { merge: false });
  // Espelha o slot ativo no caminho legado para regras/clientes antigos
  if (slotId === '1') {
    try {
      await setDoc(legacySaveRef(uid), clean, { merge: false });
    } catch {
      /* legado opcional */
    }
  }
}

export async function cloudDeleteSlot(uid: string, slotId: SaveSlotId): Promise<void> {
  await deleteDoc(slotRef(uid, slotId));
}

/**
 * Lista slots com getDoc por documento (não usa list/collection),
 * para funcionar com regras que só liberam paths conhecidos.
 */
export async function cloudListSlots(uid: string): Promise<SaveSlotSummary[]> {
  try {
    await migrateLegacyCloudSave(uid);
  } catch (err) {
    console.warn('Migração de save legado falhou', err);
  }

  const results = await Promise.all(
    SAVE_SLOT_IDS.map(async (id): Promise<SaveSlotSummary> => {
      try {
        const save = await cloudLoadSlot(uid, id);
        return save ? summarizeSave(save, id) : emptySlotSummary(id);
      } catch (err) {
        console.warn(`Falha ao ler slot ${id}`, err);
        return emptySlotSummary(id);
      }
    }),
  );

  if (results.every(s => s.empty)) {
    try {
      const legacy = await getDoc(legacySaveRef(uid));
      if (legacy.exists()) {
        const save = migrateSave(legacy.data() as GameSave);
        return [summarizeSave(save, '1'), emptySlotSummary('2'), emptySlotSummary('3')];
      }
    } catch (err) {
      console.warn('Falha ao ler save legado', err);
    }
  }

  return results;
}

export async function cloudHasAnySave(uid: string): Promise<boolean> {
  const slots = await cloudListSlots(uid);
  return slots.some(s => !s.empty);
}

/** Migra o documento legado users/{uid}/data/save → saves/1 */
export async function migrateLegacyCloudSave(uid: string): Promise<void> {
  try {
    const existing = await getDoc(slotRef(uid, '1'));
    if (existing.exists()) return;
  } catch {
    // Continua tentando ler o legado mesmo se saves/1 falhar
  }

  const legacy = await getDoc(legacySaveRef(uid));
  if (!legacy.exists()) return;

  const save = migrateSave(legacy.data() as GameSave);
  try {
    await cloudSaveSlot(uid, '1', save);
  } catch (err) {
    // Se a coleção `saves` ainda não está liberada nas regras, mantém só o legado
    console.warn('Não foi possível gravar em saves/1; mantendo legado', err);
  }
}

// --- Compat API ---

export async function cloudLoadSave(uid: string): Promise<GameSave | null> {
  await migrateLegacyCloudSave(uid);
  for (const id of SAVE_SLOT_IDS) {
    try {
      const save = await cloudLoadSlot(uid, id);
      if (save) return save;
    } catch {
      /* try next */
    }
  }
  try {
    const legacy = await getDoc(legacySaveRef(uid));
    if (legacy.exists()) return migrateSave(legacy.data() as GameSave);
  } catch {
    /* ignore */
  }
  return null;
}

export async function cloudSaveGame(uid: string, save: GameSave): Promise<void> {
  await cloudSaveSlot(uid, '1', save);
}

export async function cloudHasSave(uid: string): Promise<boolean> {
  return cloudHasAnySave(uid);
}

export { MAX_SAVE_SLOTS };
