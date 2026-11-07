import { getSnapshot, listAllSnapshots, listFotosByVisita, listMutationsByVisita, putSnapshot } from "./db";
import { supabase } from "@/integrations/supabase/client";
import { enqueueMutation } from "./mutationQueue";
import { CONSULTOR_NETWORK_TIMEOUT_MS, CONSULTOR_SYNC_ATTEMPTS, getErrorMessage, retryDelayMs, sleep, withConsultorTimeout } from "./network";

export interface SyncVisitaResult {
  ok: boolean;
  attempts: number;
  reason?: string;
  pendingFotos: number;
  pendingMutations: number;
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

/** Serializa absolutamente toda gravação de snapshot por visita. */
const patchLocks = new Map<string, Promise<void>>();

async function writeSnapshotSerialized(
  visitaId: string,
  buildData: () => Promise<VisitaSnapshotData> | VisitaSnapshotData,
) {
  const prev = patchLocks.get(visitaId) ?? Promise.resolve();
  const next = prev.then(async () => {
    const data = await buildData();
    await putSnapshot({
      visitaId,
      data,
      updatedAt: new Date().toISOString(),
    });
  }).catch((err) => { console.warn("[consultor-snapshot] falha na gravação serializada", { visitaId, error: getErrorMessage(err) }); });
  patchLocks.set(visitaId, next);
  try { await next; } finally {
    if (patchLocks.get(visitaId) === next) patchLocks.delete(visitaId);
  }
}

export async function loadSnapshot(visitaId: string): Promise<VisitaSnapshotData | null> {
  const snap = await getSnapshot(visitaId);
  return snap ? (snap.data as VisitaSnapshotData) : null;
}

export async function saveSnapshot(visitaId: string, data: VisitaSnapshotData) {
  await writeSnapshotSerialized(visitaId, () => data);
}

export async function loadAllSnapshots(): Promise<Array<{ visitaId: string; data: VisitaSnapshotData; updatedAt: string }>> {
  const rows = await listAllSnapshots();
  return rows.map((row) => ({ visitaId: row.visitaId, data: row.data as VisitaSnapshotData, updatedAt: row.updatedAt }));
}

export function isVisitaDeleted(visita?: Record<string, any> | null): boolean {
  return Boolean(visita?.deleted_at);
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

async function getPendingSummary(visitaId: string): Promise<Omit<SyncVisitaResult, "ok" | "attempts">> {
  const [allMutations, fotos] = await Promise.all([
    listMutationsByVisita(visitaId),
    listFotosByVisita(visitaId),
  ]);
  // Delete mutations não afetam o conteúdo do PDF (apenas removem algo que já
  // sumiu da UI). Não devem bloquear a geração do relatório — continuam sendo
  // tentadas em background pela fila.
  const mutations = allMutations.filter((m) => (m.operation ?? "update") !== "delete");
  const failedFotos = fotos
    .filter((f) => f.status === "error")
    .map((f) => {
      const tipo = f.parentKind === "curral" ? "curral" : f.parentKind === "topico" ? "tópico" : "pasto";
      const size = f.size ?? f.blob?.size ?? 0;
      const sizeLabel = size > 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : size > 0 ? `${Math.round(size / 1024)} KB` : "tamanho desconhecido";
      return `Foto ${f.ordem} do ${tipo} (${f.mime || "image/jpeg"}, ${sizeLabel}): ${f.lastError || "falha desconhecida"}`;
    });
  const errors = [...mutations.map((m) => m.lastError), ...failedFotos, ...fotos.map((f) => f.status !== "error" ? f.lastError : undefined)]
    .filter(Boolean)
    .map(String);
  const lastError = errors.length ? errors[errors.length - 1] : undefined;
  const reason = lastError || (mutations.length || fotos.length
    ? `Ainda há ${mutations.length} alteração(ões) e ${fotos.length} foto(s) pendente(s).`
    : undefined);
  return { pendingFotos: fotos.length, pendingMutations: mutations.length, reason };
}

export async function softDeleteVisita(params: {
  visitaId: string;
  visita?: Record<string, any> | null;
}): Promise<{ ok: boolean; queued: boolean; deletedAt: string }> {
  const deletedAt = new Date().toISOString();
  const visitaBase = params.visita ?? (await loadSnapshot(params.visitaId))?.visita ?? { id: params.visitaId };
  const result = await offlineUpdate({
    visitaId: params.visitaId,
    table: "visitas_tecnicas",
    rowId: params.visitaId,
    patch: { deleted_at: deletedAt },
    applyToSnapshot: (curr) => ({
      ...curr,
      visita: { ...(curr.visita || {}), ...visitaBase, id: params.visitaId, deleted_at: deletedAt },
    }),
  });
  // Cascade: remove itens locais da fila que pertencem a esta visita para
  // não continuarem sendo contados/tentados após a exclusão.
  try {
    const { purgeVisitaFromQueue } = await import("./photoQueue");
    await purgeVisitaFromQueue(params.visitaId);
  } catch (err) {
    console.warn("[softDeleteVisita] falha na limpeza em cascata:", err);
  }
  return { ...result, deletedAt };
}


/**
 * Força uma sincronização e aguarda até que a visita informada não tenha mais
 * itens pendentes no cache local (fotos + mutações). Resolve `true` se tudo
 * foi sincronizado dentro do timeout; caso contrário resolve `false`.
 */
export async function syncVisitaAndWait(visitaId: string, timeoutMs = 90000): Promise<boolean> {
  const result = await syncVisitaWithRetries(visitaId, { totalTimeoutMs: timeoutMs });
  return result.ok;
}

export async function syncVisitaWithRetries(
  visitaId: string,
  options?: { attempts?: number; perAttemptTimeoutMs?: number; totalTimeoutMs?: number },
): Promise<SyncVisitaResult> {
  const attempts = options?.attempts ?? CONSULTOR_SYNC_ATTEMPTS;
  const perAttemptTimeoutMs = options?.perAttemptTimeoutMs ?? CONSULTOR_NETWORK_TIMEOUT_MS * 2;
  const totalTimeoutMs = options?.totalTimeoutMs ?? 90_000;
  const started = Date.now();
  let lastReason: string | undefined;

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const summary = await getPendingSummary(visitaId);
    return { ok: false, attempts: 0, ...summary, reason: "Sem conexão com a internet." };
  }

  const { syncNow: syncPhotosNow } = await import("./photoQueue");
  const { retryFailedMutations } = await import("./mutationQueue");

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (Date.now() - started >= totalTimeoutMs) break;
    try {
      await withConsultorTimeout(retryFailedMutations(), `sincronização de dados da visita (${attempt}/${attempts})`, perAttemptTimeoutMs);
      await withConsultorTimeout(syncPhotosNow(), `sincronização de fotos da visita (${attempt}/${attempts})`, perAttemptTimeoutMs);
    } catch (err) {
      lastReason = getErrorMessage(err);
    }

    const summary = await getPendingSummary(visitaId);
    if (summary.pendingFotos === 0 && summary.pendingMutations === 0) {
      return { ok: true, attempts: attempt, pendingFotos: 0, pendingMutations: 0 };
    }
    lastReason = summary.reason || lastReason;
    if (attempt < attempts) await sleep(retryDelayMs(attempt));
  }

