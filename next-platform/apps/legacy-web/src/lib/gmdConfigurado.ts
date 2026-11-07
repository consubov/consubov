import { supabase } from "@/integrations/supabase/client";

/**
 * GMD configurado (projeção) — fonte única: função do banco gmd_do_pasto(pasto, dia),
 * a mesma do motor diário e da Previsão de Abate. Nada é recalculado no app.
 */

function hojeSP(): { y: number; m: number; d: number } {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
    .format(new Date()).split("-").map(Number);
  return { y, m, d };
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Hoje para mês/ano em andamento (ou futuro); último dia do período para passados. mes null = ano inteiro. */
export function dataReferenciaGmd(mes: number | null | undefined, ano: number): string {
  const h = hojeSP();
  if (mes == null) return ano >= h.y ? iso(h.y, h.m, h.d) : iso(ano, 12, 31);
  if (ano > h.y || (ano === h.y && mes >= h.m)) return iso(h.y, h.m, h.d);
  return iso(ano, mes, new Date(ano, mes, 0).getDate());
}

/** Prevent bursty RPC fan-out across concurrent screen refreshes in this tab. */
// The DB enforces a statement timeout for gmd_do_pasto when farm RLS is busy.
// Keep reads below the prior four-way fan-out to limit simultaneous RLS work.
const MAX_GMD_RPC_INFLIGHT = 2;
const MAX_GMD_RPC_ATTEMPTS = 2;
const GMD_TRANSIENT_RETRY_DELAY_MS = 450;
let activeGmdRpc = 0;

function gmdTransientFailure(response: { error?: unknown; status?: number }): boolean {
  const error = response.error;
  const code = error && typeof error === "object" && "code" in error
    ? (error as { code?: unknown }).code : null;
  // 57014 is PostgreSQL query_canceled (observed on the deployed RPC).
  return code === "57014" || response.status === 503 || response.status === 504;
}

function gmdAbortablePause(signal: AbortSignal, milliseconds: number): Promise<void> {
  if (signal.aborted) return Promise.reject(gmdAbortError());
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(gmdAbortError());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}
interface PendingGmdRpc {
  resolve: () => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  onAbort: () => void;
}
const pendingGmdRpc: PendingGmdRpc[] = [];

function gmdAbortError(): Error {
  const error = new Error("Consulta GMD cancelada.");
  error.name = "AbortError";
  return error;
}

async function withGmdSlot<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw gmdAbortError();
  if (activeGmdRpc < MAX_GMD_RPC_INFLIGHT && pendingGmdRpc.length === 0) {
    activeGmdRpc += 1;
  } else {
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        const index = pendingGmdRpc.indexOf(entry);
        if (index >= 0) {
          pendingGmdRpc.splice(index, 1);
          reject(gmdAbortError());
        }
      };
      const entry: PendingGmdRpc = { resolve, reject, signal, onAbort };
      pendingGmdRpc.push(entry);
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
    });
  }
  try {
    if (signal?.aborted) throw gmdAbortError();
    return await operation();
  } finally {
    const next = pendingGmdRpc.shift();
    if (next) {
      next.signal?.removeEventListener("abort", next.onAbort);
      next.resolve();
    } else {
      activeGmdRpc -= 1;
    }
  }
}

