import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "consubov-consultor-offline";
const DB_VERSION = 1;

export interface FotoQueueItem {
  localId: string;
  visitaId: string;
  parentKind: "pasto" | "curral";
  parentId: string;
  ordem: number;
  blob: Blob;
  mime: string;
  createdAt: string;
  tries: number;
  lastError?: string;
  status: "pending" | "uploading" | "error";
}

interface ConsultorSchema extends DBSchema {
  foto_queue: {
    key: string;
    value: FotoQueueItem;
    indexes: { "by-visita": string; "by-parent": [string, string] };
  };
}

let dbp: Promise<IDBPDatabase<ConsultorSchema>> | null = null;

export function getDb() {
  if (!dbp) {
    dbp = openDB<ConsultorSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("foto_queue")) {
          const store = db.createObjectStore("foto_queue", { keyPath: "localId" });
          store.createIndex("by-visita", "visitaId");
          store.createIndex("by-parent", ["parentKind", "parentId"]);
        }
      },
    });
  }
  return dbp;
}

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

export async function listFotosByParent(kind: "pasto" | "curral", id: string) {
  const db = await getDb();
  return db.getAllFromIndex("foto_queue", "by-parent", [kind, id]);
}

export async function listAllFotos() {
  const db = await getDb();
  return db.getAll("foto_queue");
}

export async function countAllFotos() {
  const db = await getDb();
  return db.count("foto_queue");
}
