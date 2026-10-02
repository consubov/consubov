import { describe, expect, test } from "bun:test";
import { caminhoDoEscopo } from "./arquivo";

describe("caminhoDoEscopo", () => {
  test("prefixa o caminho com a pasta do usuário no escopo por usuário", () => {
    expect(
      caminhoDoEscopo({ kind: "usuario", usuarioId: "user-1" }, "cupom.jpg"),
    ).toBe("user-1/cupom.jpg");
  });

  test("mantém o caminho como informado no escopo compartilhado", () => {
    expect(
      caminhoDoEscopo(
        { kind: "compartilhado" },
        "pecuarista/pesagens/pesagem-1.pdf",
      ),
    ).toBe("pecuarista/pesagens/pesagem-1.pdf");
  });
});
