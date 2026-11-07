import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataReadFailure } from "@/lib/dataReadGuard";

const mocked = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mocked }));
import { fetchGerenteCurva } from "./gerenteCurvaRepository";

function respond(data: unknown, error: unknown = null, status = 200) {
  mocked.rpc.mockReturnValue({
    abortSignal: (signal: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return Promise.resolve({ data, error, status });
    },
  });
}
const scope = { fazendaId: "farm-a", retiroId: null };
const month = {
  ano_referencia: 2026, mes_referencia: 10,
  kg_fornecido: "19590.00", cab_dias_assumidos: "168041",
};

describe("manager annual chart uses server aggregation with explicit scope", () => {
  beforeEach(() => vi.resetAllMocks());

  it("parses canonical monthly kg/head-days from one RPC", async () => {
    respond([month]);
    const result = await fetchGerenteCurva(scope);
    expect(result).toEqual([{
      ano_referencia: 2026, mes_referencia: 10,
      kg_fornecido: 19590, cab_dias_assumidos: 168041,
    }]);
    expect(mocked.rpc).toHaveBeenCalledTimes(1);
    expect(mocked.rpc).toHaveBeenCalledWith("get_gerente_curva_rapida", {
      p_fazenda_id: "farm-a", p_retiro_id: null,
    });
  });

  it("passes the authorized retreat scope to the server", async () => {
    respond([]);
    await fetchGerenteCurva({ fazendaId: "farm-a", retiroId: "retreat-a" });
    expect(mocked.rpc).toHaveBeenCalledWith("get_gerente_curva_rapida", {
      p_fazenda_id: "farm-a", p_retiro_id: "retreat-a",
    });
  });

  it.each(["57014", "PGRST202"])("does not read legacy views on %s", async (code) => {
    respond(null, { code }, code === "PGRST202" ? 404 : 500);
    await expect(fetchGerenteCurva(scope)).rejects.toBeInstanceOf(DataReadFailure);
    expect(mocked.rpc).toHaveBeenCalledTimes(1);
  });

  it("ends on permission denied without other requests", async () => {
    respond(null, { code: "42501" }, 403);
    await expect(fetchGerenteCurva(scope)).rejects.toMatchObject({ kind: "permission" });
  });

  it("rejects duplicate months and partial aggregates", async () => {
    respond([month, month]);
    await expect(fetchGerenteCurva(scope)).rejects.toMatchObject({ kind: "invalid_response" });
    respond([{ ano_referencia: 2026, mes_referencia: 10, kg_fornecido: 19590 }]);
    await expect(fetchGerenteCurva(scope)).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("preserves truly empty history", async () => {
    respond([]);
    expect(await fetchGerenteCurva(scope)).toEqual([]);
  });
});
