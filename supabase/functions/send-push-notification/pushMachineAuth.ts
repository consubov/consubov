/**
 * Machine API-key authentication for the push Edge Function.
 * A modern privileged key is accepted ONLY after an explicit opt-in.
 * This helper never logs or exposes key material and rejects invalid settings.
 * Legacy machine Bearer and user JWTs are handled separately by the caller.
 */
export type ReadPushEnvironment = (name: string) => string | undefined;

function constantTimeMatch(actual: string, expected: string): boolean {
  const length = Math.max(actual.length, expected.length);
  let diff = actual.length ^ expected.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (actual.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function isAuthorizedModernPushMachine(
  apikey: string | null,
  readEnv: ReadPushEnvironment,
): boolean {
  if (!apikey || !apikey.startsWith("sb_secret_")) return false;
  if (readEnv("CONSUBOV_PUSH_MODERN_MACHINE_KEY_ENABLED") !== "true") return false;

  const config = readEnv("SUPABASE_SECRET_KEYS");
  if (!config) return false;

  let entries: unknown;
  try {
    entries = JSON.parse(config);
  } catch {
    return false;
  }

  if (typeof entries !== "object" || entries === null || Array.isArray(entries)) return false;
  const expected = (entries as Record<string, unknown>).default;
  if (
    typeof expected !== "string" ||
    !expected.startsWith("sb_secret_") ||
    expected.trim() !== expected
  ) return false;

  return constantTimeMatch(apikey, expected);
}
