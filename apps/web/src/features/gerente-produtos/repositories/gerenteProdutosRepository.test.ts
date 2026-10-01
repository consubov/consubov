import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));

import { findFazendaIdByRetiro } from "./gerenteProdutosRepository";

describe("Gerente Produtos repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  });

  test("preserves the retiro lookup query", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { fazenda_id: "fazenda-1" },
      error: null,
    });

    await expect(findFazendaIdByRetiro("retiro-1")).resolves.toBe("fazenda-1");

    expect(mocks.from).toHaveBeenCalledWith("retiros");
    expect(mocks.select).toHaveBeenCalledWith("fazenda_id");
    expect(mocks.eq).toHaveBeenCalledWith("id", "retiro-1");
    expect(mocks.maybeSingle).toHaveBeenCalledOnce();
  });

  test("preserves the null fallback when no retiro is found", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(findFazendaIdByRetiro("missing")).resolves.toBeNull();
  });
});
