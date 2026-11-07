import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataReadFailure } from "@/lib/dataReadGuard";
import { RequestTimeoutError } from "@/lib/requestDeadline";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), abortSignal: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc },
}));
import { fetchGerenteFazendas, GERENTE_FAZENDAS_DEADLINE_MS } from "./gerenteFazendasRepository";
const valid = [
  { id: "farm-A", nome: "Fazenda A", intervalo_padrao_dias: 4, gmd_modo: "manual", gerente_nome: "Gerente Teste" },
  { id: "farm-B", nome: "Fazenda B", intervalo_padrao_dias: null, gmd_modo: null, gerente_nome: "Gerente Teste" },
];

describe("manager farm discovery (authenticated scoped RPC only)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.rpc.mockReturnValue({ abortSignal: mocks.abortSignal });
    mocks.abortSignal.mockResolvedValue({ data: valid, error: null, status: 200 });
  });

  it("sends only the selected manager role ID and accepts verified farms", async () => {
    expect(await fetchGerenteFazendas("manager-A")).toEqual(valid);
    expect(mocks.rpc).toHaveBeenCalledWith("get_gerente_fazendas_rapido", {
      p_gerente_id: "manager-A",
    });
    expect(mocks.abortSignal).toHaveBeenCalledTimes(1);
    expect(mocks.abortSignal.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it("deduplicates authorized primary and secondary farm rows", async () => {
    mocks.abortSignal.mockResolvedValue({
      data: [...valid, { ...valid[0] }], error: null, status: 200,
    });
    expect(await fetchGerenteFazendas("manager-A")).toEqual(valid);
  });

  it("allows a confirmed empty list without inventing a primary farm", async () => {
    mocks.abortSignal.mockResolvedValue({ data: [], error: null, status: 200 });
    expect(await fetchGerenteFazendas("manager-A")).toEqual([]);
  });

  it("rejects permission failures without querying an unscoped fallback", async () => {
    mocks.abortSignal.mockResolvedValue({
      data: valid, error: { code: "42501" }, status: 403,
    });
    await expect(fetchGerenteFazendas("manager-B")).rejects.toMatchObject({
      kind: "permission",
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects missing server function rather than overloading RLS views", async () => {
    mocks.abortSignal.mockResolvedValue({
      data: null, error: { code: "PGRST202" }, status: 404,
    });
    await expect(fetchGerenteFazendas("manager-A")).rejects.toMatchObject({
      kind: "unavailable",
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects partial or malformed rows rather than trusting cached filters", async () => {
    for (const data of [null, [{ id: "farm-A" }], [{ id: null, nome: "Fazenda" }], [{ id: "farm-B", nome: "" }]]) {
      mocks.abortSignal.mockResolvedValueOnce({ data, error: null, status: 200 });
      await expect(fetchGerenteFazendas("manager-A")).rejects.toBeInstanceOf(DataReadFailure);
    }
  });

  it("stops a hung browser request after the manager-specific 20s deadline", async () => {
    vi.useFakeTimers();
    try {
      let pendingSignal: AbortSignal | null = null;
      mocks.abortSignal.mockImplementation((signal: AbortSignal) => {
        pendingSignal = signal;
        return new Promise<never>(() => undefined);
      });
      const promise = fetchGerenteFazendas("manager-A");
      const expectation = expect(promise).rejects.toBeInstanceOf(RequestTimeoutError);
      await vi.advanceTimersByTimeAsync(GERENTE_FAZENDAS_DEADLINE_MS);
      await expectation;
      expect(pendingSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
