import { supabase } from "@/integrations/supabase/client";

/**
 * Guardrail for Stock bounded context.
 * Prevents losing newer data during a Last-Write-Wins (LWW) update.
 *
 * Usage: await useGuardrailStock('fazendas', recordId, newTimestamp);
 */
export async function useGuardrailStock(table: string, id: string, newTimestamp: number) {
  // Fetch the current row's updated_at (or any version column).
  const { data, error } = await supabase
    .from(table)
    .select("updated_at", { count: "exact", head: false })
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Guardrail fetch error: ${error}`);
  if (data && data.updated_at) {
    const existing = new Date(data.updated_at).getTime();
    if (existing > newTimestamp) {
      throw new Error(`Guardrail violation: newer data (${existing}) exists for ${table}#${id}`);
    }
  }
  // Otherwise, allow the write to proceed.
  return true;
}

/** Guardrail for Weighing bounded context. */
export async function useGuardrailWeighing(id: string, newTimestamp: number) {
  return useGuardrailStock("pesagens", id, newTimestamp);
}

/** Guardrail for Factory bounded context. */
export async function useGuardrailFactory(id: string, newTimestamp: number) {
  return useGuardrailStock("fabricas", id, newTimestamp);
}
