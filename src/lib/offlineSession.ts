/**
 * Persists the Supabase auth session AND the capataz reference data to
 * IndexedDB so the app can fully restore state offline — the capataz never
 * needs to return to base just because their token expired.
 *
 * Uses a tiny dedicated IDB database (separate from the main offline DB)
 * to avoid coupling schema upgrades.
 */

import { openDB, type IDBPDatabase } from "idb";
import type { Session } from "@supabase/supabase-js";

const DB_NAME = "consubov-session";
const DB_VERSION = 1;
const STORE_AUTH = "auth_session";
const STORE_REF = "offline_data";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_AUTH)) {
          db.createObjectStore(STORE_AUTH);
        }
        if (!db.objectStoreNames.contains(STORE_REF)) {
          db.createObjectStore(STORE_REF);
        }
      },
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export interface PersistedAuthSession {
  user_id: string;
  email: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  retiro_id?: string | null;
  retiro_name?: string | null;
  fazenda_name?: string | null;
  user_name?: string | null;
  saved_at: string; // ISO
}

export async function saveAuthSession(data: PersistedAuthSession) {
  try {
    const db = await getDb();
    await db.put(STORE_AUTH, data, "current");
  } catch (err) {
    console.warn("[offlineSession] saveAuthSession failed:", err);
  }
}

export async function getAuthSession(): Promise<PersistedAuthSession | null> {
  try {
    const db = await getDb();
    return (await db.get(STORE_AUTH, "current")) ?? null;
  } catch (err) {
    console.warn("[offlineSession] getAuthSession failed:", err);
    return null;
  }
}

export async function clearAuthSession() {
  try {
    const db = await getDb();
    await db.delete(STORE_AUTH, "current");
  } catch {
    /* ignore */
  }
}

/** Build a persisted session payload from a live Supabase Session. */
export function buildSessionPayload(
  session: Session,
  extras: Partial<Pick<PersistedAuthSession, "retiro_id" | "retiro_name" | "fazenda_name" | "user_name">> = {},
): PersistedAuthSession {
  return {
    user_id: session.user.id,
    email: session.user.email ?? null,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    saved_at: new Date().toISOString(),
    ...extras,
  };
}

// ============================================================
// Reference data (pastos / retiros / produtos / metas / config)
// ============================================================

export interface OfflineReferenceData {
  pastos?: any[];
  retiros?: any[];
  produtos?: any[];
  metas?: any[];
  capatazConfig?: any;
  lastUpdated: string;
}

export async function saveReferenceData(data: Omit<OfflineReferenceData, "lastUpdated">) {
  try {
    const db = await getDb();
    await db.put(
      STORE_REF,
      { ...data, lastUpdated: new Date().toISOString() } satisfies OfflineReferenceData,
      "current",
    );
  } catch (err) {
    console.warn("[offlineSession] saveReferenceData failed:", err);
  }
}

export async function getReferenceData(): Promise<OfflineReferenceData | null> {
  try {
    const db = await getDb();
    return (await db.get(STORE_REF, "current")) ?? null;
  } catch {
    return null;
  }
}
