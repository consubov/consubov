import { describe, expect, test } from "bun:test";
import { caminhoDoEscopo } from "../domain/arquivo";
import { FakeFileStorageAdapter } from "./FakeFileStorageAdapter";

describe("FakeFileStorageAdapter", () => {
  test("grava e recupera a referência respeitando o escopo do usuário", async () => {
    const adapter = new FakeFileStorageAdapter();

    const ref = await adapter.store({
      escopo: { kind: "usuario", usuarioId: "user-1" },
      nomeArquivo: "comprovante.jpg",
      conteudo: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    });

    expect(ref.caminho).toBe("user-1/comprovante.jpg");
    expect(await adapter.findRef(ref.caminho)).toEqual(ref);
  });

  test("isola arquivos de usuários diferentes pelo caminho", async () => {
    const adapter = new FakeFileStorageAdapter();

    const ref = await adapter.store({
      escopo: { kind: "usuario", usuarioId: "user-1" },
      nomeArquivo: "comprovante.jpg",
      conteudo: new Uint8Array([1]),
    });

    expect(
      await adapter.findRef(caminhoDoEscopo({ kind: "usuario", usuarioId: "user-2" }, "comprovante.jpg")),
    ).toBeNull();
    expect(await adapter.findRef(ref.caminho)).not.toBeNull();
  });

  test("remove a referência do arquivo", async () => {
    const adapter = new FakeFileStorageAdapter();

    const ref = await adapter.store({
      escopo: { kind: "usuario", usuarioId: "user-1" },
      nomeArquivo: "comprovante.jpg",
      conteudo: new Uint8Array([1]),
    });

    await adapter.remove(ref.caminho);

    expect(await adapter.findRef(ref.caminho)).toBeNull();
  });
});
