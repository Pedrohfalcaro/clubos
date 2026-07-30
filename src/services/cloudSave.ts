import {
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { migrateSave, type GameSave } from './storage';
import { getFirestoreDb } from './firebase';
import {
  emptySlotSummary,
  isCompleteSave,
  MAX_SAVE_SLOTS,
  SAVE_SLOT_IDS,
  summarizeSave,
  type SaveSlotId,
  type SaveSlotSummary,
} from './saveSlots';

const CHUNKED_FORMAT = 'chunked-v1' as const;
/** Margem abaixo do limite de 1 MiB do Firestore por documento. */
const MAX_DOC_BYTES = 900_000;

function slotRef(uid: string, slotId: SaveSlotId) {
  return doc(getFirestoreDb(), 'users', uid, 'saves', slotId);
}

function chunkRef(uid: string, slotId: SaveSlotId, chunkId: string) {
  return doc(getFirestoreDb(), 'users', uid, 'saves', slotId, 'data', chunkId);
}

function legacySaveRef(uid: string) {
  return doc(getFirestoreDb(), 'users', uid, 'data', 'save');
}

function metaRef(uid: string, slotId: SaveSlotId) {
  return doc(getFirestoreDb(), 'users', uid, 'saveMeta', slotId);
}

async function readDoc(ref: DocumentReference) {
  try {
    return await getDocFromServer(ref);
  } catch {
    // Offline / server indisponível — fallback no cache do SDK
    return await getDoc(ref);
  }
}

function explainFirestoreError(err: unknown): Error {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code)
      : '';
  const message = err instanceof Error ? err.message : String(err);

  if (code === 'permission-denied' || /permission/i.test(message)) {
    return new Error(
      'Sem permissão no Firestore. Publique as regras atualizadas (saves/*/data/*) no Console Firebase.',
    );
  }
  if (
    code === 'invalid-argument' ||
    /exceeds|too (large|big)|1 MiB|1048576|size/i.test(message)
  ) {
    return new Error(
      'Save grande demais para um documento. Tente de novo (o app agora divide em partes).',
    );
  }
  if (code === 'unavailable' || /offline|network/i.test(message)) {
    return new Error('Sem conexão com a nuvem. O progresso ficou só neste aparelho.');
  }
  return err instanceof Error ? err : new Error(message || 'Falha na nuvem');
}

/** Parte arrays grandes em pedaços que cabem no limite do Firestore. */
function shardArray<T>(items: T[], prefix: string): { id: string; payload: Record<string, unknown> }[] {
  if (items.length === 0) {
    return [{ id: `${prefix}-0`, payload: { items: [] } }];
  }

  const shards: { id: string; payload: Record<string, unknown> }[] = [];
  let current: T[] = [];
  let size = 12; // {"items":[]}

  for (const item of items) {
    const piece = JSON.stringify(item);
    const add = piece.length + (current.length ? 1 : 0);
    if (current.length > 0 && size + add > MAX_DOC_BYTES) {
      shards.push({ id: `${prefix}-${shards.length}`, payload: { items: current } });
      current = [];
      size = 12;
    }
    current.push(item);
    size += add;
  }
  shards.push({ id: `${prefix}-${shards.length}`, payload: { items: current } });
  return shards;
}

