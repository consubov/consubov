import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { getServeHandler } from "../test/setup.ts";

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANON_KEY = "test-anon-key";
const SERVICE_KEY = "test-service-role-key";

const getUserMock = vi.fn();
const adminMaybeSingleMock = vi.fn();
const updateUserByIdMock = vi.fn();

const callerClient = { auth: { getUser: getUserMock } };
const adminClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: adminMaybeSingleMock })),
      })),
    })),
  })),
  auth: { admin: { updateUserById: updateUserByIdMock } },
};

function createRequest(method: string, body?: unknown, authHeader?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authHeader !== undefined) headers["authorization"] = authHeader;
  return new Request("http://localhost/functions/reset-password", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const BEARER = "Bearer valid-jwt";
const BODY = { user_id: "target-user", password: "NovaSenha@123" };

describe("reset-password edge function (PRD-SEC-04)", () => {
  let handler: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    (globalThis as any).Deno.env.get = vi.fn((key: string) => {
      if (key === "SUPABASE_URL") return "http://localhost:54321";
      if (key === "SUPABASE_SERVICE_ROLE_KEY") return SERVICE_KEY;
      if (key === "SUPABASE_ANON_KEY") return ANON_KEY;
      return undefined;
    });
    (createClient as Mock).mockImplementation((_url: string, key: string) =>
      key === ANON_KEY ? callerClient : adminClient,
    );
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    adminMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    updateUserByIdMock.mockResolvedValue({ data: {}, error: null });
    await import("./index.ts");
    handler = getServeHandler();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function asAdmin() {
    getUserMock.mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
    adminMaybeSingleMock.mockResolvedValue({ data: { id: "adm-1" }, error: null });
  }

  it("responde preflight OPTIONS sem exigir auth", async () => {
    const res = await handler(createRequest("OPTIONS"));
    expect(res.status).toBe(200);
  });

  it("rejeita método indevido com 405 (GET)", async () => {
    asAdmin();
    const res = await handler(createRequest("GET", undefined, BEARER));
    expect(res.status).toBe(405);
  });

  it("anônimo → 401", async () => {
    const res = await handler(createRequest("POST", BODY));
    expect(res.status).toBe(401);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("esquema de auth inválido → 401", async () => {
    const res = await handler(createRequest("POST", BODY, "Token abc"));
    expect(res.status).toBe(401);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("token inválido → 401", async () => {
    const res = await handler(createRequest("POST", BODY, BEARER));
    expect(res.status).toBe(401);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("payload incompleto → 400", async () => {
    asAdmin();
    const res = await handler(createRequest("POST", { user_id: "x" }, BEARER));
    expect(res.status).toBe(400);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("usuário autenticado sem permissão → 403", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "capataz-1" } }, error: null });
    adminMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const res = await handler(createRequest("POST", BODY, BEARER));
    expect(res.status).toBe(403);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("role forjada no body não concede acesso → 403", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "attacker" } }, error: null });
    adminMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const res = await handler(
      createRequest("POST", { ...BODY, role: "admin", is_admin: true }, BEARER),
    );
    expect(res.status).toBe(403);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("admin legítimo → 200 success", async () => {
    asAdmin();
    const res = await handler(createRequest("POST", BODY, BEARER));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(updateUserByIdMock).toHaveBeenCalledWith("target-user", { password: "NovaSenha@123" });
  });

  it("anônimo com body ausente → 401 (auth antes do payload)", async () => {
    const res = await handler(createRequest("POST", undefined));
    expect(res.status).toBe(401);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("falha do Auth → 400 genérico sem vazar detalhe (anti-enumeração)", async () => {
    asAdmin();
    updateUserByIdMock.mockResolvedValue({ data: null, error: { message: "User not found" } });
    const res = await handler(createRequest("POST", BODY, BEARER));
    expect(res.status).toBe(400);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain("User not found");
  });
});
