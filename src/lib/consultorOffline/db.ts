import { openDB, type DBSchema, type IDBPDatabase } from "idb";

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
  createdAt: string;
  tries: number;
  lastError?: string;
  status: "pending" | "uploading" | "error";
}

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
    value: FotoQueueItem;
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
  await db.put("foto_queue", item);
}
export async function deleteFoto(localId: string) {
  const db = await getDb();
  await db.delete("foto_queue", localId);
}
export async function getFoto(localId: string) {
  const db = await getDb();
  return db.get("foto_queue", localId);
}
export async function updateFotoOrdem(localId: string, ordem: number) {
  const current = await getFoto(localId);
  if (!current) return;
  await putFoto({ ...current, ordem });
}
export async function listFotosByParent(kind: "pasto" | "curral" | "topico", id: string) {
  const db = await getDb();
  return db.getAllFromIndex("foto_queue", "by-parent", [kind, id]);
}
export async function listAllFotos() {
  const db = await getDb();
  return db.getAll("foto_queue");
}
export async function listFotosByVisita(visitaId: string) {
  const db = await getDb();
  const items = await db.getAll("foto_queue");
  return items.filter((item) => item.visitaId === visitaId);
}
export async function countAllFotos() {
  const db = await getDb();
  return db.count("foto_queue");
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
  const [mutations, fotos] = await Promise.all([listAllMutations(), listAllFotos()]);
  const ids = new Set<string>();
  mutations.forEach((m) => { if (m.visitaId) ids.add(m.visitaId); });
  fotos.forEach((f) => { if (f.visitaId) ids.add(f.visitaId); });
  return Array.from(ids);
}
