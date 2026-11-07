import { supabase } from "@/integrations/supabase/client";
import { assertReadSuccess, DataReadFailure } from "@/lib/dataReadGuard";
import { runWithDeadline } from "@/lib/requestDeadline";
import type { GerenteFazenda } from "@/lib/gerenteAccessScope";

// Browser deadline only: the database authenticated role still has an 8s timeout.
export const GERENTE_FAZENDAS_DEADLINE_MS = 20_000;

/** Server-authorized active manager scope, including admin manager-preview. */
export async function fetchGerenteFazendas(roleId: string): Promise<GerenteFazenda[]> {
  const result = await runWithDeadline(
    (signal) => supabase.rpc("get_gerente_fazendas_rapido", { p_gerente_id: roleId }).abortSignal(signal),
    { timeoutMs: GERENTE_FAZENDAS_DEADLINE_MS },
  );
  assertReadSuccess(result);
  if (!Array.isArray(result.data)) throw new DataReadFailure("invalid_response");
  const unique = new Map<string, GerenteFazenda>();
  for (const row of result.data) {
    if (!row || typeof row.id !== "string" || !row.id ||
      typeof row.nome !== "string" || !row.nome.trim() ||
      (row.intervalo_padrao_dias != null && (!Number.isInteger(row.intervalo_padrao_dias) || row.intervalo_padrao_dias < 0)) ||
      (row.gmd_modo != null && typeof row.gmd_modo !== "string") ||
      typeof row.gerente_nome !== "string") {
      throw new DataReadFailure("invalid_response");
    }
    unique.set(row.id, { id: row.id, nome: row.nome, intervalo_padrao_dias: row.intervalo_padrao_dias, gmd_modo: row.gmd_modo, gerente_nome: row.gerente_nome });
  }
  return [...unique.values()];
}