function splitSave(save: GameSave) {
  const {
    players,
    matches,
    pulse,
    finance,
    board,
    transfers,
    seasonHistory,
    tactics,
    tacticsPresets,
    activeTacticsId,
    ...headerRest
  } = save;

  const playerShards = shardArray(players ?? [], 'players');
  const matchShards = shardArray(matches ?? [], 'matches');
  const extrasPayload = {
    pulse: pulse ?? null,
    finance: finance ?? null,
    board: board ?? null,
    transfers: transfers ?? null,
    seasonHistory: seasonHistory ?? [],
    tactics: tactics ?? null,
    tacticsPresets: tacticsPresets ?? [],
    activeTacticsId: activeTacticsId ?? null,
  };

  // Extras ainda pode estourar — se passar, grava sem seasonHistory/pulse pesados no mesmo doc
  let extrasDocs: { id: string; payload: Record<string, unknown> }[] = [
    { id: 'extras', payload: extrasPayload },
  ];
  const extrasSize = JSON.stringify(extrasPayload).length;
  if (extrasSize > MAX_DOC_BYTES) {
    extrasDocs = [
      {
        id: 'extras',
        payload: {
          tactics: extrasPayload.tactics,
          tacticsPresets: extrasPayload.tacticsPresets,
          activeTacticsId: extrasPayload.activeTacticsId,
          board: extrasPayload.board,
          finance: extrasPayload.finance,
        },
      },
      {
        id: 'extras-pulse',
        payload: { pulse: extrasPayload.pulse },
      },
      {
        id: 'extras-transfers',
        payload: { transfers: extrasPayload.transfers },
      },
      ...shardArray(
        (extrasPayload.seasonHistory as unknown[]) ?? [],
        'extras-history',
      ),
    ];
  }

  const chunkIds = [
    ...playerShards.map(s => s.id),
    ...matchShards.map(s => s.id),
    ...extrasDocs.map(s => s.id),
  ];

  const header = {
    ...headerRest,
    format: CHUNKED_FORMAT,
    revision: Date.now(),
    chunks: chunkIds,
    _summary: {
      matchesPlayed: (matches ?? []).filter(m => m.status === 'completed').length,
      wins: save.team?.statistics?.wins,
      draws: save.team?.statistics?.draws,
      losses: save.team?.statistics?.losses,
    },
  };

  return {
    header,
    docs: [...playerShards, ...matchShards, ...extrasDocs] as {
      id: string;
      payload: Record<string, unknown>;
    }[],
  };
}

function collectItems<T>(
  chunks: Map<string, Record<string, unknown>>,
  prefix: string,
): T[] {
  const out: T[] = [];
  // Legado: um único doc "players" / "matches" com a chave homônima
  const legacy = chunks.get(prefix);
  if (legacy && Array.isArray(legacy[prefix])) {
    return legacy[prefix] as T[];
  }

  for (let i = 0; ; i++) {
    const id = `${prefix}-${i}`;
    const data = chunks.get(id);
    if (!data) break;
    const items = data.items;
    if (Array.isArray(items)) out.push(...(items as T[]));
  }
  return out;
}

function assembleSave(
  header: Record<string, unknown>,
  chunks: Map<string, Record<string, unknown>>,
): GameSave {
  const {
    format: _f,
    chunks: _c,
    revision: _r,
    _summary: _s,
    ...rest
  } = header;

  const players = collectItems<NonNullable<GameSave['players']>[number]>(chunks, 'players');
  const matches = collectItems<NonNullable<GameSave['matches']>[number]>(chunks, 'matches');

  // Extras: legado { extras: { pulse, ... } } ou shards
  const extrasRoot = chunks.get('extras') ?? {};
  const pulseDoc = chunks.get('extras-pulse');
  const transfersDoc = chunks.get('extras-transfers');
  const history = collectItems<NonNullable<GameSave['seasonHistory']>[number]>(
    chunks,
    'extras-history',
  );

  const seasonHistory =
    history.length > 0
      ? history
      : ((extrasRoot.seasonHistory as GameSave['seasonHistory']) ?? []);

  const raw = {
    ...rest,
    players,
    matches,
    pulse: pulseDoc?.pulse ?? extrasRoot.pulse ?? undefined,
    finance: extrasRoot.finance ?? undefined,
    board: extrasRoot.board ?? undefined,
    transfers: transfersDoc?.transfers ?? extrasRoot.transfers ?? undefined,
    seasonHistory,
    tactics: extrasRoot.tactics ?? null,
    tacticsPresets: (extrasRoot.tacticsPresets as GameSave['tacticsPresets']) ?? [],
    activeTacticsId: (extrasRoot.activeTacticsId as GameSave['activeTacticsId']) ?? null,
  } as GameSave;

  return migrateSave(raw);
}

