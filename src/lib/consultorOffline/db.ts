import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { assertValidPhotoBlob, clonePhotoBlob, getBlobDiagnostic } from "./photoBlob";

const DB_NAME = "consubov-consultor-offline";
const DB_VERSION = 2;

export interface FotoQueueItem {
  localId: string;
  visitaId: string;
  parentKind: "pasto" | "curral" | "topico";
  parentId: string;
  ordem: number;
  blob: Blob;
  mime: string;
  fileName?: string;
  size?: number;
  createdAt: string;
  lastAttemptAt?: string;
  tries: number;
  lastError?: string;
  status: "pending" | "uploading" | "error";
}

type StoredFotoQueueItem = Omit<FotoQueueItem, "blob"> & {
  blob?: Blob;
  blobBuffer?: ArrayBuffer;
  blobType?: string;
};

export interface VisitaSnapshot {
  visitaId: string;
  data: Record<string, any>;
  updatedAt: string;
}

export interface TextMutation {
  id: string;
  visitaId: string;
  table: string;
  rowId: string;
  operation?: "update" | "upsert" | "insert" | "delete";
  onConflict?: string;
  patch: Record<string, any>;
  createdAt: string;
  tries: number;
  status: "pending" | "flushing" | "error";
  lastError?: string;
}

interface ConsultorSchema extends DBSchema {
  foto_queue: {
    key: string;
    value: StoredFotoQueueItem;
    indexes: { "by-visita": string; "by-parent": [string, string] };
  };
  snapshots: {
    key: string;
    value: VisitaSnapshot;
  };
  text_mutations: {
    key: string;
    value: TextMutation;
    indexes: { "by-visita": string };
  };
}

let dbp: Promise<IDBPDatabase<ConsultorSchema>> | null = null;

function isBlobPreparationError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err || "");
  const name = err instanceof Error ? err.name : "";
  return /Blob\/File data|DataCloneError|structured clone|could not be cloned/i.test(`${name} ${message}`);
}

function describePhotoWrite(item: Pick<FotoQueueItem, "localId" | "visitaId" | "parentKind" | "parentId" | "ordem" | "mime" | "size" | "fileName" | "status">, blobValue?: unknown) {
  return {
    localId: item.localId,
    visitaId: item.visitaId,
    parentKind: item.parentKind,
    parentId: item.parentId,
    ordem: item.ordem,
    fileName: item.fileName,
    mime: item.mime,
    size: item.size,
    status: item.status,
    blob: getBlobDiagnostic(blobValue),
  };
}

async function hydrateFoto(item: StoredFotoQueueItem): Promise<FotoQueueItem> {
  if (item.blob) {
    assertValidPhotoBlob(item.blob, `foto ${item.ordem}`);
    return { ...item, blob: item.blob } as FotoQueueItem;
  }
  if (item.blobBuffer) {
    const blob = new Blob([item.blobBuffer.slice(0)], { type: item.blobType || item.mime || "image/jpeg" });
    assertValidPhotoBlob(blob, `foto ${item.ordem}`);
    return { ...item, blob } as FotoQueueItem;
  }
  console.error("[consultor-photo-idb] item de foto sem Blob armazenável", describePhotoWrite(item as FotoQueueItem, undefined));
  throw new Error(`Foto ${item.ordem}: dados locais ausentes`);
}

async function hydrateFotos(items: StoredFotoQueueItem[]): Promise<FotoQueueItem[]> {
  const settled = await Promise.allSettled(items.map(hydrateFoto));
  return settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value];
    console.error("[consultor-photo-idb] foto ignorada por dados locais inválidos", describePhotoWrite(items[index] as FotoQueueItem, (items[index] as StoredFotoQueueItem).blob), result.reason);
    return [];
  });
}

export function getDb() {
  if (!dbp) {
    dbp = openDB<ConsultorSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains("foto_queue")) {
          const store = db.createObjectStore("foto_queue", { keyPath: "localId" });
          store.createIndex("by-visita", "visitaId");
          store.createIndex("by-parent", ["parentKind", "parentId"]);
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains("snapshots")) {
            db.createObjectStore("snapshots", { keyPath: "visitaId" });
          }
          if (!db.objectStoreNames.contains("text_mutations")) {
            const s = db.createObjectStore("text_mutations", { keyPath: "id" });
            s.createIndex("by-visita", "visitaId");
          }
        }
      },
    });
  }
  return dbp;
}

