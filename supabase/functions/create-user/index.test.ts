import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { getServeHandler } from "../test/setup.ts";

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const mockClient = {
  auth: {
    getUser: vi.fn(),
    admin: {
      createUser: vi.fn(),
      updateUser: vi.fn(),
      deleteUser: vi.fn(),
      listUsers: vi.fn(),
    },
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(),
        single: vi.fn(),
        neq: vi.fn(() => ({
          maybeSingle: vi.fn(),
        })),
      })),
      maybeSingle: vi.fn(),
    })),
    insert: vi.fn(),
    update: vi.fn(() => ({
      eq: vi.fn(),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(),
    })),
  })),
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
  return new Request("http://localhost/functions/create-user", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("create-user edge function", () => {
  let createUserHandler: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    createUserHandler = await loadHandler();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const req = createMockRequest({ email: "test@test.com", senha: "123456" });
    const res = await createUserHandler(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Token de autorização ausente");
  });

  it("returns 401 when Authorization header is invalid format", async () => {
    const req = createMockRequest(
      { email: "test@test.com", senha: "123456" },
      "InvalidToken"
    );
    const res = await createUserHandler(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Token de autorização ausente");
  });

  it("returns 401 when token is invalid", async () => {
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });

    const req = createMockRequest(
      { email: "test@test.com", senha: "123456" },
      "Bearer invalid-token"
    );
    const res = await createUserHandler(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Token inválido ou expirado");
  });

  it("returns 403 when authenticated user is not an admin", async () => {
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "regular@test.com" } },
      error: null,
    });
    mockClient.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    });

    const req = createMockRequest(
      { email: "new@test.com", senha: "123456" },
      "Bearer valid-token"
    );
    const res = await createUserHandler(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("permissão de administrador");
  });

  it("returns 403 when regular user tries to create admin via role in body", async () => {
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "regular@test.com" } },
      error: null,
    });
    mockClient.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    });

    const req = createMockRequest(
      { email: "newadmin@test.com", senha: "123456", nome: "Novo Admin", role: "administrador" },
      "Bearer valid-token"
    );
    const res = await createUserHandler(req);
    expect(res.status).toBe(403);
  });

  it("allows authenticated admin to create regular user", async () => {
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "admin-123", email: "admin@test.com" } },
      error: null,
    });
    mockClient.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "admin-1", user_id: "admin-123", email: "admin@test.com", nome: "Admin" },
              error: null,
            }),
          })),
        })),
      })),
    });
    mockClient.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: "new-user-123", email: "new@test.com" } },
      error: null,
    });

    const req = createMockRequest(
      { email: "new@test.com", password: "123456" },
      "Bearer valid-admin-token"
    );
    const res = await createUserHandler(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe("Usuário criado com sucesso");
  });

  it("allows authenticated admin to create administrator", async () => {
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "admin-123", email: "admin@test.com" } },
      error: null,
    });
    mockClient.from
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "admin-1", user_id: "admin-123", email: "admin@test.com", nome: "Admin" },
                error: null,
              }),
            })),
          })),
        })),
      })
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      });
    mockClient.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: "new-admin-123", email: "newadmin@test.com" } },
      error: null,
    });
    mockClient.from.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const req = createMockRequest(
      { email: "newadmin@test.com", senha: "123456", nome: "Novo Admin", role: "administrador" },
      "Bearer valid-admin-token"
    );
    const res = await createUserHandler(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe("Administrador criado com sucesso");
  });

  it("treats invalid role in body as regular user", async () => {
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "admin-123", email: "admin@test.com" } },
      error: null,
    });
    mockClient.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "admin-1", user_id: "admin-123", email: "admin@test.com", nome: "Admin" },
              error: null,
            }),
          })),
        })),
      })),
    });
    mockClient.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: "new-user-123", email: "new@test.com" } },
      error: null,
    });

    const req = createMockRequest(
      { email: "new@test.com", senha: "123456", role: "invalid-role" },
      "Bearer valid-admin-token"
    );
    const res = await createUserHandler(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe("Usuário criado com sucesso");
  });

  it("does not leak sensitive data in error responses", async () => {
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "admin-123", email: "admin@test.com" } },
      error: null,
    });
    mockClient.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "admin-1", user_id: "admin-123", email: "admin@test.com", nome: "Admin" },
              error: null,
            }),
          })),
        })),
      })),
    });
    mockClient.auth.admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Internal service role error" },
    });

    const req = createMockRequest(
      { email: "new@test.com", senha: "123456" },
      "Bearer valid-admin-token"
    );
    const res = await createUserHandler(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).not.toContain("service role");
    expect(data.error).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});