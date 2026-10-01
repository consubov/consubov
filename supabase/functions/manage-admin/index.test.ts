import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { getServeHandler } from "../test/setup.ts";

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const createMockChain = (overrides = {}) => {
  const chain = {
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn().mockImplementation((onFulfilled) => {
      // Make the chain thenable - when awaited, resolve with the mocked response
      return Promise.resolve(overrides.mockResponse || { data: null, error: null, count: 2 }).then(onFulfilled);
    }),
    ...overrides,
  };
  return chain;
};

async function loadHandler() {
  vi.resetModules();
  vi.stubEnv("SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

  (createClient as Mock).mockReturnValue(mockClient);

  await import("./index.ts");
  return getServeHandler();
}

function createMockRequest(body: Record<string, unknown>, authHeader?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authHeader) headers["authorization"] = authHeader;
  return new Request("http://localhost/functions/manage-admin", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const mockClient = {
  auth: {
    getUser: vi.fn(),
    admin: {
      createUser: vi.fn(),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      deleteUser: vi.fn().mockResolvedValue({ error: null }),
      listUsers: vi.fn(),
    },
  },
  from: vi.fn(() => ({
    select: vi.fn(() => createMockChain()),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
    delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
  })),
};

// Track from() call index for each test
let fromCallIndex = 0;
let fromCallMocks: any[] = [];

function setupFromMocks(mocks: any[]) {
  fromCallMocks = mocks;
  fromCallIndex = 0;
  mockClient.from.mockImplementation(() => {
    const mock = fromCallMocks[fromCallIndex] || fromCallMocks[fromCallMocks.length - 1];
    fromCallIndex++;
    return mock;
  });
}

function setupAuth(user: { id: string; email: string } | null, error: any = null) {
  mockClient.auth.getUser.mockResolvedValue({
    data: { user },
    error,
  });
}

function createAdminFromMock(admin: { id: string; user_id: string; email: string; nome: string } | null) {
  return {
    select: vi.fn(() => createMockChain({
      maybeSingle: vi.fn().mockResolvedValue({
        data: admin,
        error: null,
      }),
    })),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
    delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
  };
}

function createHandlerFromMock(overrides: { select?: any; update?: any; delete?: any } = {}) {
  return {
    select: overrides.select ? vi.fn(() => createMockChain(overrides.select)) : vi.fn(() => createMockChain()),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: overrides.update || vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
    delete: overrides.delete || vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
  };
}

describe("manage-admin edge function", () => {
  let manageAdminHandler: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    manageAdminHandler = await loadHandler();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const req = createMockRequest({ action: "update", admin_id: "admin-1", nome: "Test", email: "test@test.com" });
    const res = await manageAdminHandler(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Token de autorização ausente");
  });

  it("returns 401 when token is invalid", async () => {
    setupAuth(null, { message: "Invalid token" });
    setupFromMocks([]); // No from() calls needed

    const req = createMockRequest(
      { action: "update", admin_id: "admin-1", nome: "Test", email: "test@test.com" },
      "Bearer invalid-token"
    );
    const res = await manageAdminHandler(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Token inválido ou expirado");
  });

  it("returns 403 when authenticated user is not an admin", async () => {
    setupAuth({ id: "user-123", email: "regular@test.com" }, null);
    setupFromMocks([createAdminFromMock(null)]); // requireAdmin call - no admin found

    const req = createMockRequest(
      { action: "update", admin_id: "admin-1", nome: "Test", email: "test@test.com" },
      "Bearer valid-token"
    );
    const res = await manageAdminHandler(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("permissão de administrador");
  });

  it("ignores requesting_user_id from body and uses token identity for self-deletion check", async () => {
    setupAuth({ id: "admin-123", email: "admin@test.com" }, null);
    setupFromMocks([
      // Call 0: requireAdmin - caller admin
      createAdminFromMock({ id: "admin-1", user_id: "admin-123", email: "admin@test.com", nome: "Admin" }),
      // Call 1: fetch target admin for self-deletion check
      createHandlerFromMock({
        select: {
          single: vi.fn().mockResolvedValue({
            data: { id: "admin-1", user_id: "admin-123" },
            error: null,
          }),
        },
      }),
      // Call 2: count check
      createHandlerFromMock({
        select: {
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      }),
    ]);

    const req = createMockRequest(
      {
        action: "delete",
        admin_id: "admin-1",
        requesting_user_id: "different-user-id",
      },
      "Bearer valid-admin-token"
    );
    const res = await manageAdminHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Você não pode excluir a si mesmo");
  });

  it("prevents regular user from deleting admin even with forged requesting_user_id", async () => {
    setupAuth({ id: "user-123", email: "regular@test.com" }, null);
    setupFromMocks([createAdminFromMock(null)]); // requireAdmin - no admin

    const req = createMockRequest(
      {
        action: "delete",
        admin_id: "admin-1",
        requesting_user_id: "admin-123",
      },
      "Bearer valid-token"
    );
    const res = await manageAdminHandler(req);
    expect(res.status).toBe(403);
  });

  it("prevents regular user from updating admin", async () => {
    setupAuth({ id: "user-123", email: "regular@test.com" }, null);
    setupFromMocks([createAdminFromMock(null)]); // requireAdmin - no admin

    const req = createMockRequest(
      { action: "update", admin_id: "admin-1", nome: "Test", email: "test@test.com" },
      "Bearer valid-token"
    );
    const res = await manageAdminHandler(req);
    expect(res.status).toBe(403);
  });

  it("allows authenticated admin to update another admin", async () => {
    setupAuth({ id: "admin-123", email: "admin@test.com" }, null);
    setupFromMocks([
      // Call 0: requireAdmin - caller admin
      createAdminFromMock({ id: "admin-1", user_id: "admin-123", email: "admin@test.com", nome: "Admin" }),
      // Call 1: fetch target admin
      createHandlerFromMock({
        select: {
          single: vi.fn().mockResolvedValue({
            data: { id: "admin-2", user_id: "admin-456", email: "admin2@test.com" },
            error: null,
          }),
        },
      }),
      // Call 2: duplicate email check
      createHandlerFromMock({
        select: {
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      }),
      // Call 3: update
      createHandlerFromMock({
        update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      }),
    ]);

    mockClient.auth.admin.updateUser.mockResolvedValue({ error: null });

    const req = createMockRequest(
      { action: "update", admin_id: "admin-2", nome: "Updated", email: "updated@test.com" },
      "Bearer valid-admin-token"
    );
    const res = await manageAdminHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("allows authenticated admin to delete another admin", async () => {
    setupAuth({ id: "admin-123", email: "admin@test.com" }, null);
    setupFromMocks([
      // Call 0: requireAdmin - caller admin
      createAdminFromMock({ id: "admin-1", user_id: "admin-123", email: "admin@test.com", nome: "Admin" }),
      // Call 1: fetch target admin
      createHandlerFromMock({
        select: {
          single: vi.fn().mockResolvedValue({
            data: { id: "admin-2", user_id: "admin-456" },
            error: null,
          }),
        },
      }),
      // Call 2: count check - returns count > 1 so deletion is allowed
      // The handler does: const { count } = await admin.from(...).select("id", { count: "exact", head: true }).eq("ativo", true)
      // The response has a `count` property directly on the result
      createHandlerFromMock({
        select: vi.fn(() => createMockChain({
          mockResponse: { count: 2, error: null },
        })),
      }),
      // Call 3: delete
      createHandlerFromMock({
        delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      }),
    ]);

    mockClient.auth.admin.deleteUser.mockResolvedValue({ error: null });

    const req = createMockRequest(
      { action: "delete", admin_id: "admin-2" },
      "Bearer valid-admin-token"
    );
    const res = await manageAdminHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("rejects invalid action", async () => {
    setupAuth({ id: "admin-123", email: "admin@test.com" }, null);
    setupFromMocks([
      // Call 0: requireAdmin - caller admin
      createAdminFromMock({ id: "admin-1", user_id: "admin-123", email: "admin@test.com", nome: "Admin" }),
    ]);

    const req = createMockRequest(
      { action: "invalid", admin_id: "admin-1" },
      "Bearer valid-admin-token"
    );
    const res = await manageAdminHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Ação inválida. Use 'update' ou 'delete'");
  });

  it("does not leak sensitive data in error responses", async () => {
    setupAuth({ id: "admin-123", email: "admin@test.com" }, null);
    setupFromMocks([
      // Call 0: requireAdmin - caller admin
      createAdminFromMock({ id: "admin-1", user_id: "admin-123", email: "admin@test.com", nome: "Admin" }),
      // Call 1: fetch target admin
      createHandlerFromMock({
        select: {
          single: vi.fn().mockResolvedValue({
            data: { id: "admin-2", user_id: "admin-456", email: "admin2@test.com" },
            error: null,
          }),
        },
      }),
      // Call 2: duplicate email check
      createHandlerFromMock({
        select: {
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      }),
      // Call 3: update (will fail)
      createHandlerFromMock({
        update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      }),
    ]);

    mockClient.auth.admin.updateUser.mockResolvedValue({
      error: { message: "Internal service role error" },
    });

    const req = createMockRequest(
      { action: "update", admin_id: "admin-2", nome: "Updated", email: "updated@test.com" },
      "Bearer valid-admin-token"
    );
    const res = await manageAdminHandler(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).not.toContain("service role");
    expect(data.error).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});