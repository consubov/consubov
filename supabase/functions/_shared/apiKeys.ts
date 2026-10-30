/**
 * Frontend-safe API key resolver for the staged SyncVet cutover.
 * Only a user JWT and tenant RLS can authorize the request.
 * The new key must be explicitly enabled after QA; availability alone
 * never changes production behavior.
 */
export type ReadEnvironment = (name: string) => string | undefined;

export function getSupabasePublishableKey(readEnv: ReadEnvironment): string {
  const mode = readEnv("CONSUBOV_SYNCVET_MODERN_KEY_ENABLED");
  if (mode !== undefined && mode !== "true" && mode !== "false") {
    throw new Error("CONSUBOV_SYNCVET_MODERN_KEY_ENABLED must be true or false");
  }

  if (mode !== "true") {
    const legacyKey = readEnv("SUPABASE_ANON_KEY");
    if (!legacyKey || !legacyKey.trim()) {
      throw new Error("Supabase legacy public API key is not configured");
    }
    return legacyKey;
  }

  const modernKeys = readEnv("SUPABASE_PUBLISHABLE_KEYS");
  if (modernKeys === undefined) {
    throw new Error("SUPABASE_PUBLISHABLE_KEYS is required for modern mode");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(modernKeys);
  } catch {
    throw new Error("SUPABASE_PUBLISHABLE_KEYS must be valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("SUPABASE_PUBLISHABLE_KEYS must contain a named key object");
  }

  const value = (parsed as Record<string, unknown>).default;
  if (typeof value !== "string" || !value.startsWith("sb_publishable_") || value.trim() !== value) {
    throw new Error("SUPABASE_PUBLISHABLE_KEYS.default is not a publishable API key");
  }
  return value;
}
