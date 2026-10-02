import { describe, expect, it, beforeEach } from "bun:test";
import {
  FakeAuthorizationAdapter,
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
      joinedAt: new Date(),
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
      joinedAt: new Date(),
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

  it("should return null when membership is not active", () => {
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
      status: MembershipStatus.PENDING,
      role: "admin",
      joinedAt: new Date(),
    };

    repo.createTenant(tenant);
    repo.createMembership(membership);

    const activeTenant = repo.getActiveTenant("tenant-1", "user-1");
    expect(activeTenant).toBeNull();
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
