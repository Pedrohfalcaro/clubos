import {
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
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
/**
 * Margem abaixo do limite de 1 MiB do Firestore.
 * JSON.stringify subestima o encoding real — 700 KB é mais seguro que 900 KB.
 */
const MAX_DOC_BYTES = 700_000;
/** Limite conservador de ops por batch de limpeza. */
const MAX_BATCH_OPS = 40;

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

function estimateBytes(value: unknown): number {
  const json = JSON.stringify(value);
  if (textEncoder) return textEncoder.encode(json).length;
  return json.length;
}

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
  // Só tratar como tamanho quando a mensagem realmente fala de size —
  // `invalid-argument` também cobre undefined/NaN e estava gerando falso positivo.
  if (/exceeds|too (large|big)|1 MiB|1048576|maximum size|size /i.test(message)) {
    return new Error(
      'Save grande demais para um documento. Tente de novo (o app agora divide em partes).',
    );
  }
  if (/unsupported field value|undefined|NaN|invalid.*value/i.test(message)) {
    return new Error(
      'Dados inválidos no save (campo vazio/inválido). Atualize a página e salve de novo.',
    );
  }
  if (code === 'unavailable' || /offline|network/i.test(message)) {
    return new Error('Sem conexão com a nuvem. O progresso ficou só neste aparelho.');
  }
  if (code === 'invalid-argument') {
    return new Error(`Falha ao gravar na nuvem: ${message}`);
  }
  return err instanceof Error ? err : new Error(message || 'Falha na nuvem');
}

/**
 * Firestore rejeita `undefined` e `NaN` com invalid-argument.
 * JSON.stringify omite undefined (por isso o tamanho “passava”), mas o SDK não.
 */
function sanitizeForFirestore(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value.map(item => {
      const cleaned = sanitizeForFirestore(item);
      return cleaned === undefined ? null : cleaned;
    });
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (child === undefined) continue;
      const cleaned = sanitizeForFirestore(child);
      if (cleaned === undefined) continue;
      out[key] = cleaned;
    }
    return out;
  }
  // functions, symbols, etc.
  return null;
}

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return sanitizeForFirestore(payload) as Record<string, unknown>;
}

type ChunkDoc = { id: string; payload: Record<string, unknown> };

/** Enxuga item único que sozinho estoura o limite (ex.: jogo com muitos detalhes). */
function slimOversizedItem(item: unknown, prefix: string): unknown {
  if (!item || typeof item !== 'object') return item;
  const obj = { ...(item as Record<string, unknown>) };

  if (prefix.startsWith('matches')) {
    delete obj.description;
    delete obj.playerPerformance;
    if (estimateBytes(obj) <= MAX_DOC_BYTES) return obj;
    // Mantém só o essencial para o jogo continuar
    return {
      id: obj.id,
      teamId: obj.teamId,
      date: obj.date,
      opponent: obj.opponent,
      location: obj.location,
      goalsFor: obj.goalsFor,
      goalsAgainst: obj.goalsAgainst,
      result: obj.result,
      competition: obj.competition,
      status: obj.status,
      goals: obj.goals ?? [],
      assists: obj.assists ?? [],
      cards: obj.cards ?? [],
      playerMatches: obj.playerMatches ?? [],
      lineup: obj.lineup,
      substitutions: obj.substitutions,
      injuries: obj.injuries,
      playerRatings: obj.playerRatings,
      motmPlayerId: obj.motmPlayerId,
      worstPlayerId: obj.worstPlayerId,
      season: obj.season,
    };
  }

  return obj;
}

/**
 * Parte arrays em pedaços que cabem no limite.
 * Item único gigante é enxugado; se ainda não couber, vai sozinho (melhor erro claro depois).
 */
function shardArray(items: unknown[], prefix: string): ChunkDoc[] {
  if (items.length === 0) {
    return [{ id: `${prefix}-0`, payload: { items: [] } }];
  }

  const shards: ChunkDoc[] = [];
  let current: unknown[] = [];
  let size = 12; // {"items":[]}

  const flush = () => {
    if (current.length === 0) return;
    shards.push({ id: `${prefix}-${shards.length}`, payload: { items: current } });
    current = [];
    size = 12;
  };

  for (const raw of items) {
    let item = raw;
    let piece = estimateBytes(item);

    if (piece > MAX_DOC_BYTES) {
      item = slimOversizedItem(item, prefix);
      piece = estimateBytes(item);
    }

    const add = piece + (current.length ? 1 : 0);
    if (current.length > 0 && size + add > MAX_DOC_BYTES) {
      flush();
    }

    // Item sozinho ainda grande: grava sozinho (assertDocFits trata depois)
    if (current.length === 0 && piece > MAX_DOC_BYTES) {
      shards.push({ id: `${prefix}-${shards.length}`, payload: { items: [item] } });
      continue;
    }

    current.push(item);
    size += current.length === 1 ? piece : add;
  }
  flush();
  return shards;
}