export async function cloudLoadSlot(
  uid: string,
  slotId: SaveSlotId,
): Promise<GameSave | null> {
  const snap = await readDoc(slotRef(uid, slotId));
  if (!snap.exists()) return null;

  const data = snap.data() as Record<string, unknown>;

  if (data.format === CHUNKED_FORMAT) {
    const chunkIds = Array.isArray(data.chunks)
      ? (data.chunks as string[])
      : ['players', 'matches', 'extras'];

    const snaps = await Promise.all(
      chunkIds.map(id => readDoc(chunkRef(uid, slotId, id))),
    );

    const map = new Map<string, Record<string, unknown>>();
    const missing: string[] = [];
    chunkIds.forEach((id, i) => {
      if (!snaps[i].exists()) missing.push(id);
      else map.set(id, snaps[i].data() as Record<string, unknown>);
    });

    if (missing.length > 0) {
      throw new Error(
        `Save incompleto na nuvem (faltam partes: ${missing.join(', ')}). No PC onde a carreira está ok, abra logado para reenviar.`,
      );
    }

    const assembled = assembleSave(data, map);
    if (!isCompleteSave(assembled)) {
      throw new Error(
        'Save incompleto na nuvem (sem time/jogador). No PC onde a carreira está ok, abra logado para reenviar.',
      );
    }
    return assembled;
  }

  // Legado: documento monolítico
  return migrateSave(data as unknown as GameSave);
}

/**
 * Lista resumo sem montar o save completo (mais rápido / menos dados).
 * Usa header chunked ou documento legado.
 */
export async function cloudSummarizeSlot(
  uid: string,
  slotId: SaveSlotId,
): Promise<SaveSlotSummary> {
  try {
    const snap = await readDoc(slotRef(uid, slotId));
    if (!snap.exists()) return emptySlotSummary(slotId);
    const data = snap.data() as Record<string, unknown>;

    if (data.format === CHUNKED_FORMAT) {
      const summary = data._summary as
        | { matchesPlayed?: number; wins?: number; draws?: number; losses?: number }
        | undefined;
      const careerMode = data.careerMode as SaveSlotSummary['careerMode'];
      const team = data.team as GameSave['team'] | undefined;
      const careerPlayer = data.careerPlayer as GameSave['careerPlayer'] | undefined;

      if (careerMode === 'player') {
        if (!careerPlayer) return emptySlotSummary(slotId);
        return {
          id: slotId,
          empty: false,
          careerMode: 'player',
          teamName: careerPlayer.currentClub?.name,
          playerName: careerPlayer.name,
          season: data.season as number | undefined,
          wins: summary?.wins,
          draws: summary?.draws,
          losses: summary?.losses,
          matchesPlayed: summary?.matchesPlayed ?? 0,
          savedAt: data.savedAt as string | undefined,
        };
      }

      if (!team || !data.teamId) return emptySlotSummary(slotId);
      return {
        id: slotId,
        empty: false,
        careerMode: 'coach',
        teamName: team.name,
        season: data.season as number | undefined,
        wins: summary?.wins ?? team.statistics?.wins,
        draws: summary?.draws ?? team.statistics?.draws,
        losses: summary?.losses ?? team.statistics?.losses,
        matchesPlayed: summary?.matchesPlayed ?? 0,
        savedAt: data.savedAt as string | undefined,
      };
    }

    const save = migrateSave(data as unknown as GameSave);
    return summarizeSave(save, slotId);
  } catch (err) {
    console.warn(`Falha ao resumir slot ${slotId}`, err);
    return emptySlotSummary(slotId);
  }
}

export async function cloudSaveSlot(
  uid: string,
  slotId: SaveSlotId,
  save: GameSave,
): Promise<void> {
  if (!isCompleteSave(save)) {
    throw new Error('Recusando upload de save incompleto (sem time / jogador).');
  }

  const { header, docs } = splitSave({
    ...save,
    slotId,
    version: save.version ?? '0.6.0',
    savedAt: save.savedAt || new Date().toISOString(),
  });

  try {
    // Atomicidade: ou grava tudo, ou nada (evita header novo + chunks velhos)
    const batch = writeBatch(getFirestoreDb());
    for (const { id, payload } of docs) {
      batch.set(chunkRef(uid, slotId, id), payload, { merge: false });
    }
    batch.set(slotRef(uid, slotId), header, { merge: false });
    await batch.commit();
  } catch (err) {
    throw explainFirestoreError(err);
  }

  try {
    await writeBatch(getFirestoreDb())
      .set(
        metaRef(uid, slotId),
        {
          savedAt: header.savedAt,
          season: header.season,
          matchesPlayed: header._summary?.matchesPlayed ?? 0,
          teamName: save.team?.name ?? save.careerPlayer?.name ?? null,
          careerMode: save.careerMode,
          slotId,
          format: CHUNKED_FORMAT,
          revision: header.revision,
        },
        { merge: true },
      )
      .commit();
  } catch {
    /* meta opcional */
  }

  // Espelho legado enxuto (não o blob inteiro — evita estourar 1 MiB)
  if (slotId === '1') {
    try {
      const slimBatch = writeBatch(getFirestoreDb());
      slimBatch.set(
        legacySaveRef(uid),
        {
          format: CHUNKED_FORMAT,
          savedAt: header.savedAt,
          careerMode: header.careerMode,
          teamId: header.teamId ?? null,
          team: header.team ?? null,
          careerPlayer: header.careerPlayer ?? null,
          season: header.season,
          slotId: '1',
          _migratedToChunks: true,
        },
        { merge: false },
      );
      await slimBatch.commit();
    } catch {
      /* legado opcional */
    }
  }
}

