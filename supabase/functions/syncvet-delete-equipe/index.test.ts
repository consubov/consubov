import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { getServeHandler } from "../test/setup.ts";

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANON_KEY = "test-anon-key";
const SERVICE_KEY = "test-service-role-key";
const UUID_TARGET = "11111111-1111-4111-8111-111111111111";
const UUID_OTHER_EMPRESA = "22222222-2222-4222-8222-222222222222";
const EMPRESA_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EMPRESA_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const getUserMock = vi.fn();

// Estado mutável por teste para o client service-role.
const state = {
  target: { data: null as any, error: null as any },
  membership: { data: null as any, error: null as any },
  adminRow: { data: null as any, error: null as any },
  counts: { manejos: 0, servicos: 0, servEquipe: 0 },
  deleteError: null as any,
  updateError: null as any,
};

let syncvetQueue: Array<{ data: any; error: any }>;

const adminClient = {
  auth: { admin: { deleteUser: vi.fn(() => Promise.resolve({ data: {}, error: null })) } },
  from: vi.fn((table: string) => {
    if (table === "syncvet_equipe") {
      return {
        select: vi.fn(() => {
          const chain: any = {
            eq: vi.fn(() => chain),
            maybeSingle: vi.fn(() => Promise.resolve(syncvetQueue.shift() ?? { data: null, error: null })),
          };
          return chain;
        }),
        delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: state.deleteError })) })),
        update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: state.updateError })) })),
      };
    }
    if (table === "administradores") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve(state.adminRow)),
            })),
          })),
        })),
      };
    }
    const countByTable: Record<string, number> = {
      syncvet_manejos: state.counts.manejos,
      syncvet_servicos: state.counts.servicos,
      syncvet_servico_equipe: state.counts.servEquipe,
    };
    return {
      select: vi.fn((_cols: string, _opts?: unknown) => ({
        eq: vi.fn(() => Promise.resolve({ count: countByTable[table] ?? 0 })),
      })),
    };
  }),
};

const callerClient = { auth: { getUser: getUserMock } };

function authAs(userId: string | null) {
  if (!userId) {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
  } else {
    getUserMock.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  }
}

