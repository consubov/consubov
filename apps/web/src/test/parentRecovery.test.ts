import { describe, expect, it } from "vitest";
import { buildParentPayload } from "@/lib/consultorOffline/parentRecovery";

describe("recriação do registro pai a partir do backup local", () => {
  it("remove id e campos locais, mantendo colunas reais", () => {
    const payload = buildParentPayload({
      id: "2355dbe1-0000-0000-0000-000000000000",
      letra: "P",
      ordem: 16,
      num_pasto: "29/5",
      qtd_animais: 41,
      fotos: [{ id: "f1" }],
      samples: { fezes: [] },
      signed: { a: "url" },
      observacao: null,
      indefinido: undefined,
    });
    expect(payload).toEqual({
      letra: "P",
      ordem: 16,
      num_pasto: "29/5",
      qtd_animais: 41,
      observacao: null,
    });
  });
});
