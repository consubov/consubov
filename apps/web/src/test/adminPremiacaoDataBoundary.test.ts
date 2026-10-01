import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => {
  const order = vi.fn();
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return { from, select, eq, order };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseMocks.from,
  },
}));

import {
  supabaseAdminPremiacaoRepository,
  type AdminPremiacaoRepository,
} from "@/features/admin-premiacao/repositories/adminPremiacaoRepository";
import { listActiveFazendasForPremiacao } from "@/features/admin-premiacao/services/listActiveFazendasForPremiacao";
import { useAdminPremiacaoFazendas } from "@/features/admin-premiacao/hooks/useAdminPremiacaoFazendas";

beforeEach(() => {
  supabaseMocks.from.mockClear();
  supabaseMocks.select.mockClear();
  supabaseMocks.eq.mockClear();
  supabaseMocks.order.mockReset();
  supabaseMocks.from.mockImplementation(() => ({ select: supabaseMocks.select }));
  supabaseMocks.select.mockImplementation(() => ({ eq: supabaseMocks.eq }));
  supabaseMocks.eq.mockImplementation(() => ({ order: supabaseMocks.order }));
});

describe("Admin Premiação — fronteira de dados", () => {
  it("repository preserva exatamente a consulta de fazendas ativas", async () => {
    supabaseMocks.order.mockResolvedValue({
      data: [
        { id: "f1", nome: "Fazenda A" },
        { id: "f2", nome: "Fazenda B" },
      ],
    });

    const result = await supabaseAdminPremiacaoRepository.listActiveFazendas();

    expect(supabaseMocks.from).toHaveBeenCalledWith("fazendas");
    expect(supabaseMocks.select).toHaveBeenCalledWith("id, nome");
    expect(supabaseMocks.eq).toHaveBeenCalledWith("ativo", true);
    expect(supabaseMocks.order).toHaveBeenCalledWith("nome");
    expect(result).toEqual([
      { id: "f1", nome: "Fazenda A" },
      { id: "f2", nome: "Fazenda B" },
    ]);
  });

  it("repository mantém lista vazia quando a consulta não traz data", async () => {
    supabaseMocks.order.mockResolvedValue({ data: null });

    await expect(
      supabaseAdminPremiacaoRepository.listActiveFazendas(),
    ).resolves.toEqual([]);
  });

  it("service aceita repository substituível sem conhecer UI ou Supabase", async () => {
    const repository: AdminPremiacaoRepository = {
      listActiveFazendas: vi.fn().mockResolvedValue([
        { id: "f1", nome: "Fazenda A" },
      ]),
    };

    await expect(
      listActiveFazendasForPremiacao(repository),
    ).resolves.toEqual([{ id: "f1", nome: "Fazenda A" }]);
  });

  it("hook entrega as fazendas carregadas à página", async () => {
    const load = vi.fn().mockResolvedValue([
      { id: "f1", nome: "Fazenda A" },
    ]);

    const { result } = renderHook(() => useAdminPremiacaoFazendas(load));

    expect(result.current).toEqual([]);

    await waitFor(() => {
      expect(result.current).toEqual([{ id: "f1", nome: "Fazenda A" }]);
    });
  });

  it("página não acessa mais o cliente Supabase diretamente", () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(
      path.resolve(testDir, "../pages/AdminPremiacaoPage.tsx"),
      "utf8",
    );

    expect(source).not.toContain("@/integrations/supabase/client");
    expect(source).toContain("useAdminPremiacaoFazendas");
  });
});
