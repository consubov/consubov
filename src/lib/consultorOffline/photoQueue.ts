import { supabase } from "@/integrations/supabase/client";
import {
  countPendingFotos,
  deleteFoto,
  getFoto,
  listFailedFotos,
  listAllFotos,
  listFotosByParent,
  putFoto,
  purgeDeadFotos,
  retryFoto,
  type FotoQueueItem,
} from "./db";
import { drainMutations } from "./mutationQueue";
import { CONSULTOR_NETWORK_TIMEOUT_MS, CONSULTOR_PHOTO_UPLOAD_TIMEOUT_MS, getErrorMessage, sleep, withConsultorTimeout } from "./network";
import { patchSnapshot } from "./snapshotStore";

const BUCKET = "visitas-consultor-fotos";

export interface PhotoFailureDetail {
  localId: string;
  visitaId: string;
  parentKind: "pasto" | "curral" | "topico";
  parentId: string;
  ordem: number;
  label: string;
  mime: string;
  size: number;
  sizeLabel: string;
  fileName?: string;
  tries: number;
  lastError: string;
}

type Listener = (pending: number, syncing: boolean, failures: PhotoFailureDetail[]) => void;
const listeners = new Set<Listener>();
let syncing = false;
let cachedPending = 0;
let cachedFailures: PhotoFailureDetail[] = [];
const MAX_AUTO_RETRIES = 3;

