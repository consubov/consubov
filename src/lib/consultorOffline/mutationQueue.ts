import { supabase } from "@/integrations/supabase/client";
import {
  countPendingMutations,
  deleteMutation,
  listAllMutations,
  putMutation,
  purgeDeadMutations,
  type TextMutation,
} from "./db";
import { CONSULTOR_NETWORK_TIMEOUT_MS, getErrorMessage, sleep, withConsultorTimeout } from "./network";

type Listener = (pending: number, syncing: boolean) => void;
const listeners = new Set<Listener>();
let syncing = false;
let cachedPending = 0;
const MAX_AUTO_RETRIES = 3;

function debugSync(message: string, payload?: Record<string, unknown>) {
  if (import.meta.env.DEV) console.debug(`[consultor-sync] ${message}`, payload ?? {});
}

async function refresh() {
  await purgeDeadMutations();
  cachedPending = await countPendingMutations();
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
  return countPendingMutations();
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
    if (params.operation === "delete" && (existing.operation === "insert" || existing.operation === "upsert")) {
      debugSync("cancelando mutação local antes de existir no servidor", {
        mutationId: existing.id,
        visitaId: existing.visitaId,
        table: existing.table,
        rowId: existing.rowId,
      });
      await deleteMutation(existing.id);
      await refresh();
      return;
    }
    existing.patch = { ...existing.patch, ...params.patch };
    existing.operation = params.operation === "delete"
      ? "delete"
      : existing.operation === "upsert"
        ? "upsert"
        : params.operation ?? existing.operation ?? "update";
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
  if (typeof navigator === "undefined" || navigator.onLine) void drainMutations();
}

/**
 * Ordem de dependência: o pai precisa existir no servidor antes dos filhos.
 * Quanto menor o número, mais cedo a mutação é enviada.
 */
const TABLE_PRIORITY: Record<string, number> = {
  visitas_tecnicas: 0,
  visita_pastos: 1,
  visita_currais: 1,
  visita_topicos: 1,
  avaliacoes_score: 2,
  avaliacoes_fabrica_quesito: 2,
  visita_fotos: 3,
  visita_topico_fotos: 3,
};

function mutationRank(m: TextMutation): number {
  const base = TABLE_PRIORITY[m.table] ?? 2;
  // Exclusões por último: primeiro criamos/atualizamos, depois removemos.
  return (m.operation ?? "update") === "delete" ? base + 10 : base;
}

function sortMutations(items: TextMutation[]): TextMutation[] {
  return [...items].sort((a, b) => {
    const r = mutationRank(a) - mutationRank(b);
    if (r !== 0) return r;
    return String(a.createdAt).localeCompare(String(b.createdAt));
  });
}

function isDependencyError(message: string): boolean {
  const m = (message || "").toLowerCase();
  return m.includes("foreign key") || m.includes("fkey") || m.includes("23503");
}

type FlushOutcome = "ok" | "failed" | "deferred";

