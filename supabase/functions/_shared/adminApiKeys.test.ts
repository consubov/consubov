import { describe, expect, it } from "vitest";
import { getAdminApiKey } from "./adminApiKeys.ts";

const modern = "sb_secret_synthetic_key_not_live";
const legacy = "legacy-service-role-synthetic-key";
const env = (values: Record<string, string>) =>
  (name: string): string | undefined => values[name];

describe("getAdminApiKey backend-only credential", () => {
  it("prefers a modern default secret when available", () => {
    expect(getAdminApiKey(env({
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: modern }),
      SUPABASE_SERVICE_ROLE_KEY: legacy,
    }))).toBe(modern);
  });

  it("supports a named modern secret alongside other server secrets", () => {
    expect(getAdminApiKey(env({
      SUPABASE_SECRET_KEYS: JSON.stringify({ billing: "sb_secret_billing", default: modern }),
    }))).toBe(modern);
  });

  it("retains legacy compatibility only when the new config is absent", () => {
    expect(getAdminApiKey(env({ SUPABASE_SERVICE_ROLE_KEY: legacy }))).toBe(legacy);
  });

  it.each(["not-json", "", "{}", "[]", "null", '"value"', JSON.stringify({ default: false })])(
    "rejects invalid modern key configuration %s",
    (value) => {
      expect(() => getAdminApiKey(env({
        SUPABASE_SECRET_KEYS: value,
        SUPABASE_SERVICE_ROLE_KEY: legacy,
      }))).toThrow();
    },
  );

  it("never accepts a publishable key as privileged server credentials", () => {
    expect(() => getAdminApiKey(env({
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_publishable_not_secret" }),
    }))).toThrow(/not a server secret/);
  });

  it("rejects leading or trailing whitespace in a secret", () => {
    expect(() => getAdminApiKey(env({
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: ` ${modern}` }),
    }))).toThrow();
  });

  it("returns null if neither credential is available", () => {
    expect(getAdminApiKey(env({}))).toBeNull();
  });

  it("returns null if legacy key is empty", () => {
    expect(getAdminApiKey(env({ SUPABASE_SERVICE_ROLE_KEY: "" }))).toBeNull();
  });
});
