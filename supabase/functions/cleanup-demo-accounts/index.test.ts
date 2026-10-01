import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { getServeHandler } from "../test/setup.ts";

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TEST_URL = "http://localhost:54321";
const TEST_KEY = "test-service-role-key";
const ADMIN_EMAIL = "admin@consubov.test";
const USER_EMAIL = "usuario@consubov.test";
const ADMIN_TOKEN = "valid-admin-token";

type Row = Record<string, unknown>;
// valor de tabela: row comum ou factory que lança (para simular falha de query)
type TableValue = Row | (() => never);

const deleteUserMock = vi.fn();
const removeMock = vi.fn();
const deleteMock = vi.fn();
const ltCalls: unknown[][] = [];

function makeChain(result: Row) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    lt: (...args: unknown[]) => {
      ltCalls.push(args);
      return chain;
    },
    in: () => chain,
    neq: () => chain,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (onFulfilled: any, onRejected: any) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return chain;
}

function makeTable(table: string, selectValue: TableValue) {
  return {
    select: () => {
      if (typeof selectValue === "function") return selectValue();
      return makeChain(selectValue);
    },
    delete: vi.fn(() => {
      deleteMock(table);
      return makeChain({ error: null });
    }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockResolvedValue({ error: null }),
  };
}

const mockClient = {
  auth: {
    getUser: vi.fn(),
    admin: { deleteUser: deleteUserMock },
  },
  from: vi.fn(),
  storage: { from: vi.fn(() => ({ remove: removeMock })) },
};

function setupTables(tables: Record<string, TableValue>) {
  mockClient.from.mockImplementation((table: string) =>
    makeTable(table, tables[table] ?? { data: [], error: null })
  );
}

const adminRow = {
  data: { id: "admin-1", user_id: "admin-user-1", email: ADMIN_EMAIL, nome: "Admin" },
  error: null,
};

function setupValidAdmin(tables: Record<string, TableValue> = {}) {
  mockClient.auth.getUser.mockResolvedValue({
    data: { user: { id: "admin-user-1", email: ADMIN_EMAIL } },
    error: null,
  });
  setupTables({ administradores: adminRow, ...tables });
}

function setupRegularUser() {
  mockClient.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-123", email: USER_EMAIL } },
    error: null,
  });
  setupTables({ administradores: { data: null, error: null } });
}

function setupInvalidToken() {
  mockClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: "Invalid token" },
  });
}

async function loadHandler() {
  vi.resetModules();
  vi.stubEnv("SUPABASE_URL", TEST_URL);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", TEST_KEY);

  (createClient as Mock).mockReturnValue(mockClient);

  await import("./index.ts");
  return getServeHandler();
}