function createRequest(method: string, body?: unknown, authHeader?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authHeader !== undefined) headers["authorization"] = authHeader;
  return new Request("http://localhost/functions/syncvet-delete-equipe", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const BEARER = "Bearer valid-jwt";

describe("syncvet-delete-equipe edge function (PRD-SEC-04)", () => {
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
    state.target = { data: null, error: null };
    state.membership = { data: null, error: null };
    state.adminRow = { data: null, error: null };
    state.counts = { manejos: 0, servicos: 0, servEquipe: 0 };
    state.deleteError = null;
    state.updateError = null;
    syncvetQueue = [];
    authAs(null);
    await import("./index.ts");
    handler = getServeHandler();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("responde preflight OPTIONS sem exigir auth", async () => {
    const res = await handler(createRequest("OPTIONS"));
    expect(res.status).toBe(200);
  });

  it("rejeita método indevido com 405 (GET)", async () => {
    const res = await handler(createRequest("GET", undefined, BEARER));
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toContain("POST");
  });

  it("anônimo → 401", async () => {
    const res = await handler(createRequest("POST", { equipe_id: UUID_TARGET }));
    expect(res.status).toBe(401);
  });

  it("esquema de auth inválido → 401", async () => {
    const res = await handler(createRequest("POST", { equipe_id: UUID_TARGET }, "Token abc"));
    expect(res.status).toBe(401);
  });

  it("token inválido/expirado → 401", async () => {
    authAs(null);
    const res = await handler(createRequest("POST", { equipe_id: UUID_TARGET }, BEARER));
    expect(res.status).toBe(401);
  });

  it("equipe_id ausente → 400", async () => {
    authAs("caller-1");
    const res = await handler(createRequest("POST", {}, BEARER));
    expect(res.status).toBe(400);
  });

  it("equipe_id malformado → 400 (sem tocar no banco)", async () => {
    authAs("caller-1");
    const res = await handler(createRequest("POST", { equipe_id: "' OR 1=1 --" }, BEARER));
    expect(res.status).toBe(400);
    expect(adminClient.from).not.toHaveBeenCalled();
  });

  it("alvo inexistente → 404", async () => {
    authAs("caller-1");
    syncvetQueue = [{ data: null, error: null }];
    const res = await handler(createRequest("POST", { equipe_id: UUID_TARGET }, BEARER));
    expect(res.status).toBe(404);
  });

  it("usuário sem vínculo (outro módulo) → 403 e nada é excluído", async () => {
    authAs("capataz-outro-modulo");
    syncvetQueue = [
      { data: { id: UUID_TARGET, empresa_id: EMPRESA_A, user_id: "victim", nome: "V" }, error: null },
      { data: null, error: null },
    ];
    state.adminRow = { data: null, error: null };
    const res = await handler(createRequest("POST", { equipe_id: UUID_TARGET }, BEARER));
    expect(res.status).toBe(403);
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("identidade/role forjada no body não altera autorização → 403", async () => {
    authAs("attacker");
    syncvetQueue = [
      { data: { id: UUID_TARGET, empresa_id: EMPRESA_A, user_id: "victim", nome: "V" }, error: null },
      { data: null, error: null },
    ];
    state.adminRow = { data: null, error: null };
    const res = await handler(
      createRequest(
        "POST",
        { equipe_id: UUID_TARGET, user_id: "victim", role: "admin", is_admin: true, tenant_id: EMPRESA_A },
        BEARER,
      ),
    );
    expect(res.status).toBe(403);
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("membro de OUTRA empresa → 403 (cross-tenant bloqueado)", async () => {
    authAs("member-empresa-b");
    syncvetQueue = [
      { data: { id: UUID_TARGET, empresa_id: EMPRESA_A, user_id: "victim", nome: "V" }, error: null },
      { data: { id: UUID_OTHER_EMPRESA, empresa_id: EMPRESA_B }, error: null },
    ];
    state.adminRow = { data: null, error: null };
    const res = await handler(createRequest("POST", { equipe_id: UUID_TARGET }, BEARER));
    expect(res.status).toBe(403);
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("membro da MESMA empresa, sem histórico → 200 deleted + revoga Auth", async () => {
    authAs("member-empresa-a");
    syncvetQueue = [
      { data: { id: UUID_TARGET, empresa_id: EMPRESA_A, user_id: "victim", nome: "V" }, error: null },
      { data: { id: "m1", empresa_id: EMPRESA_A }, error: null },
    ];
    const res = await handler(createRequest("POST", { equipe_id: UUID_TARGET }, BEARER));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(adminClient.auth.admin.deleteUser).toHaveBeenCalledWith("victim");
  });

  it("membro da MESMA empresa, com histórico → 200 deactivated", async () => {
    authAs("member-empresa-a");
    syncvetQueue = [
      { data: { id: UUID_TARGET, empresa_id: EMPRESA_A, user_id: "victim", nome: "V" }, error: null },
      { data: { id: "m1", empresa_id: EMPRESA_A }, error: null },
    ];
    state.counts = { manejos: 2, servicos: 0, servEquipe: 0 };
    const res = await handler(createRequest("POST", { equipe_id: UUID_TARGET }, BEARER));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deactivated: true });
  });

  it("admin global ativo, sem vínculo SyncVet → 200 (fluxo legítimo preservado)", async () => {
    authAs("global-admin");
    syncvetQueue = [
      { data: { id: UUID_TARGET, empresa_id: EMPRESA_A, user_id: "victim", nome: "V" }, error: null },
      { data: null, error: null },
    ];
    state.adminRow = { data: { id: "adm-1" }, error: null };
    const res = await handler(createRequest("POST", { equipe_id: UUID_TARGET }, BEARER));
    expect(res.status).toBe(200);
  });

  it("falha interna do banco → 500 genérico sem vazar detalhe", async () => {
    authAs("member-empresa-a");
    syncvetQueue = [
      { data: { id: UUID_TARGET, empresa_id: EMPRESA_A, user_id: null, nome: "V" }, error: null },
      { data: { id: "m1", empresa_id: EMPRESA_A }, error: null },
    ];
    state.deleteError = { message: "permission denied for relation syncvet_equipe (SQLSTATE 42501)" };
    const res = await handler(createRequest("POST", { equipe_id: UUID_TARGET }, BEARER));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("SQLSTATE");
    expect(JSON.stringify(body)).not.toContain("permission denied");
  });
});