  const summary = await getPendingSummary(visitaId);
  return {
    ok: summary.pendingFotos === 0 && summary.pendingMutations === 0,
    attempts,
    pendingFotos: summary.pendingFotos,
    pendingMutations: summary.pendingMutations,
    reason: summary.reason || lastReason || "Tempo limite de sincronização excedido.",
  };
}

/** Merge a partial patch into the current snapshot. Serialized per visitaId to avoid races. */
export async function patchSnapshot(
  visitaId: string,
  patcher: (current: VisitaSnapshotData) => VisitaSnapshotData | Promise<VisitaSnapshotData>,
) {
  await writeSnapshotSerialized(visitaId, async () => {
    const current = (await loadSnapshot(visitaId)) ?? {};
    return await patcher(current);
  });
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
    const { error, count } = await withConsultorTimeout<any>((supabase as any)
      .from(params.table)
      .update(params.patch, { count: "exact" })
      .eq("id", params.rowId),
      `salvamento em ${params.table}`,
    );
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
    const { error, count } = await withConsultorTimeout<any>((supabase as any)
      .from(params.table)
      .upsert({ id: params.rowId, ...params.payload }, { onConflict: params.onConflict ?? "id", count: "exact" }),
      `salvamento em ${params.table}`,
    );
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
    const { error, count } = await withConsultorTimeout<any>(
      (supabase as any).from(params.table).delete({ count: "exact" }).eq("id", params.rowId),
      `exclusão em ${params.table}`,
    );
    if (error) throw error;
    // count === 0 significa que o registro já não existe no servidor (nunca foi
    // sincronizado ou já foi apagado). Consideramos idempotente: sucesso.
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