function createMockRequest(
  body: Record<string, unknown> | null,
  opts: { method?: string; auth?: string } = {}
): Request {
  const headers: Record<string, string> = {};
  if (body) headers["content-type"] = "application/json";
  if (opts.auth) headers["authorization"] = opts.auth;
  return new Request("http://localhost/functions/cleanup-demo-accounts", {
    method: opts.method ?? "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const DEMO_TABLES: Record<string, TableValue> = {
  consultores: {
    data: [{ id: "demo-1", user_id: "demo-user-1", demo_criado_em: "2026-01-01T00:00:00.000Z" }],
    error: null,
  },
  fazendas_consultor: { data: [{ id: "fazenda-1" }], error: null },
  visitas_tecnicas: {
    data: [
      {
        id: "visita-1",
        pdf_url: "https://projeto.supabase.co/storage/v1/object/public/relatorios/visita-1.pdf",
      },
    ],
    error: null,
  },
  visita_pastos: { data: [{ id: "pasto-1" }], error: null },
  visita_fotos: {
    data: [
      {
        url: "https://projeto.supabase.co/storage/v1/object/public/visitas-consultor-fotos/pasto-1.jpg",
      },
    ],
    error: null,
  },
};

describe("cleanup-demo-accounts edge function", () => {
  let handler: (req: Request) => Promise<Response> | Response;
  let logLines: string[] = [];
  let warnLines: string[] = [];
  let errorLines: string[] = [];
  let consoleSpies: Array<{ mockRestore: () => void }> = [];

  const allLogs = () => [...logLines, ...warnLines, ...errorLines].join("\n");

  beforeEach(async () => {
    vi.clearAllMocks();
    ltCalls.length = 0;
    deleteMock.mockClear();
    logLines = [];
    warnLines = [];
    errorLines = [];
    deleteUserMock.mockResolvedValue({ error: null });
    removeMock.mockResolvedValue({ data: null, error: null });

    const collect = (arr: string[]) => (...args: unknown[]) => {
      arr.push(args.map(String).join(" "));
    };
    consoleSpies = [
      vi.spyOn(console, "log").mockImplementation(collect(logLines)),
      vi.spyOn(console, "warn").mockImplementation(collect(warnLines)),
      vi.spyOn(console, "error").mockImplementation(collect(errorLines)),
    ];

    handler = await loadHandler();
  });

  afterEach(() => {
    consoleSpies.forEach((spy) => spy.mockRestore());
    vi.unstubAllEnvs();
  });

  it("OPTIONS responde ok sem autenticar", async () => {
    const res = await handler(createMockRequest(null, { method: "OPTIONS" }));
    expect(res.status).toBe(200);
    expect((res as Response).body).toBe("ok");
    expect(mockClient.auth.getUser).not.toHaveBeenCalled();
  });

  it("retorna 405 para método GET mesmo sem token", async () => {
    const res = await handler(createMockRequest(null, { method: "GET" }));
    expect(res.status).toBe(405);
    expect((res as Response).headers.get("allow")).toBe("POST, OPTIONS");
    expect(mockClient.auth.getUser).not.toHaveBeenCalled();
    expect(mockClient.from).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("retorna 401 quando não há Authorization", async () => {
    const res = await handler(createMockRequest({ force: true }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Token de autorização ausente" });
    expect(mockClient.auth.getUser).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("retorna 401 para credencial inválida", async () => {
    setupInvalidToken();
    const res = await handler(
      createMockRequest({ force: true }, { auth: `Bearer ${ADMIN_TOKEN}` })
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Token inválido ou expirado" });
    expect(deleteMock).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("retorna 403 para autenticado que não é admin", async () => {
    setupRegularUser();
    const res = await handler(
      createMockRequest({ force: true }, { auth: `Bearer ${ADMIN_TOKEN}` })
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("permissão de administrador");
    expect(deleteMock).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
    expect(ltCalls).toHaveLength(0);
  });

  it("ignora identidade forjada no body sem token e não executa nenhuma operação destrutiva", async () => {
    const res = await handler(
      createMockRequest({
        role: "service",
        user_id: "usuario-forjado",
        admin: true,
        requested_by: "forjado",
        force: true,
      })
    );
    expect(res.status).toBe(401);
    expect(mockClient.auth.getUser).not.toHaveBeenCalled();
    expect(mockClient.from).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("force:true sem token não contorna a autorização", async () => {
    const res = await handler(createMockRequest({ force: true }));
    expect(res.status).toBe(401);
    expect(mockClient.from).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(ltCalls).toHaveLength(0);
  });

  it("force:true como usuário comum não contorna a autorização", async () => {
    setupRegularUser();
    const res = await handler(
      createMockRequest({ force: true, role: "service" }, { auth: `Bearer ${ADMIN_TOKEN}` })
    );
    expect(res.status).toBe(403);
    expect(deleteMock).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
    expect(ltCalls).toHaveLength(0);
  });

  it("admin autorizado sem demos retorna 200 com removidos 0 e aplica o corte de 24h", async () => {
    setupValidAdmin();
    const res = await handler(createMockRequest({}, { auth: `Bearer ${ADMIN_TOKEN}` }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, removidos: 0 });
    expect(ltCalls).toHaveLength(1);
    expect(ltCalls[0][0]).toBe("demo_criado_em");
    expect(deleteMock).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();

    const logged = logLines.join("\n");
    expect(logged).toContain("admin=admin-1");
    expect(logged).toContain("force=false");
    expect(logged).toContain("removidos=0");
  });

  it("admin autorizado remove demo com cascata 100% simulada e force pula o corte", async () => {
    setupValidAdmin(DEMO_TABLES);

    const res = await handler(
      createMockRequest(
        { force: true, role: "service", user_id: "usuario-forjado" },
        { auth: `Bearer ${ADMIN_TOKEN}` }
      )
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, removidos: 1 });

    expect(ltCalls).toHaveLength(0);
    expect(deleteUserMock).toHaveBeenCalledWith("demo-user-1");
    expect(deleteMock).toHaveBeenCalledWith("consultores");
    expect(deleteMock).toHaveBeenCalledWith("visitas_tecnicas");
    expect(deleteMock).toHaveBeenCalledWith("despesas_combustivel");
    expect(deleteMock).toHaveBeenCalledWith("fazendas_consultor");
    expect(removeMock).toHaveBeenCalledWith(["pasto-1.jpg"]);
    expect(removeMock).toHaveBeenCalledWith(["visita-1.pdf"]);

    const logged = logLines.join("\n");
    expect(logged).toContain("admin=admin-1");
    expect(logged).toContain("force=true");
    expect(logged).toContain("removidos=1");
    expect(logged).toContain("campos de identidade ignorados no body");
    expect(logged).not.toContain("usuario-forjado");
  });

  it("cria o client somente com a env de teste", async () => {
    setupValidAdmin(DEMO_TABLES);
    await handler(createMockRequest({ force: true }, { auth: `Bearer ${ADMIN_TOKEN}` }));

    const calls = (createClient as Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [url, key] of calls) {
      expect(url).toBe(TEST_URL);
      expect(key).toBe(TEST_KEY);
    }
    // nenhuma chave real de service role (JWT) chega ao client
    expect(JSON.stringify(calls)).not.toContain("eyJ");
  });

  it("auditoria não registra email, token nem service key", async () => {
    setupRegularUser();
    const denied = await handler(
      createMockRequest({ force: true }, { auth: `Bearer ${ADMIN_TOKEN}` })
    );
    expect(denied.status).toBe(403);

    setupValidAdmin({
      consultores: {
        data: [
          { id: "demo-1", user_id: "demo-user-1", demo_criado_em: "2026-01-01T00:00:00.000Z" },
        ],
        error: null,
      },
    });
    const allowed = await handler(
      createMockRequest({ force: true }, { auth: `Bearer ${ADMIN_TOKEN}` })
    );
    expect(allowed.status).toBe(200);

    const logged = allLogs();
    expect(logged).toContain("acesso negado");
    expect(logged).toContain("removidos=1");
    expect(logged).not.toContain(USER_EMAIL);
    expect(logged).not.toContain(ADMIN_EMAIL);
    expect(logged).not.toContain(ADMIN_TOKEN);
    expect(logged).not.toContain("Bearer");
    expect(logged).not.toContain(TEST_KEY);
    expect(logged).not.toContain("eyJ");
  });

  it("retorna 500 genérico e redige a service key em mensagens de erro", async () => {
    setupValidAdmin({
      consultores: () => {
        throw new Error(`falha interna ${TEST_KEY}`);
      },
    });

    const res = await handler(createMockRequest({}, { auth: `Bearer ${ADMIN_TOKEN}` }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Erro interno do servidor");
    expect(JSON.stringify(data)).not.toContain(TEST_KEY);

    const errors = errorLines.join("\n");
    expect(errors).toContain("[REDACTED]");
    expect(errors).not.toContain(TEST_KEY);
  });
});
