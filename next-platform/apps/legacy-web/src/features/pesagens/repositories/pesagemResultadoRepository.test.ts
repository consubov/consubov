import { beforeEach, describe, expect, test, vi } from "vitest";

type QueryResponse = {
  data: unknown;
  error: unknown;
};

const mocks = vi.hoisted(() => {
  const createChain = () => {
    const chain: any = {
      response: { data: null, error: null } as QueryResponse,
    };

    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.neq = vi.fn(() => chain);
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
    atual: createChain(),
    anterior: createChain(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

import {
  fetchPesagemAnterior,
  fetchPesagemAtual,
} from "./pesagemResultadoRepository";

describe("pesagemResultadoRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.atual.response = { data: null, error: null };
    mocks.anterior.response = { data: null, error: null };
  });

  test("preserves the current-pesagem query and error result", async () => {
    const error = { message: "current failed" };
    mocks.atual.response = {
      data: {
        lote_id: "l1",
        media_calculada: 410,
        data_pesagem: "2026-09-10",
      },
      error,
    };
    mocks.from.mockReturnValue(mocks.atual);

    const result = await fetchPesagemAtual("p1");

    expect(mocks.from).toHaveBeenCalledWith("pesagens");
    expect(mocks.atual.select).toHaveBeenCalledWith(
      "*, pastos(nome, num_animais, retiros(fazendas(nome)))",
    );
    expect(mocks.atual.eq).toHaveBeenCalledWith("id", "p1");
    expect(mocks.atual.maybeSingle).toHaveBeenCalledTimes(1);
    expect(result.error).toBe(error);
    expect(result.data?.lote_id).toBe("l1");
  });

  test("preserves the previous-pesagem query and limit", async () => {
    const error = { message: "previous warning" };
    mocks.anterior.response = {
      data: [
        {
          media_calculada: 400,
          data_pesagem: "2026-09-01",
        },
      ],
      error,
    };
    mocks.from.mockReturnValue(mocks.anterior);

    const result = await fetchPesagemAnterior("l1", "p1");

    expect(mocks.from).toHaveBeenCalledWith("pesagens");
    expect(mocks.anterior.select).toHaveBeenCalledWith(
      "media_calculada, data_pesagem",
    );
    expect(mocks.anterior.eq).toHaveBeenCalledWith("lote_id", "l1");
    expect(mocks.anterior.neq).toHaveBeenCalledWith("id", "p1");
    expect(mocks.anterior.order).toHaveBeenCalledWith("data_pesagem", {
      ascending: false,
    });
    expect(mocks.anterior.limit).toHaveBeenCalledWith(1);
    expect(result.error).toBe(error);
    expect(result.data).toHaveLength(1);
  });

  test("preserves null data fallbacks", async () => {
    mocks.from.mockReturnValueOnce(mocks.atual);
    await expect(fetchPesagemAtual("p1")).resolves.toEqual({
      data: null,
      error: null,
    });

    mocks.from.mockReturnValueOnce(mocks.anterior);
    await expect(fetchPesagemAnterior("l1", "p1")).resolves.toEqual({
      data: null,
      error: null,
    });
  });
});
