import { supabase } from "@/integrations/supabase/client";
import {
  countAllMutations,
  deleteMutation,
  listAllMutations,
  putMutation,
  type TextMutation,
} from "./db";

type Listener = (pending: number, syncing: boolean) => void;
const listeners = new Set<Listener>();
let syncing = false;
let cachedPending = 0;

async function refresh() {
  cachedPending = await countAllMutations();
  emit();
}

function emit() {
  listeners.forEach((l) => l(cachedPending, syncing));
}

export function subscribeMutationStatus(listener: Listener) {
  listeners.add(listener);
  listener(cachedPending, syncing);
  void refresh();
  return () => listeners.delete(listener);
}

export async function getPendingMutationCount() {
  return countAllMutations();
}

/**
 * Enqueue an UPDATE mutation. Merges with an existing pending mutation
 * for the same table+rowId so we don't stack redundant patches.
 */
export async function enqueueMutation(params: {
  visitaId: string;
  table: string;
  rowId: string;
  operation?: "update" | "upsert" | "insert" | "delete";
  onConflict?: string;
  patch: Record<string, any>;
}) {
  const existing = (await listAllMutations()).find(
    (m) => m.table === params.table && m.rowId === params.rowId && m.status !== "flushing",
  );
  if (existing) {
    existing.patch = { ...existing.patch, ...params.patch };
    existing.operation = existing.operation === "upsert" ? "upsert" : params.operation ?? existing.operation ?? "update";
    existing.onConflict = params.onConflict ?? existing.onConflict;
    existing.status = "pending";
    existing.tries = 0;
    existing.lastError = undefined;
    await putMutation(existing);
  } else {
    const m: TextMutation = {
      id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      visitaId: params.visitaId,
      table: params.table,
      rowId: params.rowId,
      operation: params.operation ?? "update",
      onConflict: params.onConflict,
      patch: params.patch,
      createdAt: new Date().toISOString(),
      tries: 0,
      status: "pending",
    };
    await putMutation(m);
  }
  await refresh();
  void drainMutations();
}

async function flushOne(m: TextMutation): Promise<boolean> {
  try {
    m.status = "flushing";
    await putMutation(m);
    emit();
    const operation = m.operation ?? "update";
    let error: any = null;
    if (operation === "upsert") {
      const res = await (supabase as any)
        .from(m.table)
        .upsert({ id: m.rowId, ...m.patch }, { onConflict: m.onConflict ?? "id" });
      error = res.error;
    } else if (operation === "insert") {
      const res = await (supabase as any).from(m.table).insert({ id: m.rowId, ...m.patch });
      error = res.error;
    } else if (operation === "delete") {
      const res = await (supabase as any).from(m.table).delete().eq("id", m.rowId);
      error = res.error;
    } else {
      const res = await (supabase as any).from(m.table).update(m.patch).eq("id", m.rowId);
      error = res.error;
    }
    if (error) throw error;
    await deleteMutation(m.id);
    await refresh();
    return true;
  } catch (err) {
    m.status = "error";
    m.tries = (m.tries ?? 0) + 1;
    m.lastError = (err as Error)?.message || String(err);
    await putMutation(m);
    emit();
    return false;
  }
}

let drainPromise: Promise<void> | null = null;

export async function drainMutations(): Promise<void> {
  if (drainPromise) return drainPromise;
  drainPromise = (async () => {
    syncing = true;
    emit();
    try {
      let attempts = 0;
      while (attempts < 50) {
        const items = await listAllMutations();
        const target = items.find((i) => i.status !== "error" || i.tries < 3);
        if (!target) break;
        const ok = await flushOne(target);
        if (!ok && target.tries >= 3) break;
        attempts++;
      }
    } finally {
      syncing = false;
      await refresh();
    }
  })();
  try {
    await drainPromise;
  } finally {
    drainPromise = null;
  }
}

export async function retryFailedMutations() {
  const items = await listAllMutations();
  for (const it of items) {
    if (it.status === "error") {
      it.status = "pending";
      it.tries = 0;
      it.lastError = undefined;
      await putMutation(it);
    }
  }
  await drainMutations();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void drainMutations());
  void drainMutations();
}
