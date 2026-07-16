import { getSnapshot, putSnapshot } from "./db";
import { supabase } from "@/integrations/supabase/client";
import { enqueueMutation } from "./mutationQueue";

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

/** Merge a partial patch into the current snapshot. */
export async function patchSnapshot(
  visitaId: string,
  patcher: (current: VisitaSnapshotData) => VisitaSnapshotData,
) {
  const current = (await loadSnapshot(visitaId)) ?? {};
  const next = patcher(current);
  await saveSnapshot(visitaId, next);
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
    const { error } = await (supabase as any)
      .from(params.table)
      .update(params.patch)
      .eq("id", params.rowId);
    if (error) throw error;
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
