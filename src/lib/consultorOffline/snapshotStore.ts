import { getSnapshot, listAllSnapshots, listFotosByVisita, listMutationsByVisita, putSnapshot } from "./db";
import { supabase } from "@/integrations/supabase/client";
import { enqueueMutation } from "./mutationQueue";

function withTimeout<T>(promise: PromiseLike<T>, ms = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("Tempo limite de conexão excedido")), ms);
    Promise.resolve(promise).then(
      (value) => { window.clearTimeout(t); resolve(value); },
      (error) => { window.clearTimeout(t); reject(error); },
    );
  });
}

/**
 * Full offline snapshot of a visita — everything needed to render the
 * revisão screens without a network connection.
 */
export interface VisitaSnapshotData {
  visita?: any;
  fazenda?: any;
  consultor?: any;
  currais?: any[];
  pastos?: any[];
  topicos?: any[];
  avaliacoes_score?: any[];
  avaliacoes_fabrica?: any[];
  avaliacao_fabrica_visita?: any;
  fotos?: any[];
  [k: string]: any;
}

export async function loadSnapshot(visitaId: string): Promise<VisitaSnapshotData | null> {
  const snap = await getSnapshot(visitaId);
  return snap ? (snap.data as VisitaSnapshotData) : null;
}

export async function saveSnapshot(visitaId: string, data: VisitaSnapshotData) {
  await putSnapshot({
    visitaId,
    data,
    updatedAt: new Date().toISOString(),
  });
}

export async function loadAllSnapshots(): Promise<Array<{ visitaId: string; data: VisitaSnapshotData; updatedAt: string }>> {
  const rows = await listAllSnapshots();
  return rows.map((row) => ({ visitaId: row.visitaId, data: row.data as VisitaSnapshotData, updatedAt: row.updatedAt }));
}

export async function hasPendingLocalChanges(visitaId: string): Promise<boolean> {
  try {
    const [mutations, fotos] = await Promise.all([
      listMutationsByVisita(visitaId),
      listFotosByVisita(visitaId),
    ]);
    return mutations.length > 0 || fotos.length > 0;
  } catch {
    return false;
  }
}

/**
 * Força uma sincronização e aguarda até que a visita informada não tenha mais
 * itens pendentes no cache local (fotos + mutações). Resolve `true` se tudo
 * foi sincronizado dentro do timeout; caso contrário resolve `false`.
 */
export async function syncVisitaAndWait(visitaId: string, timeoutMs = 90000): Promise<boolean> {
  const { syncNow: syncPhotosNow } = await import("./photoQueue");
  const { retryFailedMutations } = await import("./mutationQueue");
  // Dispara em paralelo — não bloqueia esperando cada drain aqui, pois eles
  // possuem locks internos e o polling abaixo confirma o resultado real.
  void retryFailedMutations().catch(() => {});
  void syncPhotosNow().catch(() => {});

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!(await hasPendingLocalChanges(visitaId))) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return !(await hasPendingLocalChanges(visitaId));
}

/** Merge a partial patch into the current snapshot. Serialized per visitaId to avoid races. */
const patchLocks = new Map<string, Promise<void>>();
export async function patchSnapshot(
  visitaId: string,
  patcher: (current: VisitaSnapshotData) => VisitaSnapshotData,
) {
  const prev = patchLocks.get(visitaId) ?? Promise.resolve();
  const next = prev.then(async () => {
    const current = (await loadSnapshot(visitaId)) ?? {};
    const merged = patcher(current);
    await saveSnapshot(visitaId, merged);
  }).catch((err) => { console.warn("[patchSnapshot] error:", err); });
  patchLocks.set(visitaId, next);
  try { await next; } finally {
    if (patchLocks.get(visitaId) === next) patchLocks.delete(visitaId);
  }
}

/**
 * Wrapper para UPDATE que:
 *  1. Aplica o patch imediatamente ao snapshot local (persistência entre sessões).
 *  2. Tenta gravar no Supabase. Se falhar por rede/erro transitório, enfileira.
 *
 * Retorna { ok, queued } — nunca lança.
 */
