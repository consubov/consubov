import { supabase } from "@/integrations/supabase/client";
import {
  countAllFotos,
  deleteFoto,
  getFoto,
  listAllFotos,
  listFotosByParent,
  putFoto,
  type FotoQueueItem,
} from "./db";
import { drainMutations } from "./mutationQueue";
import { patchSnapshot } from "./snapshotStore";

const BUCKET = "visitas-consultor-fotos";

type Listener = (pending: number, syncing: boolean) => void;
const listeners = new Set<Listener>();
let syncing = false;
let cachedPending = 0;

function withTimeout<T>(promise: PromiseLike<T>, ms = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("Tempo limite de conexão excedido")), ms);
    Promise.resolve(promise).then(
      (value) => { window.clearTimeout(t); resolve(value); },
      (error) => { window.clearTimeout(t); reject(error); },
    );
  });
}

async function refreshPendingCount() {
  cachedPending = await countAllFotos();
  emit();
}

function emit() {
  listeners.forEach((l) => l(cachedPending, syncing));
}

export function subscribeSyncStatus(listener: Listener) {
  listeners.add(listener);
  // fire immediately with current state
  listener(cachedPending, syncing);
  void refreshPendingCount();
  return () => listeners.delete(listener);
}

export async function enqueuePhoto(params: {
  visitaId: string;
  parentKind: "pasto" | "curral" | "topico";
  parentId: string;
  ordem: number;
  blob: Blob;
}): Promise<FotoQueueItem> {
  const localId = `foto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const item: FotoQueueItem = {
    localId,
    visitaId: params.visitaId,
    parentKind: params.parentKind,
    parentId: params.parentId,
    ordem: params.ordem,
    blob: params.blob,
    mime: params.blob.type || "image/jpeg",
    createdAt: new Date().toISOString(),
    tries: 0,
    status: "pending",
  };
  await putFoto(item);
  await refreshPendingCount();
  // fire drain in background
  if (typeof navigator === "undefined" || navigator.onLine) void drain();
  return item;
}

export async function getQueuedPhotosForParent(kind: "pasto" | "curral" | "topico", id: string) {
  return listFotosByParent(kind, id);
}

async function uploadOne(item: FotoQueueItem): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) return false;
    item.status = "uploading";
    await putFoto(item);
    emit();

    const folder = item.parentKind === "curral" ? "currais" : item.parentKind === "topico" ? "topicos" : "pastos";
    const path = `${folder}/${item.parentId}/${item.ordem}-${item.localId}.jpg`;
    const { error: upErr } = await withTimeout(supabase.storage
      .from(BUCKET)
      .upload(path, item.blob, { upsert: true, contentType: item.mime }), 20000);
    if (upErr) throw upErr;

    const insertPayload: any = { url: path, ordem: item.ordem };
    if (item.parentKind === "curral") insertPayload.visita_curral_id = item.parentId;
    else if (item.parentKind === "topico") insertPayload.visita_topico_id = item.parentId;
    else insertPayload.visita_pasto_id = item.parentId;

    const table = item.parentKind === "topico" ? "visita_topico_fotos" : "visita_fotos";
    const existingRes = await withTimeout((supabase as any)
      .from(table)
      .select("*")
      .eq("url", path)
      .maybeSingle(), 10000);
    let inserted = existingRes.data;
    let insErr = existingRes.error;
    if (!inserted && !insErr) {
      const insertRes = await withTimeout((supabase as any)
        .from(table)
        .insert(insertPayload)
        .select("*")
        .single(), 10000);
      inserted = insertRes.data;
      insErr = insertRes.error;
    }
    if (insErr) throw insErr;

    await deleteFoto(item.localId);
    await patchSnapshot(item.visitaId, (curr) => {
      const queuedUrl = `queued:${item.localId}`;
      const replaceFoto = (parent: any) => {
        const signed = { ...(parent.signed || {}) };
        delete signed[item.localId];
        const fotos = ((parent.fotos || []) as any[])
          .filter((f) => f.id !== item.localId && f.url !== queuedUrl);
        if (inserted) fotos.push(inserted);
        fotos.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        return { ...parent, fotos, signed };
      };

      if (item.parentKind === "curral") {
        return {
          ...curr,
          currais: (curr.currais || []).map((c: any) => c.id === item.parentId ? replaceFoto(c) : c),
        };
      }
      if (item.parentKind === "topico") {
        return {
          ...curr,
          topicos: (curr.topicos || []).map((t: any) => t.id === item.parentId ? replaceFoto(t) : t),
        };
      }
      return {
        ...curr,
        pastos: (curr.pastos || []).map((p: any) => p.id === item.parentId ? replaceFoto(p) : p),
      };
    }).catch(() => null);
    await refreshPendingCount();
    return true;
  } catch (err) {
    const current = await getFoto(item.localId);
    if (current) {
      current.status = "error";
      current.tries = (current.tries ?? 0) + 1;
      current.lastError = (err as Error)?.message || String(err);
      await putFoto(current);
    }
    emit();
    return false;
  }
}

let drainPromise: Promise<void> | null = null;

export async function drain(): Promise<void> {
  if (drainPromise) return drainPromise;
  drainPromise = (async () => {
    syncing = true;
    emit();
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      // Primeiro sincroniza textos/linhas novas para evitar erro de FK nas fotos.
      await drainMutations();
      // process in a loop until empty or all failing
      let attempts = 0;
      while (attempts < 50) {
        const items = await listAllFotos();
        const target = items.find((i) => i.status !== "error" || (i.tries ?? 0) < 3);
        if (!target) break;
        const ok = await uploadOne(target);
        if (!ok && ((target.tries ?? 0) >= 3 || (typeof navigator !== "undefined" && !navigator.onLine))) {
          // stop trying this one for now
          break;
        }
        attempts++;
      }
    } finally {
      syncing = false;
      await refreshPendingCount();
    }
  })();
  try {
    await drainPromise;
  } finally {
    drainPromise = null;
  }
}

export async function syncNow() {
  // reset error status so failed items get retried
  const items = await listAllFotos();
  for (const it of items) {
    if (it.status === "error" || it.status === "uploading") {
      it.status = "pending";
      it.tries = 0;
      it.lastError = undefined;
      await putFoto(it);
    }
  }
  await drain();
}

// auto-drain on network reconnect
if (typeof window !== "undefined") {
  window.addEventListener("online", () => void drain());
  // initial drain
  void drain();
}

export async function getPendingCount() {
  return countAllFotos();
}
