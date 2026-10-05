import type { TenantExecutionContext } from "../../identity-tenancy";
import type { FarmId, FarmRecord } from "../domain/farm";
import { createFarmId } from "../domain/farm";
import type { FarmReaderPort } from "../domain/ports";

export class FakeFarmRepository implements FarmReaderPort {
  private farms = new Map<string, FarmRecord>();

  async findById(
    id: FarmId,
    context: TenantExecutionContext,
  ): Promise<FarmRecord | null> {
    void context;
    return this.farms.get(id) ?? null;
  }

  /** Atalho do adaptador de teste; a API de leitura do domínio não expõe escrita. */
  async save(farm: FarmRecord): Promise<void> {
    this.farms.set(createFarmId(farm.id), farm);
  }

  async delete(id: FarmId): Promise<void> {
    this.farms.delete(id);
  }
}
