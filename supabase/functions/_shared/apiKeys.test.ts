import { describe, expect, it } from "vitest";
import { getSupabasePublishableKey } from "./apiKeys.ts";

const modern = "sb_publishable_synthetic_key_not_live";
const legacy = "synthetic_legacy_anon_key";
const env = (values: Record<string, string>) =>
  (name: string): string | undefined => values[name];

describe("getSupabasePublishableKey", () => {
  it("prefers the modern default over an available legacy key", () => {
    expect(getSupabasePublishableKey(env({
      CONSUBOV_SYNCVET_MODERN_KEY_ENABLED: "true", SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: modern }),
      SUPABASE_ANON_KEY: legacy,
    }))).toBe(modern);
  });

  it("keeps compatibility when no modern variable has been provisioned", () => {
    expect(getSupabasePublishableKey(env({ SUPABASE_ANON_KEY: legacy }))).toBe(legacy);
  });

  it("accepts a named default alongside other public keys", () => {
    expect(getSupabasePublishableKey(env({
      CONSUBOV_SYNCVET_MODERN_KEY_ENABLED: "true", SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ web: "sb_publishable_web_test", default: modern }),
    }))).toBe(modern);
  });

  it.each(["not-json", "{}", "[]", "null", '"text"', "", JSON.stringify({ default: 123 })])(
    "fails closed for malformed modern config %s",
    (invalid) => {
      expect(() => getSupabasePublishableKey(env({
        CONSUBOV_SYNCVET_MODERN_KEY_ENABLED: "true", SUPABASE_PUBLISHABLE_KEYS: invalid,
        SUPABASE_ANON_KEY: legacy,
      }))).toThrow();
    },
  );

  it("rejects privileged keys in a public-key variable", () => {
    expect(() => getSupabasePublishableKey(env({
      CONSUBOV_SYNCVET_MODERN_KEY_ENABLED: "true", SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: "sb_secret_never_public" }),
      SUPABASE_ANON_KEY: legacy,
    }))).toThrow(/not a publishable/);
  });

  it("does not silently trim a malformed public key", () => {
    expect(() => getSupabasePublishableKey(env({
      CONSUBOV_SYNCVET_MODERN_KEY_ENABLED: "true", SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: ` ${modern}` }),
    }))).toThrow();
  });

  it("does not switch keys just because the Edge runtime injects modern variables", () => {
    expect(getSupabasePublishableKey(env({
      SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: modern }),
      SUPABASE_ANON_KEY: legacy,
    }))).toBe(legacy);
  });

  it("requires modern config when the cutover flag is enabled", () => {
    expect(() => getSupabasePublishableKey(env({
      CONSUBOV_SYNCVET_MODERN_KEY_ENABLED: "true",
      SUPABASE_ANON_KEY: legacy,
    }))).toThrow(/required/);
  });

  it("rejects unknown flag values to prevent unsafe rollout", () => {
    expect(() => getSupabasePublishableKey(env({
      CONSUBOV_SYNCVET_MODERN_KEY_ENABLED: "unknown",
      SUPABASE_ANON_KEY: legacy,
    }))).toThrow(/must be true or false/);
  });

  it("fails when neither modern nor legacy keys exist", () => {
    expect(() => getSupabasePublishableKey(env({}))).toThrow(/not configured/);
  });
});