export async function cloudDeleteSlot(uid: string, slotId: SaveSlotId): Promise<void> {
  // Apaga header + chunks conhecidos (e nomes legados)
  const headerSnap = await readDoc(slotRef(uid, slotId)).catch(() => null);
  const chunkIds = new Set<string>(['players', 'matches', 'extras', 'extras-pulse', 'extras-transfers']);
  if (headerSnap?.exists()) {
    const data = headerSnap.data() as Record<string, unknown>;
    if (Array.isArray(data.chunks)) {
      for (const id of data.chunks as string[]) chunkIds.add(id);
    }
  }
  for (let i = 0; i < 40; i++) {
    chunkIds.add(`players-${i}`);
    chunkIds.add(`matches-${i}`);
    chunkIds.add(`extras-history-${i}`);
  }

  await Promise.allSettled([
    ...[...chunkIds].map(id => deleteDoc(chunkRef(uid, slotId, id))),
    deleteDoc(metaRef(uid, slotId)),
    deleteDoc(slotRef(uid, slotId)),
  ]);
}

export async function cloudListSlots(uid: string): Promise<SaveSlotSummary[]> {
  try {
    await migrateLegacyCloudSave(uid);
  } catch (err) {
    console.warn('Migração de save legado falhou', err);
  }

  const results = await Promise.all(
    SAVE_SLOT_IDS.map(id => cloudSummarizeSlot(uid, id)),
  );

  if (results.every(s => s.empty)) {
    try {
      const legacy = await readDoc(legacySaveRef(uid));
      if (legacy.exists()) {
        const data = legacy.data() as Record<string, unknown>;
        if (data._migratedToChunks || data.format === CHUNKED_FORMAT) {
          const fromSlot = await cloudSummarizeSlot(uid, '1');
          if (!fromSlot.empty) return [fromSlot, emptySlotSummary('2'), emptySlotSummary('3')];
        } else {
          const save = migrateSave(data as unknown as GameSave);
          return [summarizeSave(save, '1'), emptySlotSummary('2'), emptySlotSummary('3')];
        }
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

/** Migra o documento legado users/{uid}/data/save → saves/1 (chunked) */
export async function migrateLegacyCloudSave(uid: string): Promise<void> {
  try {
    const existing = await readDoc(slotRef(uid, '1'));
    if (existing.exists()) {
      const data = existing.data() as Record<string, unknown>;
      if (data.format === CHUNKED_FORMAT) return;
      // Monólito antigo em saves/1 → regrava em chunks
      const save = migrateSave(data as unknown as GameSave);
      if (isCompleteSave(save)) {
        await cloudSaveSlot(uid, '1', save);
      }
      return;
    }
  } catch {
    // Continua tentando ler o legado
  }

  const legacy = await readDoc(legacySaveRef(uid));
  if (!legacy.exists()) return;

  const data = legacy.data() as Record<string, unknown>;
  if (data._migratedToChunks || data.format === CHUNKED_FORMAT) return;

  const save = migrateSave(data as unknown as GameSave);
  if (!isCompleteSave(save)) return;

  try {
    await cloudSaveSlot(uid, '1', save);
  } catch (err) {
    console.warn('Não foi possível migrar save legado para chunks', err);
  }
}

export async function cloudLoadSave(uid: string): Promise<GameSave | null> {
  await migrateLegacyCloudSave(uid);
  for (const id of SAVE_SLOT_IDS) {
    try {
      const save = await cloudLoadSlot(uid, id);
      if (save && isCompleteSave(save)) return save;
    } catch {
      /* try next */
    }
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
