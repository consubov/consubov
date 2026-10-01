import { beforeEach, describe, expect, test, vi } from "vitest";

type QueryResponse = {
  data: unknown;
  error?: unknown;
};

const mocks = vi.hoisted(() => {
  const createChain = () => {
    const chain: any = {
      response: { data: null, error: null } as QueryResponse,
    };

    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(() => Promise.resolve(chain.response));
    chain.then = (
      resolve: (value: QueryResponse) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(chain.response).then(resolve, reject);

    return chain;
  };

  return {
    from: vi.fn(),
    eventos: createChain(),
    pesagens: createChain(),
    sanitario: createChain(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

import {
  getUltimaPesagem,
  getUltimoSanitario,
  listEventosLote,
} from "./eventosLoteRepository";

describe("eventosLoteRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.eventos.response = { data: [], error: null };
    mocks.pesagens.response = { data: null, error: null };
    mocks.sanitario.response = { data: null, error: null };

    mocks.from.mockImplementation((table: string) => {
      if (table === "eventos_lote") return mocks.eventos;
      if (table === "pesagens") return mocks.pesagens;
      if (table === "eventos_sanitarios") return mocks.sanitario;
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  test("preserves the eventos_lote query", async () => {
    mocks.eventos.response = {
      data: [{ id: "e1", lote_id: "l1" }],
      error: null,
    };

    const result = await listEventosLote("l1");

    expect(mocks.from).toHaveBeenCalledWith("eventos_lote");
    expect(mocks.eventos.select).toHaveBeenCalledWith("*");
    expect(mocks.eventos.eq).toHaveBeenCalledWith("lote_id", "l1");
    expect(mocks.eventos.order).toHaveBeenCalledWith("data_evento", {
      ascending: false,
    });
    expect(result).toHaveLength(1);
  });

  test("preserves the latest-pesagem query", async () => {
    mocks.pesagens.response = {
      data: { id: "p1", lote_id: "l1" },
      error: null,
    };

    const result = await getUltimaPesagem("l1");

    expect(mocks.from).toHaveBeenCalledWith("pesagens");
    expect(mocks.pesagens.select).toHaveBeenCalledWith("*");
    expect(mocks.pesagens.eq).toHaveBeenCalledWith("lote_id", "l1");
    expect(mocks.pesagens.order).toHaveBeenCalledWith("data_pesagem", {
      ascending: false,
    });
    expect(mocks.pesagens.limit).toHaveBeenCalledWith(1);
    expect(mocks.pesagens.maybeSingle).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: "p1", lote_id: "l1" });
  });

  test("preserves the latest-sanitary-event query", async () => {
    mocks.sanitario.response = {
      data: { id: "s1", lote_id: "l1" },
      error: null,
    };

    const result = await getUltimoSanitario("l1");

    expect(mocks.from).toHaveBeenCalledWith("eventos_sanitarios");
    expect(mocks.sanitario.select).toHaveBeenCalledWith("*");
    expect(mocks.sanitario.eq).toHaveBeenCalledWith("lote_id", "l1");
    expect(mocks.sanitario.order).toHaveBeenCalledWith("data_aplicacao", {
      ascending: false,
    });
    expect(mocks.sanitario.limit).toHaveBeenCalledWith(1);
    expect(mocks.sanitario.maybeSingle).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: "s1", lote_id: "l1" });
  });

  test("keeps empty/null fallbacks", async () => {
    await expect(listEventosLote("l1")).resolves.toEqual([]);
    await expect(getUltimaPesagem("l1")).resolves.toBeNull();
    await expect(getUltimoSanitario("l1")).resolves.toBeNull();
  });
});
