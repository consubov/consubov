import { describe, expect, test } from "bun:test";
import {
  DEFAULT_HUMAN_RATE_LIMIT,
  DEFAULT_MACHINE_RATE_LIMIT,
  RATE_WINDOW_MS,
  broadcastIsAlwaysDenied,
  machineSelectionDecision,
  rateLimitForCaller,
  rateLimitKey,
  allowIntegrationRequest,
  type RateBucket,
} from "./index";

describe("machine caller audiences", () => {
  test("never allows addressing users directly", () => {
    expect(
      machineSelectionDecision([{ kind: "users", userIds: ["u1"] }]),
    ).toEqual({ allowed: false, reason: "selecao_proibida" });

    expect(
      machineSelectionDecision([
        { kind: "fazenda", fazendaId: "f1" },
        { kind: "users", userIds: ["u1"] },
      ]).allowed,
    ).toBe(false);
  });

  test("allows the audiences of its own contract", () => {
    expect(machineSelectionDecision([])).toEqual({ allowed: true });
    expect(
      machineSelectionDecision([
        { kind: "fazenda", fazendaId: "f1" },
        { kind: "fabrica", fabricaId: "fab-1" },
        { kind: "admins" },
      ]),
    ).toEqual({ allowed: true });
  });
});

describe("broadcast to every user", () => {
  test("is always denied when the flag is present and true", () => {
    expect(broadcastIsAlwaysDenied({ all: true })).toBe(true);
  });

  test("is not a denial without the flag", () => {
    expect(broadcastIsAlwaysDenied({})).toBe(false);
    expect(broadcastIsAlwaysDenied({ all: false })).toBe(false);
  });
});

describe("rate limit key", () => {
  test("is derived from the server side identity, never from the body", () => {
    expect(rateLimitKey({ type: "machine" })).toBe("machine");
    expect(rateLimitKey({ type: "human", userId: "u1" })).toBe("user:u1");
    expect(rateLimitKey({ type: "human", userId: "u2" })).toBe("user:u2");
  });

  test("keeps one limit per caller kind", () => {
    expect(rateLimitForCaller({ type: "human", userId: "u1" })).toBe(
      DEFAULT_HUMAN_RATE_LIMIT,
    );
    expect(rateLimitForCaller({ type: "machine" })).toBe(
      DEFAULT_MACHINE_RATE_LIMIT,
    );
    expect(DEFAULT_HUMAN_RATE_LIMIT).toBe(30);
    expect(DEFAULT_MACHINE_RATE_LIMIT).toBe(120);
  });
});

describe("fixed window rate limit", () => {
  test("opens the first window on the first request", () => {
    const decision = allowIntegrationRequest({
      bucket: null,
      nowMs: 1_000,
      limit: 2,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.bucket).toEqual({ count: 1, windowStartMs: 1_000 });
  });

  test("counts requests inside the window of 60 seconds", () => {
    let bucket: RateBucket | null = null;
    const nowMs = 1_000;

    for (let i = 0; i < 2; i++) {
      const decision = allowIntegrationRequest({ bucket, nowMs, limit: 2 });
      expect(decision.allowed).toBe(true);
      bucket = decision.bucket;
    }

    expect(bucket).toEqual({ count: 2, windowStartMs: 1_000 });
  });

  test("refuses once the window is full, without changing the counter", () => {
    const full: RateBucket = { count: 2, windowStartMs: 0 };

    const decision = allowIntegrationRequest({
      bucket: full,
      nowMs: 59_999,
      limit: 2,
    });

    expect(decision).toEqual({
      allowed: false,
      reason: "rate_limit",
      bucket: full,
    });
  });

  test("opens a new window after the window expires", () => {
    const decision = allowIntegrationRequest({
      bucket: { count: 2, windowStartMs: 0 },
      nowMs: RATE_WINDOW_MS,
      limit: 2,
    });

    expect(RATE_WINDOW_MS).toBe(60_000);
    expect(decision.allowed).toBe(true);
    expect(decision.bucket).toEqual({ count: 1, windowStartMs: 60_000 });
  });

  test("does not mutate the bucket it received", () => {
    const bucket: RateBucket = { count: 0, windowStartMs: 0 };

    const decision = allowIntegrationRequest({ bucket, nowMs: 10, limit: 2 });

    expect(bucket).toEqual({ count: 0, windowStartMs: 0 });
    expect(decision.bucket).toEqual({ count: 1, windowStartMs: 0 });
  });
});
