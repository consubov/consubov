/**
 * Backend-only Supabase API key for staged credential cutover.
 * The new privileged key MUST NOT be sent to browsers or logged.
 * An explicit opt-in prevents an automatic switch simply because
 * Supabase injects SUPABASE_SECRET_KEYS into the Edge runtime.
 */
export type ReadEnvironment = (name: string) => string | undefined;

export function getAdminApiKey(readEnv: ReadEnvironment): string | null {
  const mode = readEnv("CONSUBOV_ADMIN_MODERN_KEY_ENABLED");
  if (mode !== undefined && mode !== "true" && mode !== "false") {
    throw new Error("CONSUBOV_ADMIN_MODERN_KEY_ENABLED must be true or false");
  }

  if (mode !== "true") {
    const legacyKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
    return legacyKey && legacyKey.trim() === legacyKey && legacyKey.length > 0
      ? legacyKey
      : null;
  }

  const modernConfig = readEnv("SUPABASE_SECRET_KEYS");
  if (modernConfig === undefined) {
    throw new Error("SUPABASE_SECRET_KEYS is required for modern mode");
  }

  let value: unknown;
  try {
    value = JSON.parse(modernConfig);
  } catch {
    throw new Error("SUPABASE_SECRET_KEYS must be valid JSON");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("SUPABASE_SECRET_KEYS must be a named key object");
  }

  const key = (value as Record<string, unknown>).default;
  if (typeof key !== "string" || !key.startsWith("sb_secret_") || key.trim() !== key) {
    throw new Error("SUPABASE_SECRET_KEYS.default is not a server secret key");
  }
  return key;
}
