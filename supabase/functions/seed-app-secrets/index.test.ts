import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getServeHandler } from "../test/setup.ts";

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SECRET = "test-service-role-key";

const getUserMock = vi.fn();
const adminMaybeSingleMock = vi.fn();
const upsertMock = vi.fn();

const selectChain = {
  eq: vi.fn().mockReturnThis(),
  maybeSingle: adminMaybeSingleMock,
};

const mockClient = {
  auth: { getUser: getUserMock },
  from: vi.fn(() => ({
    select: vi.fn(() => selectChain),
    upsert: upsertMock,
  })),
};

async function loadHandler() {
  vi.resetModules();
  vi.stubEnv("SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SECRET);

  (createClient as Mock).mockReturnValue(mockClient);

  await import("./index.ts");
  return getServeHandler();
}

function setupAdminSession() {
  getUserMock.mockResolvedValue({
    data: { user: { id: "admin-123", email: "admin@test.com" } },
    error: null,
  });
  adminMaybeSingleMock.mockResolvedValue({
    data: { id: "admin-1", user_id: "admin-123", email: "admin@test.com", nome: "Admin" },
    error: null,
  });
}

function createRequest(method: string, body?: unknown, authHeader?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authHeader) headers["authorization"] = authHeader;
  return new Request("http://localhost/functions/seed-app-secrets", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("seed-app-secrets edge function", () => {
  let handler: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "Invalid token" } });
    adminMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    upsertMock.mockResolvedValue({ error: null });
    handler = await loadHandler();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await handler(createRequest("POST", {}));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Token de autorização ausente");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("returns 401 when token is invalid", async () => {
    const res = await handler(createRequest("POST", {}, "Bearer invalid-token"));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Token inválido ou expirado");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("returns 403 when authenticated user is not an admin", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "regular@test.com" } },
      error: null,
    });

    const res = await handler(createRequest("POST", {}, "Bearer valid-token"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("permissão de administrador");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("admin POST seeds only allowlist keys and never the service role value", async () => {
    setupAdminSession();

    const res = await handler(createRequest("POST", {}, "Bearer valid-admin-token"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.keys).toEqual(["supabase_url"]);

    expect(upsertMock).toHaveBeenCalled();
    expect(mockClient.from).toHaveBeenCalledWith("app_secrets");

    const payloads = upsertMock.mock.calls.map((call) => call[0]);
    for (const payload of payloads) {
      expect(payload.key).toBe("supabase_url");
      expect(payload.value).not.toBe(SECRET);
      expect(typeof payload.value).toBe("string");
      expect(payload.value.length).toBeGreaterThan(0);
    }
  });

  it("rejects bodies requesting service_role_key with 403 and performs no write (both shapes)", async () => {
    setupAdminSession();

    const deniedBodies = [{ keys: ["service_role_key"] }, { service_role_key: "x" }];
    for (const body of deniedBodies) {
      const res = await handler(createRequest("POST", body, "Bearer valid-admin-token"));
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("allowlist");
      expect(data.ok).toBeUndefined();
    }

    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("returns 405 for GET and answers OPTIONS with ok", async () => {
    const getRes = await handler(createRequest("GET"));
    expect(getRes.status).toBe(405);
    expect(getRes.headers.get("Allow")).toBe("POST, OPTIONS");
    expect(upsertMock).not.toHaveBeenCalled();

    const optionsRes = await handler(createRequest("OPTIONS"));
    expect(optionsRes.status).toBe(200);
    expect(await optionsRes.text()).toBe("ok");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("never includes the service role value in the response body", async () => {
    setupAdminSession();

    const res = await handler(createRequest("POST", {}, "Bearer valid-admin-token"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(SECRET);
    expect(text).toContain("ok");
    expect(text).toContain("supabase_url");
  });

  it("never logs the service role value", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      setupAdminSession();
      await handler(createRequest("POST", {}, "Bearer valid-admin-token"));
      await handler(createRequest("POST", { keys: ["service_role_key"] }, "Bearer valid-admin-token"));

      const allLogged = JSON.stringify([
        ...logSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
      ]);
      expect(allLogged).not.toContain(SECRET);
      expect(logSpy.mock.calls.length).toBeGreaterThan(0);
      expect(warnSpy.mock.calls.length).toBeGreaterThan(0);
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("returns 500 without leaking details when server config is incomplete", async () => {
    const envGet = (globalThis as any).Deno.env.get as Mock;
    const originalImpl = envGet.getMockImplementation();
    envGet.mockImplementation(() => undefined);
    try {
      const res = await handler(createRequest("POST", {}, "Bearer valid-admin-token"));
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).not.toContain(SECRET);
      expect(upsertMock).not.toHaveBeenCalled();
    } finally {
      envGet.mockImplementation(originalImpl);
    }
  });

  it("does not use the network or a real secret", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(() => Promise.reject(new Error("network is forbidden in tests")));
    (globalThis as any).fetch = fetchMock;
    try {
      setupAdminSession();
      const res = await handler(createRequest("POST", {}, "Bearer valid-admin-token"));
      expect(res.status).toBe(200);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBe(SECRET);
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });
});

describe("static regression guard for seed-app-secrets/index.ts", () => {
  const source = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf-8");
  const codeLines = source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !line.startsWith("//"));
  const code = codeLines.join("\n");

  it("never references the administrative secret", () => {
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("SERVICE_ROLE");
    expect(code).not.toMatch(/service_role/i);
    expect(code).not.toMatch(/SUPABASE_SERVICE/i);
  });

  it("keeps an explicit allowlist containing only non-sensitive keys", () => {
    const allowMatch = code.match(/ALLOWED_KEYS\s*(?::[^=]+)?=\s*\[([^\]]*)\]/);
    expect(allowMatch).not.toBeNull();
    const allowed = [...allowMatch![1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
    expect(allowed).toEqual(["supabase_url"]);
  });

  it("only reads whitelisted environment variables and writes through the allowlist", () => {
    const envNames = [...code.matchAll(/Deno\.env\.get\(\s*["']([^"']+)["']\s*\)/g)].map(
      (m) => m[1]
    );
    expect(envNames.length).toBeGreaterThan(0);
    expect(envNames.every((name) => name === "SUPABASE_URL")).toBe(true);

    const keyLiterals = [...code.matchAll(/\bkey\s*:\s*["']([^"']+)["']/g)].map((m) => m[1]);
    expect(keyLiterals.every((key) => key === "supabase_url")).toBe(true);

    const upsertCalls = code.match(/\.upsert\(/g) ?? [];
    expect(upsertCalls.length).toBe(1);
    expect(code).toMatch(/\.upsert\(\s*\{\s*key\b/);
    expect(code).toContain('from("app_secrets")');
  });

  it("authenticates admins before any write", () => {
    const authIndex = code.indexOf("await requireAdmin(req)");
    expect(authIndex).toBeGreaterThan(-1);
    expect(authIndex).toBeLessThan(code.indexOf(".upsert("));
  });
});
