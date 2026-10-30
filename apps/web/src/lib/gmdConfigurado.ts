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
const MAX_GMD_RPC_INFLIGHT = 4;
let activeGmdRpc = 0;
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
        const response: { data: unknown; error?: unknown } = await withGmdSlot(async () => {
          const query = (supabase as any).rpc("gmd_do_pasto", { p_pasto: id, p_dia: dia });
          return query.abortSignal(batchSignal);
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
