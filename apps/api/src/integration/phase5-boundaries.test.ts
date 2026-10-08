import { describe, expect, test } from "bun:test";
import { FakeFarmRepository } from "../modules/farms/infrastructure/FakeFarmRepository";
import { createFarmId, type FarmRecord } from "../modules/farms/domain/farm";
import {
  createPermissionScope,
  createPrincipalId,
  createTenantId,
} from "../modules/identity-tenancy";
import {
  FakeAuthorizationAdapter,
  FakeIdentityVerifierAdapter,
  FakeTenantContextAdapter,
} from "../modules/identity-tenancy/adapters/fakes";
import { CRITICAL_WRITE_POLICIES } from "../shared/domain/critical-write-policy";

const tenantA = createTenantId("tenant-a");
const tenantB = createTenantId("tenant-b");
const principalId = createPrincipalId("user-a");
const readScope = createPermissionScope("farm:read");

function farm(): FarmRecord {
  return {
    id: createFarmId("farm-a"),
    nome: "Fazenda Integração",
    cidade: "Araguaína",
    estado: "TO",
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
  };
}

async function authenticatedContext(scopes = [readScope]) {
  const verifier = new FakeIdentityVerifierAdapter();
  verifier.register("credential-a", {
    identity: {
      tenantId: tenantA,
      principal: { kind: "user", id: principalId },
      scopes,
      claims: {
        principalId,
        principalKind: "user",
        tenantId: tenantA,
        scopes,
        expired: false,
        revoked: false,
      },
    },
  });

  const identity = await verifier.verifyAndResolve({
    kind: "bearer",
    value: "credential-a",
  });
  expect(identity).not.toBeNull();

  const contextAdapter = new FakeTenantContextAdapter();
  return contextAdapter.resolveContext(identity!, "req-phase5-integration");
}

describe("FASE 5 local integration boundaries", () => {
  test("identity -> tenant context -> authorization -> repository read works without remote persistence", async () => {
    const context = await authenticatedContext();
    const authorization = new FakeAuthorizationAdapter();

    const decision = await authorization.authorize(context, {
      resourceTenantId: tenantA,
      requiredScopes: [readScope],
    });
    expect(decision.allowed).toBe(true);

    const repository = new FakeFarmRepository();
    const record = farm();
    await repository.save(record);

    expect(await repository.findById(record.id, context)).toEqual(record);
  });

  test("tenant mismatch is denied before repository access can affect data", async () => {
    const context = await authenticatedContext();
    const authorization = new FakeAuthorizationAdapter();
    const repository = new FakeFarmRepository();
    const record = farm();
    await repository.save(record);

    const decision = await authorization.authorize(context, {
      resourceTenantId: tenantB,
      requiredScopes: [readScope],
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.error.code).toBe("TENANT_MISMATCH");

    expect(await repository.findById(record.id, context)).toEqual(record);
  });

  test("missing resource scope is denied and leaves the repository unchanged", async () => {
    const context = await authenticatedContext([]);
    const authorization = new FakeAuthorizationAdapter();
    const repository = new FakeFarmRepository();
    const record = farm();
    await repository.save(record);

    const decision = await authorization.authorize(context, {
      resourceTenantId: tenantA,
      requiredScopes: [readScope],
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.error.code).toBe("MISSING_SCOPE");

    expect(await repository.findById(record.id, context)).toEqual(record);
  });

  test("critical writes require idempotency, known version, atomic authority and explicit conflict handling", () => {
    for (const policy of Object.values(CRITICAL_WRITE_POLICIES)) {
      expect(policy.requiresIdempotencyKey).toBe(true);
      expect(policy.requiresKnownVersion).toBe(true);
      expect(policy.requiresAtomicAuthority).toBe(true);
      expect(policy.requiresExplicitConflictStrategy).toBe(true);
      expect(policy.genericLastWriteWins).toBe(false);
      expect(policy.realtimeIsAuthoritative).toBe(false);
    }
  });
});
