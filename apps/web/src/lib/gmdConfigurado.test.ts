import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocked.rpc } }));

import { fetchGmdPastos, gmdPonderado } from "./gmdConfigurado";

describe("GMD: bounded RPC access and fail-closed semantics", () => {
  beforeEach(() => mocked.rpc.mockReset());

  it("preserves valid zero, negative, and SQL NULL and the weighted formula", async () => {
    mocked.rpc.mockImplementation((_name: string, args: { p_pasto: string }) => ({
      abortSignal: async (_signal: AbortSignal) => ({
        data: args.p_pasto === "zero" ? 0 : args.p_pasto === "neg" ? -0.5 : null,
        error: null,
      }),
    }));
    await expect(fetchGmdPastos(["zero", "neg", "absent", "zero"], "2026-10-30"))
      .resolves.toEqual({ zero: 0, neg: -0.5, absent: null });
    expect(mocked.rpc).toHaveBeenCalledTimes(3);
    expect(gmdPonderado([{ id: "zero", num_animais: 10 }, { id: "neg", num_animais: 10 }], { zero: 0, neg: -0.5 })).toBe(-0.25);
  });

  it("never starts more than 4 requests concurrently", async () => {
    let inFlight = 0, maxInFlight = 0;
    mocked.rpc.mockImplementation(() => ({
      abortSignal: async () => {
        inFlight++;
        maxInFlight = Math.max(inFlight, maxInFlight);
        try {
          await new Promise(resolve => setTimeout(resolve, 5));
          return { data: 0.1, error: null };
        } finally { inFlight--; }
      },
    }));
    const ids = Array.from({ length: 22 }, (_, i) => String(i));
    const [a, b] = await Promise.all([
      fetchGmdPastos(ids, "2026-10-30"),
      fetchGmdPastos(ids.map(x => "other-" + x), "2026-10-30"),
    ]);
    expect(Object.keys(a)).toHaveLength(22);
    expect(Object.keys(b)).toHaveLength(22);
    expect(maxInFlight).toBeLessThanOrEqual(4);
  });

  it("aborts sibling RPCs on 57014 and never publishes a partial result", async () => {
    let aborted = 0;
    mocked.rpc.mockImplementation((_name: string, args: { p_pasto: string }) => ({
      abortSignal: (signal: AbortSignal) => {
        if (args.p_pasto === "bad") return Promise.resolve({ data: null, error: { code: "57014" } });
        return new Promise((_resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("not canceled")), 800);
          const onAbort = () => {
            aborted++;
            clearTimeout(timer);
            reject(new Error("canceled"));
          };
          if (signal.aborted) onAbort();
          else signal.addEventListener("abort", onAbort, { once: true });
        });
      },
    }));
    await expect(fetchGmdPastos(["bad", "slow1", "slow2", "slow3", "slow4"], "2026-10-30"))
      .rejects.toThrow(/nao confirmado/i);
    expect(aborted).toBeGreaterThanOrEqual(1);
    expect(mocked.rpc).toHaveBeenCalledTimes(4);
  });

  it("never sends a pre-aborted farm batch to the database", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(fetchGmdPastos(["pasto"], "2026-10-30", ac.signal))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(mocked.rpc).not.toHaveBeenCalled();
  });
});