function formatBytes(size = 0): string {
  if (size <= 0) return "tamanho desconhecido";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function describeQueuedPhoto(item: FotoQueueItem): PhotoFailureDetail {
  const tipo = item.parentKind === "curral" ? "curral" : item.parentKind === "topico" ? "tópico" : "pasto";
  const size = item.size ?? item.blob?.size ?? 0;
  return {
    localId: item.localId,
    visitaId: item.visitaId,
    parentKind: item.parentKind,
    parentId: item.parentId,
    ordem: item.ordem,
    label: `Foto ${item.ordem} do ${tipo}`,
    mime: item.mime || "image/jpeg",
    size,
    sizeLabel: formatBytes(size),
    fileName: item.fileName,
    tries: item.tries ?? 0,
    lastError: item.lastError || "falha desconhecida",
  };
}

function debugSync(message: string, payload?: Record<string, unknown>) {
  if (import.meta.env.DEV) console.debug(`[consultor-sync] ${message}`, payload ?? {});
}

async function refreshPendingCount() {
  await purgeDeadFotos();
  cachedPending = await countPendingFotos();
  cachedFailures = (await listFailedFotos()).map(describeQueuedPhoto);
  emit();
}

function emit() {
  listeners.forEach((l) => l(cachedPending, syncing, cachedFailures));
}

export function subscribeSyncStatus(listener: Listener) {
  listeners.add(listener);
  // fire immediately with current state
  listener(cachedPending, syncing, cachedFailures);
  void refreshPendingCount();
  return () => listeners.delete(listener);
}

export async function getPhotoFailures() {
  return (await listFailedFotos()).map(describeQueuedPhoto);
}

export async function retryQueuedPhoto(localId: string) {
  await retryFoto(localId);
  await refreshPendingCount();
  if (typeof navigator === "undefined" || navigator.onLine) void drain();
}

export async function enqueuePhoto(params: {
  visitaId: string;
  parentKind: "pasto" | "curral" | "topico";
  parentId: string;
  ordem: number;
  blob: Blob;
  fileName?: string;
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
    fileName: params.fileName,
    size: params.blob.size,
    createdAt: new Date().toISOString(),
    tries: 0,
    status: "pending",
  };
  await putFoto(item);
  await refreshPendingCount();
  // Dá tempo para o componente persistir o preview no snapshot antes do upload
  // começar; evita corrida em que o servidor confirma e depois o caller grava
  // uma foto `queued:` obsoleta sobre o snapshot atualizado.
  if (typeof window !== "undefined" && (typeof navigator === "undefined" || navigator.onLine)) {
    window.setTimeout(() => void drain(), 250);
  }
  return item;
}

export async function getQueuedPhotosForParent(kind: "pasto" | "curral" | "topico", id: string) {
  return listFotosByParent(kind, id);
}

async function uploadOne(item: FotoQueueItem): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) return false;
    item.status = "uploading";
    item.lastAttemptAt = new Date().toISOString();
    await putFoto(item);
    await refreshPendingCount();
    debugSync("enviando foto", {
      localId: item.localId,
      visitaId: item.visitaId,
      parentKind: item.parentKind,
      parentId: item.parentId,
      ordem: item.ordem,
      mime: item.mime,
      size: item.size ?? item.blob.size,
      fileName: item.fileName,
    });

    const folder = item.parentKind === "curral" ? "currais" : item.parentKind === "topico" ? "topicos" : "pastos";
    const path = `${folder}/${item.parentId}/${item.ordem}-${item.localId}.jpg`;
    const { error: upErr } = await withConsultorTimeout(supabase.storage
      .from(BUCKET)
      .upload(path, item.blob, { upsert: true, contentType: item.mime }),
      `upload da foto ${item.ordem}`,
      CONSULTOR_PHOTO_UPLOAD_TIMEOUT_MS,
    );
    if (upErr) throw upErr;

    const insertPayload: any = { url: path, ordem: item.ordem };
    if (item.parentKind === "curral") insertPayload.visita_curral_id = item.parentId;
    else if (item.parentKind === "topico") insertPayload.visita_topico_id = item.parentId;
    else insertPayload.visita_pasto_id = item.parentId;

    const table = item.parentKind === "topico" ? "visita_topico_fotos" : "visita_fotos";
    const existingRes: any = await withConsultorTimeout((supabase as any)
      .from(table)
      .select("*")
      .eq("url", path)
      .maybeSingle(),
      `confirmação da foto ${item.ordem}`,
      CONSULTOR_NETWORK_TIMEOUT_MS,
    );
    let inserted = existingRes.data;
    let insErr = existingRes.error;
    if (!inserted && !insErr) {
      const insertRes: any = await withConsultorTimeout((supabase as any)
        .from(table)
        .insert(insertPayload)
        .select("*")
        .single(),
        `registro da foto ${item.ordem}`,
        CONSULTOR_NETWORK_TIMEOUT_MS,
      );
      inserted = insertRes.data;
      insErr = insertRes.error;
    }
    if (insErr) throw insErr;

    debugSync("foto confirmada pelo servidor", {
      localId: item.localId,
      visitaId: item.visitaId,
      table,
      rowId: inserted?.id,
      path,
    });
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
    debugSync("foto mantida no IndexedDB após falha", {
      localId: item.localId,
      visitaId: item.visitaId,
      error: getErrorMessage(err),
    });
    const current = await getFoto(item.localId);
    if (current) {
      current.status = "error";
      current.tries = (current.tries ?? 0) + 1;
      current.lastError = getErrorMessage(err);
      await putFoto(current);
    }
    await refreshPendingCount();
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
      try {
        await withConsultorTimeout(drainMutations(), "sincronização dos dados antes das fotos", CONSULTOR_NETWORK_TIMEOUT_MS * 2);
      } catch (err) {
        debugSync("sincronização de dados antes das fotos falhou", { error: getErrorMessage(err) });
        return;
      }
      // Processa todas as fotos aptas; uma falha individual não bloqueia as demais.
      let rounds = 0;
      while (rounds < MAX_AUTO_RETRIES) {
        const items = (await listAllFotos()).filter((i) => (i.tries ?? 0) < MAX_AUTO_RETRIES);
        if (!items.length) break;
        const results = await Promise.all(items.map(uploadOne));
        if (typeof navigator !== "undefined" && !navigator.onLine) break;
        if (results.every(Boolean)) continue;
        rounds++;
        if (rounds < MAX_AUTO_RETRIES) await sleep(650 * rounds);
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
  await withConsultorTimeout(
    drain(),
    "sincronização das fotos",
    CONSULTOR_PHOTO_UPLOAD_TIMEOUT_MS * MAX_AUTO_RETRIES + 15_000,
  );
}

// auto-drain on network reconnect
if (typeof window !== "undefined") {
  window.addEventListener("online", () => void drain().catch((err) => debugSync("auto-sync de fotos falhou", { error: getErrorMessage(err) })));
  // initial drain
  void drain().catch((err) => debugSync("sync inicial de fotos falhou", { error: getErrorMessage(err) }));
}

export async function getPendingCount() {
  return countPendingFotos();
}
