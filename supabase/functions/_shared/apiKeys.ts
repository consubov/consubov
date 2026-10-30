/**
 * Resolves the public Supabase API key during the phased migration.
 * This helper does not authorize a caller: the request must still carry
 * a valid user JWT, and the database must enforce tenant RLS.
 */
export type ReadEnvironment = (name: string) => string | undefined;

export function getSupabasePublishableKey(readEnv: ReadEnvironment): string {
  const modernKeys = readEnv("SUPABASE_PUBLISHABLE_KEYS");

  // Fall back only when the new variable is absent, never when it is invalid.
  // A malformed value must fail visibly before the legacy keys are retired.
  if (modernKeys !== undefined) {
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

  const legacyKey = readEnv("SUPABASE_ANON_KEY");
  if (!legacyKey || !legacyKey.trim()) {
    throw new Error("Supabase public API key is not configured");
  }
  return legacyKey;
}
