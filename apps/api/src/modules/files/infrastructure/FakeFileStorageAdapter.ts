import {
  caminhoDoEscopo,
  type ArquivoCaminho,
  type ArquivoReferencia,
  type StoreFileCommand,
} from "../domain/arquivo";
import type { FileStoragePort } from "../domain/ports";
import type { TenantExecutionContext } from "../../identity-tenancy/domain/tenant-context";

/**
 * Adaptador em memória para teste. Não representa storage remoto e não produz
 * URL assinada: devolve um identificador estável para a referência.
 */
export class FakeFileStorageAdapter implements FileStoragePort {
  private storage = new Map<string, ArquivoReferencia>();

  async store(command: StoreFileCommand, context: TenantExecutionContext): Promise<ArquivoReferencia> {
    const caminho = caminhoDoEscopo(command.escopo, command.nomeArquivo);
    const ref: ArquivoReferencia = { caminho, url: `mem://${caminho}` };

    this.storage.set(caminho, ref);

    return ref;
  }

  async findRef(caminho: ArquivoCaminho, context: TenantExecutionContext): Promise<ArquivoReferencia | null> {
    return this.storage.get(caminho) ?? null;
  }

  async remove(caminho: ArquivoCaminho, context: TenantExecutionContext): Promise<void> {
    this.storage.delete(caminho);
  }
}