async function flushOne(m: TextMutation): Promise<FlushOutcome> {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) return "failed";
    m.status = "flushing";
    await putMutation(m);
    emit();

    const operation = m.operation ?? "update";
    let error: any = null;
    let confirmed = false;
    debugSync("enviando mutação", {
      mutationId: m.id,
      visitaId: m.visitaId,
      table: m.table,
      rowId: m.rowId,
      operation,
    });
    if (operation === "upsert") {
      const res: any = await withConsultorTimeout((supabase as any)
        .from(m.table)
        .upsert({ id: m.rowId, ...m.patch }, { onConflict: m.onConflict ?? "id", count: "exact" }),
        `sincronização de ${m.table}`,
      );
      error = res.error;
      confirmed = res.count == null || res.count > 0;
    } else if (operation === "insert") {
      const res: any = await withConsultorTimeout((supabase as any)
        .from(m.table)
        .insert({ id: m.rowId, ...m.patch }, { count: "exact" }),
        `sincronização de ${m.table}`,
      );
      error = res.error;
      confirmed = res.count == null || res.count > 0;
    } else if (operation === "delete") {
      const res: any = await withConsultorTimeout(
        (supabase as any).from(m.table).delete({ count: "exact" }).eq("id", m.rowId),
        `sincronização de exclusão em ${m.table}`,
      );
      error = res.error;
      // Idempotente: se count === 0, o registro já não existe (nunca chegou ao
      // servidor ou já foi apagado). Consideramos confirmado.
      confirmed = true;
    } else {
      const res: any = await withConsultorTimeout((supabase as any)
        .from(m.table)
        .update(m.patch, { count: "exact" })
        .eq("id", m.rowId),
        `sincronização de ${m.table}`,
      );
      error = res.error;
      confirmed = res.count == null || res.count > 0;
      if (!error && !confirmed) {
        // Linha não existe mais no servidor (ex.: tópico excluído ou nunca
        // inserido). Tenta recriar via upsert; se não for possível (colunas
        // obrigatórias ausentes), descarta a mutação órfã para não travar a fila.
        const up: any = await withConsultorTimeout((supabase as any)
          .from(m.table)
          .upsert({ id: m.rowId, ...m.patch }, { onConflict: m.onConflict ?? "id", count: "exact" }),
          `sincronização de ${m.table}`,
        );
        if (!up.error) {
          confirmed = true;
        } else {
          debugSync("descartando mutação órfã (linha inexistente no servidor)", {
            mutationId: m.id,
            table: m.table,
            rowId: m.rowId,
            error: getErrorMessage(up.error),
          });
          await deleteMutation(m.id);
          await refresh();
          return true;
        }
      }
    }
    if (error) throw error;
    if (!confirmed) throw new Error(`Servidor não confirmou ${operation} em ${m.table}`);

    debugSync("mutação confirmada pelo servidor", {
      mutationId: m.id,
      visitaId: m.visitaId,
      table: m.table,
      rowId: m.rowId,
      operation,
    });
    await deleteMutation(m.id);
    await refresh();
    return true;
  } catch (err) {
    debugSync("mutação mantida no IndexedDB após falha", {
      mutationId: m.id,
      visitaId: m.visitaId,
      table: m.table,
      rowId: m.rowId,
      error: getErrorMessage(err),
    });
    m.status = "error";
    m.tries = (m.tries ?? 0) + 1;
    m.lastError = getErrorMessage(err);
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
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      let attempts = 0;
      while (attempts < 50) {
        const items = await listAllMutations();
        const target = items.find((i) => (i.tries ?? 0) < MAX_AUTO_RETRIES);
        if (!target) break;
        const ok = await flushOne(target);
        if (!ok) {
          const remaining = await listAllMutations();
          const current = remaining.find((i) => i.id === target.id);
          if ((current?.tries ?? 0) >= MAX_AUTO_RETRIES) break;
          if (typeof navigator !== "undefined" && !navigator.onLine) break;
          await sleep(650 * ((current?.tries ?? 0) || 1));
        }
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
    if (it.status === "error" || it.status === "flushing") {
      it.status = "pending";
      it.tries = 0;
      it.lastError = undefined;
      await putMutation(it);
    }
  }
  await withConsultorTimeout(drainMutations(), "sincronização das alterações", CONSULTOR_NETWORK_TIMEOUT_MS * 2);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void retryFailedMutations().catch((err) => debugSync("auto-sync de mutações falhou", { error: getErrorMessage(err) })));
  if (navigator.onLine) void drainMutations().catch((err) => debugSync("sync inicial de mutações falhou", { error: getErrorMessage(err) }));
}

/**
 * Remove da fila local todas as mutações pendentes cujos rowIds pertencem a
 * registros já excluídos (ex.: tópico apagado e suas fotos). Evita pendências
 * fantasma que nunca conseguiriam sincronizar (FK inexistente no servidor).
 * Nunca remove mutações de exclusão — elas continuam sendo tentadas.
 */
export async function dropMutationsForRows(rowIds: string[]): Promise<number> {
  const targets = new Set(rowIds.filter(Boolean));
  if (targets.size === 0) return 0;
  const items = await listAllMutations();
  let removed = 0;
  for (const m of items) {
    if (!targets.has(m.rowId)) continue;
    if ((m.operation ?? "update") === "delete") continue;
    await deleteMutation(m.id);
    removed++;
  }
  if (removed > 0) await refresh();
  return removed;
}
