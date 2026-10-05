import { describe, expect, test } from "bun:test";
import {
  createPrincipalId,
  createTenantExecutionContext,
  createTenantId,
} from "../../identity-tenancy";
import type { FarmRecord } from "../domain/farm";
import { createFarmId } from "../domain/farm";
import { FakeFarmRepository } from "./FakeFarmRepository";

const context = createTenantExecutionContext({
  tenantId: createTenantId("tenant-test"),
  principalId: createPrincipalId("principal-test"),
  requestId: "req-farm-test",
  correlationId: "corr-farm-test",
});

function makeFarm(overrides: Partial<FarmRecord> = {}): FarmRecord {
  return {
    id: createFarmId("farm-1"),
    nome: "Fazenda Teste",
    cidade: "Ribeirão Preto",
    estado: "SP",
    administradorId: null,
    ativo: true,
    intervaloPadraoDias: 3,
    intervaloModo: "fazenda",
    auditoriaFotosPorBloco: 3,
    exigirFotoCocho: true,
    gmdModo: null,
    veraoMesInicio: null,
    veraoMesFim: null,
    criadoEm: null,
    ...overrides,
  };
}

describe("FakeFarmRepository", () => {
  test("salva e recupera uma fazenda", async () => {
    const repository = new FakeFarmRepository();
    const farm = makeFarm();

    await repository.save(farm);

    expect(await repository.findById(farm.id, context)).toEqual(farm);
  });

  test("devolve nulo quando a fazenda não existe", async () => {
    const repository = new FakeFarmRepository();

    expect(
      await repository.findById(createFarmId("inexistente"), context),
    ).toBeNull();
  });

  test("remove a fazenda", async () => {
    const repository = new FakeFarmRepository();
    const farm = makeFarm();

    await repository.save(farm);
    await repository.delete(farm.id);

    expect(await repository.findById(farm.id, context)).toBeNull();
  });
});