function assertDocFits(doc: ChunkDoc): void {
  const size = estimateBytes(doc.payload);
  if (size > MAX_DOC_BYTES) {
    throw new Error(
      `Parte "${doc.id}" ainda grande demais (${Math.round(size / 1024)} KB). Abra o jogo logado de novo após atualizar.`,
    );
  }
}

function splitObjectFields(
  id: string,
  payload: Record<string, unknown>,
): ChunkDoc[] {
  const size = estimateBytes(payload);
  if (size <= MAX_DOC_BYTES) {
    return [{ id, payload }];
  }

  // Um campo por documento quando o objeto composto estoura
  const docs: ChunkDoc[] = [];
  for (const [key, value] of Object.entries(payload)) {
    const part: ChunkDoc = { id: `${id}-${key}`, payload: { [key]: value } };
    if (estimateBytes(part.payload) > MAX_DOC_BYTES && Array.isArray(value)) {
      docs.push(...shardArray(value, `${id}-${key}`));
    } else {
      docs.push(part);
    }
  }
  return docs.length > 0 ? docs : [{ id, payload }];
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

  // Sempre separar extras pesados (não esperar estourar)
  const pulseObj = pulse ?? null;
  const pulseHistory = Array.isArray(pulseObj?.history) ? pulseObj.history : [];
  const pulseCore = pulseObj
    ? { ...pulseObj, history: [] as typeof pulseHistory }
    : null;

  const transfersObj = transfers ?? null;
  const transferHistory = Array.isArray(transfersObj?.history)
    ? transfersObj.history
    : [];
  const transfersCore = transfersObj
    ? { ...transfersObj, history: [] as typeof transferHistory }
    : null;

  const extrasCore = {
    tactics: tactics ?? null,
    tacticsPresets: tacticsPresets ?? [],
    activeTacticsId: activeTacticsId ?? null,
    board: board ?? null,
    finance: finance ?? null,
  };

  const extrasDocs: ChunkDoc[] = [
    ...splitObjectFields('extras', extrasCore),
    ...splitObjectFields('extras-pulse', { pulse: pulseCore }),
    ...shardArray(pulseHistory, 'extras-pulse-history'),
    ...splitObjectFields('extras-transfers', { transfers: transfersCore }),
    ...shardArray(transferHistory, 'extras-transfers-history'),
    ...shardArray(seasonHistory ?? [], 'extras-history'),
  ];

  const docs = [...playerShards, ...matchShards, ...extrasDocs].map(d => ({
    id: d.id,
    payload: sanitizePayload(d.payload),
  }));
  for (const d of docs) assertDocFits(d);

  // Header enxuto: se careerPlayer/team forem enormes, ainda cabem — assert separado
  const header = sanitizePayload({
    ...headerRest,
    format: CHUNKED_FORMAT,
    revision: Date.now(),
    chunks: docs.map(d => d.id),
    _summary: {
      matchesPlayed: (matches ?? []).filter(m => m.status === 'completed').length,
      wins: save.team?.statistics?.wins,
      draws: save.team?.statistics?.draws,
      losses: save.team?.statistics?.losses,
    },
  });

  const headerSize = estimateBytes(header);
  if (headerSize > MAX_DOC_BYTES) {
    throw new Error(
      `Cabeçalho do save grande demais (${Math.round(headerSize / 1024)} KB).`,
    );
  }

  return { header, docs };
}

async function commitChunkBatches(
  uid: string,
  slotId: SaveSlotId,
  docs: ChunkDoc[],
  header: Record<string, unknown>,
): Promise<void> {
  const cleanDocs = docs.map(d => ({
    id: d.id,
    payload: sanitizePayload(d.payload),
  }));
  const cleanHeader = sanitizePayload(header);

  // Grava documento a documento — evita batch grande e isola falha
  for (const { id, payload } of cleanDocs) {
    try {
      await setDoc(chunkRef(uid, slotId, id), payload, { merge: false });
    } catch (err) {
      console.error(`Falha ao gravar chunk ${id}`, err);
      throw err;
    }
  }

  try {
    await setDoc(slotRef(uid, slotId), cleanHeader, { merge: false });
  } catch (err) {
    console.error('Falha ao gravar header do save', err);
    throw err;
  }
}

async function deleteChunkIds(
  uid: string,
  slotId: SaveSlotId,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const db = getFirestoreDb();
  for (let i = 0; i < ids.length; i += MAX_BATCH_OPS) {
    const slice = ids.slice(i, i + MAX_BATCH_OPS);
    const batch = writeBatch(db);
    for (const id of slice) {
      batch.delete(chunkRef(uid, slotId, id));
    }
    try {
      await batch.commit();
    } catch {
      /* limpeza best-effort */
    }
  }
}

