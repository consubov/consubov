import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: vi.fn(),
}));

const mockAdminClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
        })),
      })),
    })),
  })),
};

const originalDenoEnvGet = (globalThis as any).Deno.env.get;

let requireAdmin: (req: Request) => Promise<{ admin: any; error: Response | null }>;

async function loadAuthHelper() {
  vi.resetModules();
  vi.stubEnv("SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

  (createClient as Mock).mockReturnValue(mockAdminClient);

  const mod = await import("../_shared/auth.ts");
  requireAdmin = mod.requireAdmin;
}

function createMockRequest(authHeader?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authHeader) headers["authorization"] = authHeader;
  return new Request("http://localhost/functions/test", {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
}

describe("requireAdmin auth helper", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (globalThis as any).Deno.env.get = originalDenoEnvGet;
    await loadAuthHelper();
  });

  it("returns 500 when SUPABASE_URL is not configured", async () => {
    (globalThis as any).Deno.env.get = vi.fn((key: string) =>
      key === "SUPABASE_SERVICE_ROLE_KEY" ? "test-service-role-key" : undefined,
    );
    vi.resetModules();
    (createClient as Mock).mockReturnValue(mockAdminClient);
    const mod = await import("../_shared/auth.ts");
    const req = createMockRequest("Bearer token");
    const result = await mod.requireAdmin(req);
    expect(result.error).not.toBeNull();
    expect(result.error?.status).toBe(500);
  });

  it("returns 500 when SUPABASE_SERVICE_ROLE_KEY is not configured", async () => {
    (globalThis as any).Deno.env.get = vi.fn((key: string) =>
      key === "SUPABASE_URL" ? "http://localhost:54321" : undefined,
    );
    vi.resetModules();
    (createClient as Mock).mockReturnValue(mockAdminClient);
    const mod = await import("../_shared/auth.ts");
    const req = createMockRequest("Bearer token");
    const result = await mod.requireAdmin(req);
    expect(result.error).not.toBeNull();
    expect(result.error?.status).toBe(500);
  });

  it("returns 401 when Authorization header is missing", async () => {
    const req = createMockRequest();
    const result = await requireAdmin(req);
    expect(result.error).not.toBeNull();
    expect(result.error?.status).toBe(401);
    expect(result.admin).toBeNull();
  });

  it("returns 401 when Authorization header is not Bearer", async () => {
    const req = createMockRequest("Basic invalid");
    const result = await requireAdmin(req);
    expect(result.error).not.toBeNull();
    expect(result.error?.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    mockAdminClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });

    const req = createMockRequest("Bearer invalid-token");
    const result = await requireAdmin(req);
    expect(result.error).not.toBeNull();
    expect(result.error?.status).toBe(401);
    expect(result.admin).toBeNull();
  });

  it("returns 403 when user is not an active admin", async () => {
    mockAdminClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "user@test.com" } },
      error: null,
    });
    mockAdminClient.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    });

    const req = createMockRequest("Bearer valid-token");
    const result = await requireAdmin(req);
    expect(result.error).not.toBeNull();
    expect(result.error?.status).toBe(403);
    expect(result.admin).toBeNull();
  });

  it("returns admin when user is an active admin", async () => {
    mockAdminClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "admin-123", email: "admin@test.com" } },
      error: null,
    });
    mockAdminClient.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "admin-1", user_id: "admin-123", email: "admin@test.com", nome: "Admin User" },
              error: null,
            }),
          })),
        })),
      })),
    });

    const req = createMockRequest("Bearer valid-admin-token");
    const result = await requireAdmin(req);
    expect(result.error).toBeNull();
    expect(result.admin).toEqual({
      id: "admin-1",
      user_id: "admin-123",
      email: "admin@test.com",
      nome: "Admin User",
    });
  });

  it("selects the modern server key for the administrative Supabase client", async () => {
    const modernKey = "sb_secret_synthetic_not_live";
    (globalThis as any).Deno.env.get = vi.fn((key: string) => ({
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: modernKey }),
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    } as Record<string, string>)[key]);
    vi.resetModules();
    (createClient as Mock).mockReturnValue(mockAdminClient);
    const mod = await import("../_shared/auth.ts");
    mod.getAdminClient();
    expect(createClient).toHaveBeenCalledWith(
      "http://localhost:54321",
      modernKey,
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: false }),
      }),
    );
  });

  it("returns 500 when modern server-key configuration is malformed even with legacy present", async () => {
    (globalThis as any).Deno.env.get = vi.fn((key: string) => ({
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SECRET_KEYS: "{malformed",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    } as Record<string, string>)[key]);
    vi.resetModules();
    (createClient as Mock).mockReturnValue(mockAdminClient);
    const mod = await import("../_shared/auth.ts");
    const result = await mod.requireAdmin(createMockRequest("Bearer valid-token"));
    expect(result.error?.status).toBe(500);
    expect(createClient).not.toHaveBeenCalled();
  });

});
