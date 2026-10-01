import { describe, expect, it, vi } from "vitest";
import type { MaQueueItem } from "@/lib/maisArrobasQueue";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

import { coletarAlvosGmd } from "@/lib/maGmdResync";

function item(id: string, op: MaQueueItem["op"]): MaQueueItem {
  return {
    id,
    refId: id,
    op,
    createdAt: `2026-01-01T00:00:00.000Z#${id}`,
    attempts: 0,
  };
}

describe("GMD offline — alvos para reconciliação", () => {
  it("coleta pesos identificados e elimina IDs repetidos", () => {
    const peso = {
      kind: "pecuarista_peso_id" as const,
      pesoId: "peso-1",
      animalIdLocal: "animal-local",
      pecuaristaId: "pecuarista-1",
      numero: "10",
      loteId: "lote-1",
      pesagemLoteId: "pesagem-1",
      pesoKg: 450,
      gmdIndividual: 1.25,
      leituraBalancaoId: null,
    };

    const result = coletarAlvosGmd([
      item("1", peso),
      item("2", { ...peso }),
    ]);

    expect(result).toEqual({
      pesoIds: ["peso-1"],
      pesagemIds: [],
    });
  });

  it("coleta somente finalizações de pesagem de lote relevantes", () => {
    const result = coletarAlvosGmd([
      item("1", {
        kind: "update",
        table: "pesagens_lote_pecuarista",
        id: "pesagem-finalizada",
        values: { hora_fim: "2026-01-01T12:00:00Z" },
      }),
      item("2", {
        kind: "update",
        table: "pesagens_lote_pecuarista",
        id: "pesagem-em-andamento",
        values: { peso_medio: 410 },
      }),
      item("3", {
        kind: "update",
        table: "outra_tabela",
        id: "outro",
        values: { hora_fim: "2026-01-01T12:00:00Z" },
      }),
    ]);

    expect(result).toEqual({
      pesoIds: [],
      pesagemIds: ["pesagem-finalizada"],
    });
  });
});
