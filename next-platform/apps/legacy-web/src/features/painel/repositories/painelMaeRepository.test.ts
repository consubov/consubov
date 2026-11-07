import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

import { fetchPainelMae } from "./painelMaeRepository";

describe("painelMaeRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("preserves the existing RPC name and parameters", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          consumo_real_g_cab_dia: 90,
          consumo_global_g_cab_dia: 100,
          eficiencia: 0.9,
          pastos_na_meta_num: 4,
          pastos_na_meta_den: 5,
          peso_medio_kg: 320,
        },
      ],
      error: null,
    });

    const result = await fetchPainelMae({
      fazendaId: "fazenda-1",
      retiroId: "retiro-1",
      mes: 9,
      ano: 2026,
    });

    expect(mocks.rpc).toHaveBeenCalledWith("get_painel_mae", {
      p_fazenda_id: "fazenda-1",
      p_retiro_id: "retiro-1",
      p_mes: 9,
      p_ano: 2026,
    });

    expect(result.error).toBeNull();
    expect(Array.isArray(result.data)).toBe(true);
  });

  test("preserves null retiro for whole-farm aggregation", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: null,
    });

    await fetchPainelMae({
      fazendaId: "fazenda-1",
      retiroId: null,
      mes: 10,
      ano: 2026,
    });

    expect(mocks.rpc).toHaveBeenCalledWith("get_painel_mae", {
      p_fazenda_id: "fazenda-1",
      p_retiro_id: null,
      p_mes: 10,
      p_ano: 2026,
    });
  });

  test("returns RPC errors for the hook to preserve its fallback behavior", async () => {
    const error = { message: "rpc failed" };

    mocks.rpc.mockResolvedValue({
      data: null,
      error,
    });

    const result = await fetchPainelMae({
      fazendaId: "fazenda-1",
      retiroId: null,
      mes: 10,
      ano: 2026,
    });

    expect(result.error).toBe(error);
  });
});
