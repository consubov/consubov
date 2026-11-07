import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  equipeSelect: vi.fn(),
  equipeEq: vi.fn(),
  auditoriaSelect: vi.fn(),
  auditoriaEq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));

import { loadSyncVetAuditoria } from "./syncVetAuditoriaRepository";

describe("SyncVet Auditoria repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockImplementation((table: string) =>
      table === "syncvet_equipe"
        ? { select: mocks.equipeSelect }
        : { select: mocks.auditoriaSelect },
    );
    mocks.equipeSelect.mockReturnValue({ eq: mocks.equipeEq });
    mocks.auditoriaSelect.mockReturnValue({ eq: mocks.auditoriaEq });
    mocks.auditoriaEq.mockReturnValue({ order: mocks.order });
    mocks.order.mockReturnValue({ limit: mocks.limit });
  });

  test("preserves tenant filters, ordering, limit, and selects", async () => {
    const equipe = { id: "e1", nome: "Equipe 1" };
    const row = { id: "a1", equipe_id: "e1", created_at: "2026-01-01" };
    mocks.equipeEq.mockResolvedValue({ data: [equipe], error: null });
    mocks.limit.mockResolvedValue({ data: [row], error: null });

    await expect(loadSyncVetAuditoria("empresa-1")).resolves.toEqual({
      equipes: [equipe],
      rows: [row],
    });

    expect(mocks.from).toHaveBeenNthCalledWith(1, "syncvet_equipe");
    expect(mocks.from).toHaveBeenNthCalledWith(2, "syncvet_auditoria");
    expect(mocks.equipeSelect).toHaveBeenCalledWith("id, nome");
    expect(mocks.equipeEq).toHaveBeenCalledWith("empresa_id", "empresa-1");
    expect(mocks.auditoriaSelect).toHaveBeenCalledWith("*");
    expect(mocks.auditoriaEq).toHaveBeenCalledWith("empresa_id", "empresa-1");
    expect(mocks.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(mocks.limit).toHaveBeenCalledWith(300);
  });

  test("preserves empty-list fallbacks", async () => {
    mocks.equipeEq.mockResolvedValue({ data: null, error: { message: "failed" } });
    mocks.limit.mockResolvedValue({ data: null, error: { message: "failed" } });

    await expect(loadSyncVetAuditoria("empresa-1")).resolves.toEqual({
      equipes: [],
      rows: [],
    });
  });
});
