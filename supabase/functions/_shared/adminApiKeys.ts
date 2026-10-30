/**
 * Backend-only Supabase API credential during legacy-key retirement.
 * The modern key is privileged and must never reach clients, logs or storage.
 * Missing modern config may use the old server key until the cutover is approved.
 */
export type ReadEnvironment = (name: string) => string | undefined;

export function getAdminApiKey(readEnv: ReadEnvironment): string | null {
  const modernConfig = readEnv("SUPABASE_SECRET_KEYS");
  if (modernConfig !== undefined) {
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

  const legacyKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  return legacyKey && legacyKey.trim() === legacyKey && legacyKey.length > 0
    ? legacyKey
    : null;
}
