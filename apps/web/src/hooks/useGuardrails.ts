/**
 * Guardrail for Stock bounded context.
 * Prevents losing newer data during a Last-Write-Wins (LWW) update.
 *
 * NOTE: In this refactor, we avoid direct Supabase imports per Phase 3.
 * The guardrail check is currently disabled; implement proper in-memory
 * validation as needed.
 */
export async function useGuardrailStock(table: string, id: string, newTimestamp: number) {
  // TODO: Replace with in-memory guardrail logic
  return true;
}

/** Guardrail for Weighing bounded context. */
export async function useGuardrailWeighing(id: string, newTimestamp: number) {
  return true;
}

/** Guardrail for Factory bounded context. */
export async function useGuardrailFactory(id: string, newTimestamp: number) {
  return true;
}