import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataReadFailure } from "@/lib/dataReadGuard";

const mocked = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mocked }));

import { fetchGerenteCustos } from "./gerenteCustosRepository";

const params = { fazendaId: "farm-a", mes: 10, ano: 2026 };
const good = {
  retiro_id: "retreat-a", total_sacos: 653, total_cab_dias: "159539",
  custo_mensal: "52109.40", custo_diario: "0.3266",
};
function respond(data: unknown, error: unknown = null, status = 200) {
  mocked.rpc.mockReturnValue({
    abortSignal: (signal: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return Promise.resolve({ data, error, status });
    },
  });
}
describe("manager-only fast cost RPC boundary", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reads verified costs without loading legacy views", async () => {
    respond([good]);
    const rows = await fetchGerenteCustos(params);
    expect(rows).toEqual([{
      retiro_id: "retreat-a", total_sacos: 653, total_cab_dias: 159539,
      custo_mensal: 52109.40, custo_diario: 0.3266,
    }]);
    expect(mocked.rpc).toHaveBeenCalledTimes(1);
    expect(mocked.rpc).toHaveBeenCalledWith("get_gerente_custos_rapido", {
      p_fazenda_id: "farm-a", p_mes: 10, p_ano: 2026,
    });
  });

  it.each(["57014", "PGRST202"])("does not retry heavy views on %s", async (code) => {
    respond(null, { code }, code === "PGRST202" ? 404 : 500);
    await expect(fetchGerenteCustos(params)).rejects.toBeInstanceOf(DataReadFailure);
    expect(mocked.rpc).toHaveBeenCalledTimes(1);
  });

  it("enforces permission-denial boundary", async () => {
    respond(null, { code: "42501" }, 403);
    await expect(fetchGerenteCustos(params)).rejects.toMatchObject({ kind: "permission" });
  });

  it("rejects partial rows instead of interpreting them as R$ 0", async () => {
    respond([{ retiro_id: "retreat-a", total_sacos: 653 }]);
    await expect(fetchGerenteCustos(params)).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("rejects invalid numeric values", async () => {
    respond([{ ...good, custo_mensal: "NaN" }]);
    await expect(fetchGerenteCustos(params)).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("rejects duplicated retreat scope", async () => {
    respond([good, good]);
    await expect(fetchGerenteCustos(params)).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("accepts a confirmed empty period with explicit zero costs", async () => {
    respond([{ ...good, total_sacos: 0, total_cab_dias: 0,
      custo_mensal: 0, custo_diario: 0 }]);
    expect((await fetchGerenteCustos(params))[0].custo_mensal).toBe(0);
  });

  it("refuses a malformed RPC payload", async () => {
    respond(null);
    await expect(fetchGerenteCustos(params)).rejects.toMatchObject({ kind: "invalid_response" });
  });
});