/** GMD null only if confirmed by the database. Never expose a partial result. */
export async function fetchGmdPastos(
  pastoIds: string[], dia: string, signal?: AbortSignal,
): Promise<Record<string, number | null>> {
  if (signal?.aborted) throw gmdAbortError();
  const ids = Array.from(new Set(pastoIds));
  const out: Record<string, number | null> = {};
  let nextIndex = 0;
  let failed = false;
  const batchController = new AbortController();
  const cancel = () => batchController.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) batchController.abort();
  const batchSignal = batchController.signal;

  const worker = async (): Promise<void> => {
    while (!failed && !batchSignal.aborted) {
      const index = nextIndex++;
      if (index >= ids.length) return;
      const id = ids[index];
      try {
        const response: { data: unknown; error?: unknown; status?: number } = await withGmdSlot(async () => {
          for (let attempt = 0; attempt < MAX_GMD_RPC_ATTEMPTS; attempt++) {
            if (batchSignal.aborted) throw gmdAbortError();
            const result = await supabase.rpc("gmd_do_pasto", { p_pasto: id, p_dia: dia })
              .abortSignal(batchSignal);
            // A read-only canceled statement may succeed once the short overload
            // passes. Never retry permission/schema failures or unconfirmed data.
            if (!result.error || !gmdTransientFailure(result) || attempt === MAX_GMD_RPC_ATTEMPTS - 1) {
              return result;
            }
            await gmdAbortablePause(batchSignal, GMD_TRANSIENT_RETRY_DELAY_MS);
          }
          throw new Error("Consulta GMD sem resposta confirmada");
        }, batchSignal);
        if (response?.error) throw new Error("RPC GMD indisponivel");
        const value: unknown = response?.data;
        if (value === null) {
          out[id] = null;
        } else if (
          (typeof value === "number" || (typeof value === "string" && value.trim() !== ""))
          && Number.isFinite(Number(value))
        ) {
          out[id] = Number(value);
        } else {
          throw new Error("Resposta GMD invalida");
        }
      } catch {
        if (!failed) {
          failed = true;
          batchController.abort();
        }
        return;
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(ids.length, MAX_GMD_RPC_INFLIGHT) }, () => worker()));
    if (signal?.aborted) throw gmdAbortError();
    if (failed) throw new Error("Falha ao consultar GMD: resultado nao confirmado.");
    return out;
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}

/** Média ponderada por animais dos pastos com animais e GMD definido; null se nenhum. */
/** Same RPC inputs for pastures with the same retreat and category always
 * produce the same configured GMD. Grouping avoids one HTTP RPC per pasture.
 * The backend remains the only authority for the numerical value.
 */
export interface GmdPastoAgrupavel {
  id: string;
  retiro_id: string;
  categoria: string | null;
}

export async function fetchGmdPastosAgrupados(
  pastos: readonly GmdPastoAgrupavel[],
  dia: string,
  signal?: AbortSignal,
  modo?: string | null,
): Promise<Record<string, number | null>> {
  const grupos = new Map<string, string[]>();
  for (const pasto of pastos) {
    // Verified in gmd_do_pasto: geral depends only on farm/season,
    // categoria on farm/category, retiro on farm/retreat/category.
    const chave = modo === "geral" ? "geral" :
      modo === "categoria" ? JSON.stringify(["categoria", pasto.categoria]) :
      JSON.stringify(["retiro", pasto.retiro_id, pasto.categoria]);
    const ids = grupos.get(chave);
    if (ids) ids.push(pasto.id);
    else grupos.set(chave, [pasto.id]);
  }
  const representantes = Array.from(grupos.values(), ids => ids[0]);
  const gmdPorRepresentante = await fetchGmdPastos(representantes, dia, signal);
  const todos: Record<string, number | null> = {};
  for (const ids of grupos.values()) {
    const representante = ids[0];
    if (!Object.prototype.hasOwnProperty.call(gmdPorRepresentante, representante)) {
      throw new Error("Resultado GMD incompleto");
    }
    for (const id of ids) todos[id] = gmdPorRepresentante[representante];
  }
  return todos;
}

export function gmdPonderado(
  pastos: { id: string; num_animais: number | null }[],
  gmd: Record<string, number | null>,
): number | null {
  let soma = 0, anim = 0;
  for (const p of pastos) {
    const n = Number(p.num_animais) || 0;
    const g = gmd[p.id];
    if (n <= 0 || g == null) continue;
    soma += n * g; anim += n;
  }
  return anim > 0 ? soma / anim : null;
}
