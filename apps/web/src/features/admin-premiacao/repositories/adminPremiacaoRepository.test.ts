import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

import { useAdminPremiacaoFazendas } from "../hooks/useAdminPremiacaoFazendas";
import { listActiveFazendasForPremiacao } from "./adminPremiacaoRepository";

describe("Admin Premiação data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ order: mocks.order });
  });

  test("repository preserves the existing active-farm query", async () => {
    mocks.order.mockResolvedValue({
      data: [
        { id: "f1", nome: "Fazenda A" },
        { id: "f2", nome: "Fazenda B" },
      ],
      error: null,
    });

    await expect(listActiveFazendasForPremiacao()).resolves.toEqual([
      { id: "f1", nome: "Fazenda A" },
      { id: "f2", nome: "Fazenda B" },
    ]);

    expect(mocks.from).toHaveBeenCalledWith("fazendas");
    expect(mocks.select).toHaveBeenCalledWith("id, nome");
    expect(mocks.eq).toHaveBeenCalledWith("ativo", true);
    expect(mocks.order).toHaveBeenCalledWith("nome");
  });

  test("repository preserves the empty-list fallback", async () => {
    mocks.order.mockResolvedValue({
      data: null,
      error: { message: "query failed" },
    });

    await expect(listActiveFazendasForPremiacao()).resolves.toEqual([]);
  });

  test("hook exposes loaded farms without knowing Supabase", async () => {
    const load = vi.fn().mockResolvedValue([
      { id: "f1", nome: "Fazenda A" },
    ]);

    const { result } = renderHook(() => useAdminPremiacaoFazendas(load));

    expect(result.current).toEqual([]);

    await waitFor(() => {
      expect(result.current).toEqual([{ id: "f1", nome: "Fazenda A" }]);
    });

    expect(load).toHaveBeenCalledTimes(1);
  });
});
