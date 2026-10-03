import { describe, expect, it, beforeEach } from "bun:test";
import {
  FakeAuthorizationAdapter,
  FakeIdentityVerifierAdapter,
  FakeTenantContextAdapter,
  FakeTenancyRepository,
} from "./fakes";
import {
  createPermissionScope,
  createPrincipalId,
  createTenantId,
} from "../domain/identity";
import { MembershipStatus } from "../domain/tenant-model";

describe("FakeTenantContextAdapter", () => {
  it("resolves context from identity", async () => {
    const adapter = new FakeTenantContextAdapter();
    const identity = {
      tenantId: createTenantId("tenant-1"),
      principal: { kind: "user" as const, id: createPrincipalId("user-1") },
      scopes: [createPermissionScope("resource:read")],
    };

    const context = await adapter.resolveContext(identity, "req-1");

    expect(context.requestId).toBe("req-1");
    expect(context.tenantId).toBe("tenant-1");
    expect(context.principal.id).toBe("user-1");
    expect(context.scopes).toContain("resource:read");
  });
});

describe("FakeAuthorizationAdapter", () => {
  it("authorizes when tenant matches and scopes are met", async () => {
    const adapter = new FakeAuthorizationAdapter();
    const context = {
      requestId: "req-1",
      tenantId: createTenantId("tenant-1"),
      principal: { kind: "user" as const, id: createPrincipalId("user-1") },
      scopes: [createPermissionScope("resource:read")],
    };

    const decision = await adapter.authorize(context, {
      resourceTenantId: createTenantId("tenant-1"),
      requiredScopes: [createPermissionScope("resource:read")],
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies when tenant does not match", async () => {
    const adapter = new FakeAuthorizationAdapter();
    const context = {
      requestId: "req-1",
      tenantId: createTenantId("tenant-1"),
      principal: { kind: "user" as const, id: createPrincipalId("user-1") },
      scopes: [],
    };

    const decision = await adapter.authorize(context, {
      resourceTenantId: createTenantId("tenant-2"),
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.error.code).toBe("TENANT_MISMATCH");
    }
  });
});

describe("FakeIdentityVerifierAdapter", () => {
  const baseIdentity = {
    tenantId: createTenantId("tenant-1"),
    principal: { kind: "user" as const, id: createPrincipalId("user-1") },
    scopes: [createPermissionScope("resource:read")],
    claims: {
      principalId: "user-1",
      principalKind: "user" as const,
      tenantId: createTenantId("tenant-1"),
      scopes: [createPermissionScope("resource:read")],
      expired: false,
      revoked: false,
    },
  };

  it("resolves a user principal with positive scopes", async () => {
    const verifier = new FakeIdentityVerifierAdapter();
    verifier.register("token-user", { identity: baseIdentity });
    const result = await verifier.verifyAndResolve({ kind: "bearer", value: "token-user" });
    expect(result?.principal.kind).toBe("user");
    expect(result?.scopes).toContain("resource:read");
  });

  it("resolves an integration principal", async () => {
    const verifier = new FakeIdentityVerifierAdapter();
    verifier.register("key-integration", {
      identity: {
        ...baseIdentity,
        principal: { kind: "integration" as const, id: createPrincipalId("int-1") },
      },
    });
    const result = await verifier.verifyAndResolve({ kind: "api-key", value: "key-integration" });
    expect(result?.principal.kind).toBe("integration");
  });

  it("returns null for missing or unknown credentials", async () => {
    const verifier = new FakeIdentityVerifierAdapter();
    expect(await verifier.verifyAndResolve({ kind: "bearer", value: "" })).toBeNull();
    expect(await verifier.verifyAndResolve({ kind: "bearer", value: "unknown" })).toBeNull();
  });

  it("returns null for expired or revoked credentials", async () => {
    const verifier = new FakeIdentityVerifierAdapter();
    verifier.register("expired", { identity: baseIdentity, expired: true });
    verifier.register("revoked", { identity: baseIdentity, revoked: true });
    expect(await verifier.verifyAndResolve({ kind: "bearer", value: "expired" })).toBeNull();
    expect(await verifier.verifyAndResolve({ kind: "bearer", value: "revoked" })).toBeNull();
  });

  it("returns null when tenant context cannot be resolved", async () => {
    const verifier = new FakeIdentityVerifierAdapter();
    verifier.register("no-tenant", {
      identity: { ...baseIdentity, tenantId: "" as never },
    });
    expect(await verifier.verifyAndResolve({ kind: "bearer", value: "no-tenant" })).toBeNull();
  });

  it("rejects inconsistent verified identity claims", async () => {
    const verifier = new FakeIdentityVerifierAdapter();
    verifier.register("mismatch", {
      identity: {
        ...baseIdentity,
        claims: { ...baseIdentity.claims, tenantId: createTenantId("tenant-2") },
      },
    });
    expect(await verifier.verifyAndResolve({ kind: "bearer", value: "mismatch" })).toBeNull();
  });

  it("scopes are preserved for negative authorization cases", async () => {
    const verifier = new FakeIdentityVerifierAdapter();
    verifier.register("limited", { identity: { ...baseIdentity, scopes: [] as const } });
    const result = await verifier.verifyAndResolve({ kind: "bearer", value: "limited" });
    expect(result?.scopes).toEqual([]);
  });
});

describe("FakeTenancyRepository", () => {
  let repo: FakeTenancyRepository;

  beforeEach(() => {
    repo = new FakeTenancyRepository();
  });

  it("should create and retrieve a tenant", () => {
    const tenant = {
      id: createTenantId("tenant-1"),
      name: "Test Tenant",
      slug: "test-tenant",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    repo.createTenant(tenant);
    const retrieved = repo.getTenant("tenant-1");

    expect(retrieved).toEqual(tenant);
  });

  it("should create and retrieve a membership", () => {
    const membership = {
      id: "membership-1",
      tenantId: createTenantId("tenant-1"),
      principalId: createPrincipalId("user-1"),
      status: MembershipStatus.ACTIVE,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    repo.createMembership(membership);
    const retrieved = repo.getMembership("membership-1");

    expect(retrieved).toEqual(membership);
  });

  it("should return null for non-existent tenant", () => {
    const retrieved = repo.getTenant("non-existent");
    expect(retrieved).toBeUndefined();
  });

  it("should return null for non-existent membership", () => {
    const retrieved = repo.getMembership("non-existent");
    expect(retrieved).toBeUndefined();
  });

  it("should return active tenant when membership is active", () => {
    const tenant = {
      id: createTenantId("tenant-1"),
      name: "Test Tenant",
      slug: "test-tenant",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const membership = {
      id: "membership-1",
      tenantId: createTenantId("tenant-1"),
      principalId: createPrincipalId("user-1"),
      status: MembershipStatus.ACTIVE,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    repo.createTenant(tenant);
    repo.createMembership(membership);

    const activeTenant = repo.getActiveTenant("tenant-1", "user-1");

    expect(activeTenant).not.toBeNull();
    if (activeTenant) {
      expect(activeTenant.tenant).toEqual(tenant);
      expect(activeTenant.membership).toEqual(membership);
    }
  });

  it("keeps the canonical membership catalog limited to ACTIVE", () => {
    expect(Object.values(MembershipStatus)).toEqual(["ACTIVE"]);
  });

  it("does not infer an active tenant when a principal has multiple memberships", () => {
    const userId = createPrincipalId("user-1");
    const tenant1 = {
      id: createTenantId("tenant-1"),
      name: "Tenant 1",
      slug: "tenant-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const tenant2 = {
      id: createTenantId("tenant-2"),
      name: "Tenant 2",
      slug: "tenant-2",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    repo.createTenant(tenant1);
    repo.createTenant(tenant2);
    repo.createMembership({
      id: "membership-1", tenantId: tenant1.id, principalId: userId,
      status: MembershipStatus.ACTIVE, role: "role-1", createdAt: new Date(), updatedAt: new Date(),
    });
    repo.createMembership({
      id: "membership-2", tenantId: tenant2.id, principalId: userId,
      status: MembershipStatus.ACTIVE, role: "role-2", createdAt: new Date(), updatedAt: new Date(),
    });

    expect(repo.listActiveTenantsByPrincipal("user-1")).toHaveLength(2);
    expect(repo.getActiveTenantByPrincipal("user-1")).toBeNull();
    expect(repo.getActiveTenant("tenant-1", "user-1")?.tenant.id).toBe("tenant-1");
  });

  it("should return null when no membership exists for principal", () => {
    const tenant = {
      id: createTenantId("tenant-1"),
      name: "Test Tenant",
      slug: "test-tenant",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    repo.createTenant(tenant);

    const activeTenant = repo.getActiveTenant("tenant-1", "user-1");
    expect(activeTenant).toBeNull();
  });
});

