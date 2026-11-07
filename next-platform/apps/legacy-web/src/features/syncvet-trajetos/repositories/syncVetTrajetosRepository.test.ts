import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  equipeSelect: vi.fn(),
  empresaEq: vi.fn(),
  userEq: vi.fn(),
  maybeSingle: vi.fn(),
  trajetosSelect: vi.fn(),
  vetEq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  fazendasSelect: vi.fn(),
  fazendasEq: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));

import { loadSyncVetTrajetos } from "./syncVetTrajetosRepository";

describe("SyncVet Trajetos repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockImplementation((table: string) => {
      if (table === "syncvet_equipe") return { select: mocks.equipeSelect };
      if (table === "syncvet_trajetos") return { select: mocks.trajetosSelect };
      return { select: mocks.fazendasSelect };
    });
    mocks.equipeSelect.mockReturnValue({ eq: mocks.empresaEq });
    mocks.empresaEq.mockReturnValue({ eq: mocks.userEq });
    mocks.userEq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.trajetosSelect.mockReturnValue({ eq: mocks.vetEq });
    mocks.vetEq.mockReturnValue({ order: mocks.order });
    mocks.order.mockReturnValue({ limit: mocks.limit });
    mocks.fazendasSelect.mockReturnValue({ eq: mocks.fazendasEq });
  });

  test("preserves user and tenant scoping plus list contracts", async () => {
    const trajeto = { id: "t1", fazenda_id: "f1" };
    const fazenda = { id: "f1", nome: "Fazenda 1" };
    mocks.maybeSingle.mockResolvedValue({ data: { id: "vet-1" }, error: null });
    mocks.limit.mockResolvedValue({ data: [trajeto], error: null });
    mocks.fazendasEq.mockResolvedValue({ data: [fazenda], error: null });

    await expect(loadSyncVetTrajetos("empresa-1", "user-1")).resolves.toEqual({
      trajetos: [trajeto],
      fazendas: [fazenda],
    });

    expect(mocks.equipeSelect).toHaveBeenCalledWith("id");
    expect(mocks.empresaEq).toHaveBeenCalledWith("empresa_id", "empresa-1");
    expect(mocks.userEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mocks.maybeSingle).toHaveBeenCalledOnce();
    expect(mocks.trajetosSelect).toHaveBeenCalledWith(
      "id, data, fazenda_id, distancia_km, duracao_min, origem_endereco",
    );
    expect(mocks.vetEq).toHaveBeenCalledWith("veterinario_id", "vet-1");
    expect(mocks.order).toHaveBeenCalledWith("data", { ascending: false });
    expect(mocks.limit).toHaveBeenCalledWith(200);
    expect(mocks.fazendasSelect).toHaveBeenCalledWith("id, nome");
    expect(mocks.fazendasEq).toHaveBeenCalledWith("empresa_id", "empresa-1");
  });

  test("stops with empty fallbacks when the user has no team row", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(loadSyncVetTrajetos("empresa-1", "user-1")).resolves.toEqual({
      trajetos: [],
      fazendas: null,
    });
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  test("preserves empty-list fallbacks from list queries", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "vet-1" }, error: null });
    mocks.limit.mockResolvedValue({ data: null, error: { message: "failed" } });
    mocks.fazendasEq.mockResolvedValue({ data: null, error: { message: "failed" } });

    await expect(loadSyncVetTrajetos("empresa-1", "user-1")).resolves.toEqual({
      trajetos: [],
      fazendas: [],
    });
  });
});