export async function offlineUpdate(params: {
  visitaId: string;
  table: string;
  rowId: string;
  patch: Record<string, any>;
  /** Function to merge the patch into the snapshot (defaults to top-level "visita"). */
  applyToSnapshot?: (current: VisitaSnapshotData, patch: Record<string, any>) => VisitaSnapshotData;
}): Promise<{ ok: boolean; queued: boolean }> {
  const applier =
    params.applyToSnapshot ??
    ((current: VisitaSnapshotData, patch: Record<string, any>) => {
      // default: assume this updates the main `visita` row
      const v = current.visita ?? {};
      return { ...current, visita: { ...v, ...patch } };
    });

  // 1. Snapshot local
  try {
    await patchSnapshot(params.visitaId, (curr) => applier(curr, params.patch));
  } catch (err) {
    console.warn("[offlineUpdate] snapshot patch failed:", err);
  }

  // 2. Se estiver offline, vai direto para a fila
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    await enqueueMutation({
      visitaId: params.visitaId,
      table: params.table,
      rowId: params.rowId,
      patch: params.patch,
    });
    return { ok: false, queued: true };
  }

  // 3. Tenta gravar online
  try {
    const { error, count } = await withTimeout<any>((supabase as any)
      .from(params.table)
      .update(params.patch, { count: "exact" })
      .eq("id", params.rowId));
    if (error) throw error;
    if (count === 0) throw new Error(`Servidor não confirmou atualização em ${params.table}`);
    return { ok: true, queued: false };
  } catch (err) {
    console.warn("[offlineUpdate] direct write failed, enqueueing:", err);
    await enqueueMutation({
      visitaId: params.visitaId,
      table: params.table,
      rowId: params.rowId,
      patch: params.patch,
    });
    return { ok: false, queued: true };
  }
}

/**
 * Upsert com suporte off-line para linhas criadas no aparelho.
 * Usa IDs gerados no cliente, grava primeiro no snapshot local e depois tenta o Supabase.
 */
export async function offlineUpsert(params: {
  visitaId: string;
  table: string;
  rowId: string;
  payload: Record<string, any>;
  onConflict?: string;
  applyToSnapshot?: (current: VisitaSnapshotData, payload: Record<string, any>) => VisitaSnapshotData;
}): Promise<{ ok: boolean; queued: boolean }> {
  try {
    if (params.applyToSnapshot) {
      await patchSnapshot(params.visitaId, (curr) => params.applyToSnapshot!(curr, params.payload));
    }
  } catch (err) {
    console.warn("[offlineUpsert] snapshot patch failed:", err);
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    await enqueueMutation({
      visitaId: params.visitaId,
      table: params.table,
      rowId: params.rowId,
      operation: "upsert",
      onConflict: params.onConflict ?? "id",
      patch: params.payload,
    });
    return { ok: false, queued: true };
  }

  try {
    const { error, count } = await withTimeout<any>((supabase as any)
      .from(params.table)
      .upsert({ id: params.rowId, ...params.payload }, { onConflict: params.onConflict ?? "id", count: "exact" }));
    if (error) throw error;
    if (count === 0) throw new Error(`Servidor não confirmou gravação em ${params.table}`);
    return { ok: true, queued: false };
  } catch (err) {
    console.warn("[offlineUpsert] direct write failed, enqueueing:", err);
    await enqueueMutation({
      visitaId: params.visitaId,
      table: params.table,
      rowId: params.rowId,
      operation: "upsert",
      onConflict: params.onConflict ?? "id",
      patch: params.payload,
    });
    return { ok: false, queued: true };
  }
}

/** Delete off-line first: updates the local snapshot immediately and queues the DB delete if needed. */
export async function offlineDelete(params: {
  visitaId: string;
  table: string;
  rowId: string;
  applyToSnapshot?: (current: VisitaSnapshotData) => VisitaSnapshotData;
}): Promise<{ ok: boolean; queued: boolean }> {
  try {
    if (params.applyToSnapshot) {
      await patchSnapshot(params.visitaId, (curr) => params.applyToSnapshot!(curr));
    }
  } catch (err) {
    console.warn("[offlineDelete] snapshot patch failed:", err);
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    await enqueueMutation({
      visitaId: params.visitaId,
      table: params.table,
      rowId: params.rowId,
      operation: "delete",
      patch: {},
    });
    return { ok: false, queued: true };
  }

  try {
    const { error, count } = await withTimeout<any>((supabase as any).from(params.table).delete({ count: "exact" }).eq("id", params.rowId));
    if (error) throw error;
    if (count === 0) throw new Error(`Servidor não confirmou exclusão em ${params.table}`);
    return { ok: true, queued: false };
  } catch (err) {
    console.warn("[offlineDelete] direct delete failed, enqueueing:", err);
    await enqueueMutation({
      visitaId: params.visitaId,
      table: params.table,
      rowId: params.rowId,
      operation: "delete",
      patch: {},
    });
    return { ok: false, queued: true };
  }
}
