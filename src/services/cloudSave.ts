import { doc, getDoc, setDoc } from 'firebase/firestore';
import { migrateSave, type GameSave } from './storage';
import { getFirestoreDb } from './firebase';

const SAVE_DOC = 'save';

function saveRef(uid: string) {
  return doc(getFirestoreDb(), 'users', uid, 'data', SAVE_DOC);
}

export async function cloudLoadSave(uid: string): Promise<GameSave | null> {
  const snap = await getDoc(saveRef(uid));
  if (!snap.exists()) return null;
  return migrateSave(snap.data() as GameSave);
}

export async function cloudSaveGame(uid: string, save: GameSave): Promise<void> {
  // Firestore rejects `undefined` — strip via JSON round-trip
  const clean = JSON.parse(JSON.stringify(save)) as GameSave;
  await setDoc(saveRef(uid), clean, { merge: false });
}

export async function cloudHasSave(uid: string): Promise<boolean> {
  const snap = await getDoc(saveRef(uid));
  return snap.exists();
}