async function readPreviousChunkIds(uid: string, slotId: SaveSlotId): Promise<string[]> {
  try {
    const snap = await readDoc(slotRef(uid, slotId));
    if (!snap.exists()) return [];
    const data = snap.data() as Record<string, unknown>;
    return Array.isArray(data.chunks) ? (data.chunks as string[]) : [];
  } catch {
    return [];
  }
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

function mergeExtrasField(
  chunks: Map<string, Record<string, unknown>>,
  rootKey: string,
  field: string,
): unknown {
  const root = chunks.get(rootKey);
  if (root && field in root) return root[field];

  // splitObjectFields → extras-tactics, extras-board, etc.
  const part = chunks.get(`${rootKey}-${field}`);
  if (part && field in part) return part[field];
  return undefined;
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

  const extrasRoot = chunks.get('extras') ?? {};
  const pulseFromDoc = mergeExtrasField(chunks, 'extras-pulse', 'pulse') as
    | GameSave['pulse']
    | undefined;
  const pulseLegacy = extrasRoot.pulse as GameSave['pulse'] | undefined;
  const pulseBase = pulseFromDoc ?? pulseLegacy;

  const pulseHistoryShards = collectItems<
    NonNullable<NonNullable<GameSave['pulse']>['history']>[number]
  >(chunks, 'extras-pulse-history');

  const pulse = pulseBase
    ? {
        ...pulseBase,
        history:
          pulseHistoryShards.length > 0
            ? pulseHistoryShards
            : (pulseBase.history ?? []),
      }
    : undefined;

  const transfersFromDoc = mergeExtrasField(chunks, 'extras-transfers', 'transfers') as
    | GameSave['transfers']
    | undefined;
  const transfersLegacy = extrasRoot.transfers as GameSave['transfers'] | undefined;
  const transfersBase = transfersFromDoc ?? transfersLegacy;
  const transferHistoryShards = collectItems<
    NonNullable<NonNullable<GameSave['transfers']>['history']>[number]
  >(chunks, 'extras-transfers-history');

  const transfers = transfersBase
    ? {
        ...transfersBase,
        history:
          transferHistoryShards.length > 0
            ? transferHistoryShards
            : (transfersBase.history ?? []),
      }
    : undefined;

  const history = collectItems<NonNullable<GameSave['seasonHistory']>[number]>(
    chunks,
    'extras-history',
  );

  const seasonHistory =
    history.length > 0
      ? history
      : ((extrasRoot.seasonHistory as GameSave['seasonHistory']) ?? []);

  const tactics =
    (mergeExtrasField(chunks, 'extras', 'tactics') as GameSave['tactics']) ??
    (extrasRoot.tactics as GameSave['tactics']) ??
    null;
  const tacticsPresets =
    (mergeExtrasField(chunks, 'extras', 'tacticsPresets') as GameSave['tacticsPresets']) ??
    (extrasRoot.tacticsPresets as GameSave['tacticsPresets']) ??
    [];
  const activeTacticsId =
    (mergeExtrasField(chunks, 'extras', 'activeTacticsId') as GameSave['activeTacticsId']) ??
    (extrasRoot.activeTacticsId as GameSave['activeTacticsId']) ??
    null;
  const board =
    (mergeExtrasField(chunks, 'extras', 'board') as GameSave['board']) ??
    (extrasRoot.board as GameSave['board']) ??
    undefined;
  const finance =
    (mergeExtrasField(chunks, 'extras', 'finance') as GameSave['finance']) ??
    (extrasRoot.finance as GameSave['finance']) ??
    undefined;

  const raw = {
    ...rest,
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
  } as GameSave;

  return migrateSave(raw as unknown as GameSave);
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

  const previousChunks = await readPreviousChunkIds(uid, slotId);
  const nextChunkIds = docs.map(d => d.id);

  try {
    await commitChunkBatches(uid, slotId, docs, header);
  } catch (err) {
    throw explainFirestoreError(err);
  }

  // Remove chunks antigos que não fazem mais parte do save
  const keep = new Set(nextChunkIds);
  const stale = previousChunks.filter(id => !keep.has(id));
  await deleteChunkIds(uid, slotId, stale);

  try {
    const summary = header._summary as
      | { matchesPlayed?: number }
      | undefined;
    await writeBatch(getFirestoreDb())
      .set(
        metaRef(uid, slotId),
        sanitizePayload({
          savedAt: header.savedAt,
          season: header.season,
          matchesPlayed:
            summary?.matchesPlayed ??
            (save.matches ?? []).filter(m => m.status === 'completed').length,
          teamName: save.team?.name ?? save.careerPlayer?.name ?? null,
          careerMode: save.careerMode,
          slotId,
          format: CHUNKED_FORMAT,
          revision: header.revision,
        }),
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
  const chunkIds = new Set<string>([
    'players',
    'matches',
    'extras',
    'extras-pulse',
    'extras-transfers',
  ]);
  if (headerSnap?.exists()) {
    const data = headerSnap.data() as Record<string, unknown>;
    if (Array.isArray(data.chunks)) {
      for (const id of data.chunks as string[]) chunkIds.add(id);
    }
  }
  for (let i = 0; i < 80; i++) {
    chunkIds.add(`players-${i}`);
    chunkIds.add(`matches-${i}`);
    chunkIds.add(`extras-history-${i}`);
    chunkIds.add(`extras-pulse-history-${i}`);
    chunkIds.add(`extras-transfers-history-${i}`);
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
