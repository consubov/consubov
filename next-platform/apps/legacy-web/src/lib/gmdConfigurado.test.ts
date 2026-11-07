import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocked.rpc } }));

import { fetchGmdPastos, fetchGmdPastosAgrupados, gmdPonderado } from "./gmdConfigurado";

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

  it("reads one representative per retreat/category, preserving all pasture results", async () => {
    mocked.rpc.mockImplementation((_name: string, args: { p_pasto: string }) => ({
      abortSignal: async () => ({
        data: args.p_pasto === "a" ? 0.12 : args.p_pasto === "c" ? null : 0.22,
        error: null,
      }),
    }));
    const result = await fetchGmdPastosAgrupados([
      { id: "a", retiro_id: "r1", categoria: "Recria" },
      { id: "b", retiro_id: "r1", categoria: "Recria" },
      { id: "c", retiro_id: "r1", categoria: "Engorda" },
      { id: "d", retiro_id: "r2", categoria: "Recria" },
      { id: "e", retiro_id: "r2", categoria: "Recria" },
    ], "2026-10-30");
    expect(result).toEqual({ a: 0.12, b: 0.12, c: null, d: 0.22, e: 0.22 });
    expect(mocked.rpc.mock.calls.map((call) => call[1].p_pasto)).toEqual(["a", "c", "d"]);
  });

  it("one backend RPC covers an entire farm configured in geral mode", async () => {
    mocked.rpc.mockImplementation(() => ({
      abortSignal: async () => ({ data: 0.9, error: null }),
    }));
    const pastos = Array.from({ length: 140 }, (_, i) => ({
      id: String(i), retiro_id: "r" + (i % 5), categoria: i % 2 ? "Engorda" : "Recria",
    }));
    const result = await fetchGmdPastosAgrupados(pastos, "2026-10-30", undefined, "geral");
    expect(Object.keys(result)).toHaveLength(140);
    expect(Object.values(result)).toEqual(Array(140).fill(0.9));
    expect(mocked.rpc).toHaveBeenCalledTimes(1);
  });

  it("categoria mode shares values across retreats without mixing different categories", async () => {
    mocked.rpc.mockImplementation((_name: string, args: { p_pasto: string }) => ({
      abortSignal: async () => ({ data: args.p_pasto === "a" ? 0.4 : 0.7, error: null }),
    }));
    const rows = [
      { id: "a", retiro_id: "r1", categoria: "Engorda" },
      { id: "b", retiro_id: "r2", categoria: "Engorda" },
      { id: "c", retiro_id: "r2", categoria: "Recria" },
    ];
    await expect(fetchGmdPastosAgrupados(rows, "2026-10-30", undefined, "categoria"))
      .resolves.toEqual({ a: 0.4, b: 0.4, c: 0.7 });
    expect(mocked.rpc).toHaveBeenCalledTimes(2);
  });

  it("conservatively groups report pastures by retiro/category when mode is not supplied", async () => {
    const pastos = Array.from({ length: 72 }, (_, i) => {
      const retiro = "ret-" + (i % 3);
      const categoria = i % 2 ? "Recria" : "Engorda";
      return { id: retiro + ":" + categoria + ":" + i, retiro_id: retiro, categoria };
    });
    mocked.rpc.mockImplementation((_name: string, args: { p_pasto: string }) => ({
      abortSignal: async () => {
        const [, categoria] = args.p_pasto.split(":");
        return { data: categoria === "Recria" ? 0.4 : 0.7, error: null };
      },
    }));
    const values = await fetchGmdPastosAgrupados(pastos, "2026-11-03");
    expect(Object.keys(values)).toHaveLength(72);
    for (const pasto of pastos) {
      expect(values[pasto.id]).toBe(pasto.categoria === "Recria" ? 0.4 : 0.7);
    }
    expect(mocked.rpc).toHaveBeenCalledTimes(6);
  });

  it("never publishes grouped values when one representative fails", async () => {
    mocked.rpc.mockImplementation((_name: string, args: { p_pasto: string }) => ({
      abortSignal: async () => ({
        data: args.p_pasto === "failure" ? null : 0.1,
        error: args.p_pasto === "failure" ? { code: "57014" } : null,
      }),
    }));
    await expect(fetchGmdPastosAgrupados([
      { id: "a", retiro_id: "r1", categoria: null },
      { id: "b", retiro_id: "r1", categoria: null },
      { id: "failure", retiro_id: "r2", categoria: null },
    ], "2026-10-30")).rejects.toThrow(/nao confirmado/i);
  });

  it("never starts more than 2 GMD requests concurrently", async () => {
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
    expect(maxInFlight).toBeLessThanOrEqual(2);
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
    expect(mocked.rpc).toHaveBeenCalledTimes(3);
  });

  it("recovers a transient PostgreSQL 57014 timeout with one bounded retry", async () => {
    let callCount = 0;
    mocked.rpc.mockImplementation(() => ({
      abortSignal: async () => {
        callCount += 1;
        return callCount === 1
          ? { data: null, error: { code: "57014" }, status: 500 }
          : { data: 0.75, error: null, status: 200 };
      },
    }));
    await expect(fetchGmdPastos(["pasto-1"], "2026-11-03")).resolves.toEqual({ "pasto-1": 0.75 });
    expect(mocked.rpc).toHaveBeenCalledTimes(2);
  });

  it("recovers a transient HTTP 503 while keeping the server result authoritative", async () => {
    let called = 0;
    mocked.rpc.mockImplementation(() => ({
      abortSignal: async () => ++called === 1
        ? { data: null, error: { message: "unavailable" }, status: 503 }
        : { data: 0, error: null, status: 200 },
    }));
    await expect(fetchGmdPastos(["pasto-1"], "2026-11-03"))
      .resolves.toEqual({ "pasto-1": 0 });
    expect(mocked.rpc).toHaveBeenCalledTimes(2);
  });

  it("never retries an authorization failure 42501 or presents unconfirmed GMD", async () => {
    mocked.rpc.mockImplementation(() => ({
      abortSignal: async () => ({ data: null, error: { code: "42501" }, status: 403 }),
    }));
    await expect(fetchGmdPastos(["pasto-1"], "2026-11-03"))
      .rejects.toThrow(/nao confirmado/i);
    expect(mocked.rpc).toHaveBeenCalledTimes(1);
  });

  it("fails closed after exactly one retry when a statement timeout persists", async () => {
    mocked.rpc.mockImplementation(() => ({
      abortSignal: async () => ({ data: null, error: { code: "57014" }, status: 500 }),
    }));
    await expect(fetchGmdPastos(["pasto-1"], "2026-11-03"))
      .rejects.toThrow(/nao confirmado/i);
    expect(mocked.rpc).toHaveBeenCalledTimes(2);
  });

  it("cancels an in-progress retry backoff without sending another request", async () => {
    const ac = new AbortController();
    mocked.rpc.mockImplementation(() => ({
      abortSignal: async () => ({ data: null, error: { code: "57014" }, status: 500 }),
    }));
    const result = fetchGmdPastos(["pasto-1"], "2026-11-03", ac.signal);
    await new Promise(resolve => setTimeout(resolve, 15));
    ac.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(mocked.rpc).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 200 response containing an invalid payload", async () => {
    mocked.rpc.mockImplementation(() => ({
      abortSignal: async () => ({ data: { invalid: "payload" }, error: null, status: 200 }),
    }));
    await expect(fetchGmdPastos(["pasto-1"], "2026-11-03"))
      .rejects.toThrow(/nao confirmado/i);
    expect(mocked.rpc).toHaveBeenCalledTimes(1);
  });

  it("never sends a pre-aborted farm batch to the database", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(fetchGmdPastos(["pasto"], "2026-10-30", ac.signal))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(mocked.rpc).not.toHaveBeenCalled();
  });
});
