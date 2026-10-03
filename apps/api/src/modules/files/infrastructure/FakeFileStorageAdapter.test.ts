import { describe, expect, test } from "bun:test";
import { caminhoDoEscopo } from "../domain/arquivo";
import { FakeFileStorageAdapter } from "./FakeFileStorageAdapter";
import type { TenantExecutionContext } from "../../modules/identity-tenancy/domain/tenant-context";

describe("FakeFileStorageAdapter", () => {
  const mockContext: TenantExecutionContext = {
    tenantId: "tenant-1",
    principalId: "user-1",
    requestId: "req-1",
    correlationId: "corr-1",
  };

  test("grava e recupera a referência respeitando o escopo do usuário", async () => {
    const adapter = new FakeFileStorageAdapter();

    const ref = await adapter.store(
      {
        escopo: { kind: "usuario", usuarioId: "user-1" },
        nomeArquivo: "comprovante.jpg",
        conteudo: new Uint8Array([1, 2, 3]),
        contentType: "image/jpeg",
      },
      mockContext,
    );

    expect(ref.caminho).toBe("user-1/comprovante.jpg");
    expect(await adapter.findRef(ref.caminho, mockContext)).toEqual(ref);
  });

  test("isola arquivos de usuários diferentes pelo caminho", async () => {
    const adapter = new FakeFileStorageAdapter();

    const ref = await adapter.store(
      {
        escopo: { kind: "usuario", usuarioId: "user-1" },
        nomeArquivo: "comprovante.jpg",
        conteudo: new Uint8Array([1]),
      },
      mockContext,
    );

    expect(
      await adapter.findRef(
        caminhoDoEscopo({ kind: "usuario", usuarioId: "user-2" }, "comprovante.jpg"),
        mockContext,
      ),
    ).toBeNull();
    expect(await adapter.findRef(ref.caminho, mockContext)).not.toBeNull();
  });

  test("remove a referência do arquivo", async () => {
    const adapter = new FakeFileStorageAdapter();

    const ref = await adapter.store(
      {
        escopo: { kind: "usuario", usuarioId: "user-1" },
        nomeArquivo: "comprovante.jpg",
        conteudo: new Uint8Array([1]),
      },
      mockContext,
    );

    await adapter.remove(ref.caminho, mockContext);

    expect(await adapter.findRef(ref.caminho, mockContext)).toBeNull();
  });
});
