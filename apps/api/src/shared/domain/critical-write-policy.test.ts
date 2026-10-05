import { describe, expect, test } from "bun:test";
import { CRITICAL_WRITE_POLICIES } from "./critical-write-policy";

describe("critical write policies", () => {
  test("all critical aggregates forbid generic LWW and require safe retry/conflict boundaries", () => {
    const policies = Object.values(CRITICAL_WRITE_POLICIES);
    expect(policies).toHaveLength(4);
    for (const policy of policies) {
      expect(policy.genericLastWriteWins).toBe(false);
      expect(policy.requiresIdempotencyKey).toBe(true);
      expect(policy.requiresKnownVersion).toBe(true);
      expect(policy.requiresAtomicAuthority).toBe(true);
      expect(policy.requiresExplicitConflictStrategy).toBe(true);
      expect(policy.realtimeIsAuthoritative).toBe(false);
    }
  });
});