// ===== Photo queue =====
export async function putFoto(item: FotoQueueItem) {
  const db = await getDb();
  const { blob, buffer } = await clonePhotoBlob(item.blob, item.mime || "image/jpeg");
  const normalized: StoredFotoQueueItem = {
    ...item,
    blob,
    mime: blob.type || item.mime || "image/jpeg",
    size: item.size ?? blob.size,
  };
  try {
    await db.put("foto_queue", normalized);
  } catch (err) {
    console.error("[consultor-photo-idb] falha ao gravar foto no IndexedDB", describePhotoWrite(normalized as FotoQueueItem, normalized.blob), err);
    if (!isBlobPreparationError(err)) throw err;

    // WebKit/iOS pode rejeitar Blob/File genuíno no IndexedDB. Para não criar
    // pendência fantasma, persistimos os bytes clonáveis e reidratamos Blob ao ler.
    const fallback: StoredFotoQueueItem = {
      ...normalized,
      blob: undefined,
      blobBuffer: buffer.slice(0),
      blobType: normalized.mime,
    };
    try {
      await db.put("foto_queue", fallback);
      console.warn("[consultor-photo-idb] foto salva com fallback ArrayBuffer após rejeição de Blob/File", describePhotoWrite(fallback as FotoQueueItem, blob));
    } catch (fallbackErr) {
      console.error("[consultor-photo-idb] fallback ArrayBuffer também falhou; foto não entrou na fila", describePhotoWrite(fallback as FotoQueueItem, blob), fallbackErr);
      throw fallbackErr;
    }
  }
}
export async function deleteFoto(localId: string) {
  const db = await getDb();
  await db.delete("foto_queue", localId);
}
export async function getFoto(localId: string) {
  const db = await getDb();
  const item = await db.get("foto_queue", localId);
  return item ? hydrateFoto(item) : undefined;
}
export async function updateFotoOrdem(localId: string, ordem: number) {
  const current = await getFoto(localId);
  if (!current) return;
  await putFoto({ ...current, ordem });
}
export async function listFotosByParent(kind: "pasto" | "curral" | "topico", id: string) {
  const db = await getDb();
  return hydrateFotos(await db.getAllFromIndex("foto_queue", "by-parent", [kind, id]));
}
export async function listFotosByParentRaw(kind: "pasto" | "curral" | "topico", id: string) {
  const db = await getDb();
  return db.getAllFromIndex("foto_queue", "by-parent", [kind, id]);
}
export async function deleteFotosByVisita(visitaId: string) {
  const db = await getDb();
  const keys = await db.getAllKeysFromIndex("foto_queue", "by-visita", visitaId);
  await Promise.all(keys.map((k) => db.delete("foto_queue", k)));
  return keys.length;
}
export async function deleteFotosByParent(kind: "pasto" | "curral" | "topico", id: string) {
  const db = await getDb();
  const items = await db.getAllFromIndex("foto_queue", "by-parent", [kind, id]);
  await Promise.all(items.map((it) => db.delete("foto_queue", it.localId)));
  return items.length;
}
export async function deleteMutationsByVisita(visitaId: string) {
  const db = await getDb();
  const keys = await db.getAllKeysFromIndex("text_mutations", "by-visita", visitaId);
  await Promise.all(keys.map((k) => db.delete("text_mutations", k)));
  return keys.length;
}

export async function listAllFotos() {
  const db = await getDb();
  return hydrateFotos(await db.getAll("foto_queue"));
}
export async function listFotosByVisita(visitaId: string) {
  const items = await listAllFotos();
  return items.filter((item) => item.visitaId === visitaId);
}
export async function listFailedFotos() {
  const items = await listAllFotos();
  return items.filter((item) => item.status === "error");
}
export async function retryFoto(localId: string) {
  const current = await getFoto(localId);
  if (!current) return;
  await putFoto({
    ...current,
    status: "pending",
    tries: 0,
    lastError: undefined,
    lastAttemptAt: undefined,
  });
}
export async function countAllFotos() {
  const items = await listAllFotos();
  return items.length;
}
// Conta TODAS as fotos ainda no cache local. Uma foto só sai do cache quando é
// confirmada no Supabase Storage — portanto qualquer item aqui é pendente.
export async function countPendingFotos() {
  const items = await listAllFotos();
  return items.length;
}
// Nunca remover fotos automaticamente: só apagamos após upload confirmado.
export async function purgeDeadFotos() { /* no-op */ }

// ===== Snapshots =====
export async function getSnapshot(visitaId: string) {
  const db = await getDb();
  return db.get("snapshots", visitaId);
}
export async function listAllSnapshots() {
  const db = await getDb();
  return db.getAll("snapshots");
}
export async function putSnapshot(snap: VisitaSnapshot) {
  const db = await getDb();
  await db.put("snapshots", snap);
}

// ===== Text mutations =====
export async function putMutation(m: TextMutation) {
  const db = await getDb();
  await db.put("text_mutations", m);
}
export async function deleteMutation(id: string) {
  const db = await getDb();
  await db.delete("text_mutations", id);
}
export async function listAllMutations() {
  const db = await getDb();
  return db.getAll("text_mutations");
}
export async function countAllMutations() {
  const db = await getDb();
  return db.count("text_mutations");
}
// Conta TODAS as mutações no cache local. Uma mutação só sai do cache quando é
// confirmada pelo Supabase.
export async function countPendingMutations() {
  const items = await listAllMutations();
  return items.length;
}
export async function purgeDeadMutations() { /* no-op */ }
export async function listMutationsByVisita(visitaId: string) {
  const db = await getDb();
  return db.getAllFromIndex("text_mutations", "by-visita", visitaId);
}

export async function listPendingVisitaIds() {
  const [mutations, fotos, snapshots] = await Promise.all([listAllMutations(), listAllFotos(), listAllSnapshots()]);
  const deletedIds = new Set<string>();
  snapshots.forEach((snap) => {
    if ((snap.data as any)?.visita?.deleted_at) deletedIds.add(snap.visitaId);
  });
  mutations.forEach((m) => {
    const id = m.visitaId || m.rowId;
    if (m.table === "visitas_tecnicas" && id && m.patch?.deleted_at) deletedIds.add(id);
  });
  const ids = new Set<string>();
  mutations.forEach((m) => { if (m.visitaId && !deletedIds.has(m.visitaId)) ids.add(m.visitaId); });
  fotos.forEach((f) => { if (f.visitaId && !deletedIds.has(f.visitaId)) ids.add(f.visitaId); });
  return Array.from(ids);
}

// Lista os itens crus da fila de fotos (sem hidratar Blob). Usado na limpeza de
// órfãos para que itens com dados locais ilegíveis também possam ser removidos.
export async function listAllFotosRaw() {
  const db = await getDb();
  return db.getAll("foto_queue");
}
