import { beforeEach, describe, expect, test, vi } from "vitest";

type QueryResponse = {
  data: unknown[] | null;
  error: unknown;
};

const mocks = vi.hoisted(() => {
  const createChain = () => {
    const chain: any = {
      response: { data: [], error: null } as QueryResponse,
    };

    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.then = (
      resolve: (value: QueryResponse) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(chain.response).then(resolve, reject);

    return chain;
  };

  return {
    from: vi.fn(),
    pastos: createChain(),
    atual: createChain(),
    mes: createChain(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

import { fetchPastosRetiroSources } from "./pastosRetiroRepository";

describe("pastosRetiroRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.pastos.response = { data: [], error: null };
    mocks.atual.response = { data: [], error: null };
    mocks.mes.response = { data: [], error: null };

    mocks.from.mockImplementation((table: string) => {
      if (table === "pastos") return mocks.pastos;
      if (table === "view_painel_mae_pasto_atual") return mocks.atual;
      if (table === "view_painel_mae_pasto") return mocks.mes;
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  test("preserves the three source queries used by the hook", async () => {
    await fetchPastosRetiroSources("retiro-1", 9, 2026);

    expect(mocks.from).toHaveBeenCalledWith("pastos");
    expect(mocks.pastos.select).toHaveBeenCalledWith(
      "id, nome, num_animais, peso_medio_kg, gmd_kg_dia",
    );
    expect(mocks.pastos.eq).toHaveBeenNthCalledWith(
      1,
      "retiro_id",
      "retiro-1",
    );
    expect(mocks.pastos.eq).toHaveBeenNthCalledWith(2, "ativo", true);
    expect(mocks.pastos.order).toHaveBeenCalledWith("nome");

    expect(mocks.from).toHaveBeenCalledWith("view_painel_mae_pasto_atual");
    expect(mocks.atual.select).toHaveBeenCalledWith(
      "pasto_id, consumo_global_g_cab_dia, indice_global, status_global, num_animais, peso_medio_kg",
    );
    expect(mocks.atual.eq).toHaveBeenCalledWith("retiro_id", "retiro-1");

    expect(mocks.from).toHaveBeenCalledWith("view_painel_mae_pasto");
    expect(mocks.mes.select).toHaveBeenCalledWith("pasto_id, num_sacos");
    expect(mocks.mes.eq).toHaveBeenNthCalledWith(
      1,
      "retiro_id",
      "retiro-1",
    );
    expect(mocks.mes.eq).toHaveBeenNthCalledWith(2, "mes_referencia", 9);
    expect(mocks.mes.eq).toHaveBeenNthCalledWith(3, "ano_referencia", 2026);
  });

  test("returns source results without applying composition rules", async () => {
    mocks.pastos.response = {
      data: [
        {
          id: "p1",
          nome: "Pasto 1",
          num_animais: 10,
          peso_medio_kg: 300,
          gmd_kg_dia: 1.2,
        },
      ],
      error: null,
    };
    mocks.atual.response = {
      data: [
        {
          pasto_id: "p1",
          consumo_global_g_cab_dia: 90,
          indice_global: 1.1,
          status_global: "ok",
          num_animais: 10,
          peso_medio_kg: 300,
        },
      ],
      error: null,
    };
    mocks.mes.response = {
      data: [{ pasto_id: "p1", num_sacos: 4 }],
      error: null,
    };

    const result = await fetchPastosRetiroSources("retiro-1", 9, 2026);

    expect(result.pastosRes.data).toHaveLength(1);
    expect(result.atualRes.data).toHaveLength(1);
    expect(result.mesRes.data).toHaveLength(1);
  });
});
