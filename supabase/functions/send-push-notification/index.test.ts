import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { getServeHandler } from "../test/setup.ts";

const hoisted = vi.hoisted(() => {
  const state: { sendImpl: ((...args: unknown[]) => Promise<unknown>) | null } = {
    sendImpl: null,
  };
  return {
    state,
    createClient: vi.fn(),
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn((...args: unknown[]) =>
      state.sendImpl ? state.sendImpl(...args) : Promise.resolve(undefined),
    ),
  };
});

vi.mock("npm:web-push@3.6.7", () => ({
  default: {
    setVapidDetails: hoisted.setVapidDetails,
    sendNotification: hoisted.sendNotification,
  },
}));

vi.mock("npm:@supabase/supabase-js@2.45.0", () => ({
  createClient: hoisted.createClient,
}));

type Resp = { data: any; error?: any };

const queues: Record<string, Resp[]> = {};
const deleteCalls: { table: string; args: unknown[] }[] = [];

function push(table: string, ...resps: Resp[]) {
  if (!queues[table]) queues[table] = [];
  for (const r of resps) queues[table].push({ data: r.data, error: r.error ?? null });
}

function fill(table: string, n: number, resp: Resp) {
  for (let i = 0; i < n; i++) push(table, resp);
}

function clearQueues() {
  for (const k of Object.keys(queues)) delete queues[k];
}

function makeChain(table: string) {
  const resp: Resp = queues[table]?.shift() ?? { data: [], error: null };
  const chain: any = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.neq = () => chain;
  chain.in = () => chain;
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.maybeSingle = () => Promise.resolve(resp);
  chain.single = () => Promise.resolve(resp);
  chain.insert = () => chain;
  chain.update = () => chain;
  chain.delete = () => {
    const del: any = {
      eq: (...args: unknown[]) => {
        deleteCalls.push({ table, args });
        return del;
      },
      in: (...args: unknown[]) => {
        deleteCalls.push({ table, args });
        return del;
      },
      then: (onF: any, onR: any) => Promise.resolve({ error: null }).then(onF, onR),
      maybeSingle: () => Promise.resolve({ error: null }),
    };
    return del;
  };
  chain.then = (onF: any, onR: any) => Promise.resolve(resp).then(onF, onR);
  return chain;
}

const mockClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn((table: string) => makeChain(table)),
};

async function loadHandler() {
  vi.resetModules();
  (hoisted.createClient as Mock).mockReturnValue(mockClient);
  await import("./index.ts");
  return getServeHandler()!;
}

function setupAuth(user: { id: string } | null, error: any = null) {
  mockClient.auth.getUser.mockResolvedValue({ data: { user }, error });
}

function createRequest(
  body: unknown,
  opts: { auth?: string; method?: string; requestId?: string; rawBody?: string } = {},
): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.auth !== undefined) headers["authorization"] = opts.auth;
  if (opts.requestId) headers["x-request-id"] = opts.requestId;
  return new Request("http://localhost/functions/send-push-notification", {
    method: opts.method ?? "POST",
    headers,
    body: opts.rawBody !== undefined ? opts.rawBody : JSON.stringify(body ?? {}),
  });
}

const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const AUDIT_PREFIX = "[push:audit] ";

function parseAudit(spy: Mock): any[] {
  return spy.mock.calls
    .map((c) => String(c[0] ?? ""))
    .filter((s) => s.startsWith(AUDIT_PREFIX))
    .map((s) => JSON.parse(s.slice(AUDIT_PREFIX.length)));
}

function lastAudit(spy: Mock) {
  const events = parseAudit(spy);
  return events[events.length - 1];
}

const MACHINE_TOKEN = "test-service-role-key";
const HUMAN_TOKEN = "eyJhbGciOiJIUzI1NiJ9.human-token";
const ADMIN_ID = "admin-user-1";
const GERENTE_ID = "gerente-user-1";
const CAPATAZ_ID = "capataz-user-1";
const OPERADOR_ID = "operador-user-1";
const MEMBER_ID = "member-user-1";

function subRow(id: string) {
  return {
    id,
    enabled: true,
    subscription: {
      endpoint: `https://push.example/${id}`,
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    },
  };
}

// admins_only flow: authz administradores → global toggle → resolve administradores → subscriptions
function queueAdminLegit(subIds: string[] = ["sub-1"]) {
  push("administradores", { data: [{ id: "adm-row-1", user_id: ADMIN_ID }] });
  push("configuracoes_gerais", { data: null });
  push("administradores", { data: [{ user_id: ADMIN_ID }] });
  push("push_subscriptions", { data: subIds.map(subRow) });
}

// machine fazenda flow: entries duplicated per table so both "authz runs" and
// "authz skipped for machine" call orders resolve to the same recipients
function queueMachineFazenda(subIds: string[] = ["sub-1"]) {
  push("administradores", { data: [{ id: "adm-row-1", user_id: ADMIN_ID }] });
  push("configuracoes_gerais", { data: null });
  push("gerentes", { data: [{ user_id: GERENTE_ID, fazenda_id: "faz-1" }] }, { data: [{ user_id: GERENTE_ID, fazenda_id: "faz-1" }] });
  push("gerentes_fazendas", { data: [{ fazenda_id: "faz-1" }] });
  push("capatazes", { data: [{ id: "cap-1", user_id: CAPATAZ_ID, retiro_id: "ret-1" }] }, { data: [{ id: "cap-1", user_id: CAPATAZ_ID, retiro_id: "ret-1" }] });
  push("capatazes_retiros", { data: [{ capataz_id: "cap-1", retiro_id: "ret-1" }] }, { data: [] });
  push("retiros", { data: [{ id: "ret-1", fazenda_id: "faz-1" }] }, { data: [{ id: "ret-1", fazenda_id: "faz-1" }] });
  push("push_subscriptions", { data: subIds.map(subRow) });
}

describe("send-push-notification edge function", () => {
  let handler: (req: Request) => Promise<Response> | Response;

  beforeEach(async () => {
    vi.clearAllMocks();
    clearQueues();
    deleteCalls.length = 0;
    hoisted.state.sendImpl = null;
    handler = await loadHandler();
  });

  describe("modern machine apikey (opt-in only)", () => {
    const modernKey = "sb_secret_synthetic_machine_key";

    const request = (apikey: string) => new Request(
      "http://localhost/functions/send-push-notification",
      {
        method: "POST",
        headers: { "content-type": "application/json", apikey },
        body: JSON.stringify({ user_ids: [MEMBER_ID] }),
      },
    );

    it("does not enable machine access just because a modern API key exists", async () => {
      const response = await handler(request(modernKey));
      expect(response.status).toBe(401);
      expect(hoisted.sendNotification).not.toHaveBeenCalled();
    });

    it("denies wrong apikey with opt-in enabled", async () => {
      const original = (globalThis as any).Deno.env.get;
      (globalThis as any).Deno.env.get = (name: string) =>
        name === "CONSUBOV_PUSH_MODERN_MACHINE_KEY_ENABLED" ? "true" :
        name === "SUPABASE_SECRET_KEYS" ? JSON.stringify({ default: "sb_secret_generic_admin_synthetic", push: modernKey }) :
        original(name);
      try {
        const response = await handler(request("sb_secret_incorrect"));
        expect(response.status).toBe(401);
        expect(hoisted.sendNotification).not.toHaveBeenCalled();
      } finally {
        (globalThis as any).Deno.env.get = original;
      }
    });

    it("never accepts the shared default admin secret as a push credential", async () => {
      const original = (globalThis as any).Deno.env.get;
      const adminKey = "sb_secret_generic_admin_synthetic";
      (globalThis as any).Deno.env.get = (name: string) =>
        name === "CONSUBOV_PUSH_MODERN_MACHINE_KEY_ENABLED" ? "true" :
        name === "SUPABASE_SECRET_KEYS" ? JSON.stringify({ default: adminKey, push: modernKey }) :
        original(name);
      try {
        const response = await handler(request(adminKey));
        expect(response.status).toBe(401);
        expect(hoisted.sendNotification).not.toHaveBeenCalled();
        expect(mockClient.auth.getUser).not.toHaveBeenCalled();
      } finally {
        (globalThis as any).Deno.env.get = original;
      }
    });

    it("rejects a default-only key set even when the caller has that key", async () => {
      const original = (globalThis as any).Deno.env.get;
      (globalThis as any).Deno.env.get = (name: string) =>
        name === "CONSUBOV_PUSH_MODERN_MACHINE_KEY_ENABLED" ? "true" :
        name === "SUPABASE_SECRET_KEYS" ? JSON.stringify({ default: modernKey }) :
        original(name);
      try {
        const response = await handler(request(modernKey));
        expect(response.status).toBe(401);
        expect(hoisted.sendNotification).not.toHaveBeenCalled();
      } finally {
        (globalThis as any).Deno.env.get = original;
      }
    });

    it("authenticates a matching machine apikey, preserving forbidden user targets", async () => {
      const original = (globalThis as any).Deno.env.get;
      (globalThis as any).Deno.env.get = (name: string) =>
        name === "CONSUBOV_PUSH_MODERN_MACHINE_KEY_ENABLED" ? "true" :
        name === "SUPABASE_SECRET_KEYS" ? JSON.stringify({ default: "sb_secret_generic_admin_synthetic", push: modernKey }) :
        original(name);
      try {
        const response = await handler(request(modernKey));
        expect(response.status).toBe(403); // Machine cannot select arbitrary users.
        expect(mockClient.auth.getUser).not.toHaveBeenCalled();
        expect(hoisted.sendNotification).not.toHaveBeenCalled();
        expect(lastAudit(warnSpy)).toMatchObject({
          event: "push.request.denied",
          caller: "machine",
          reason: "selecao_proibida",
        });
      } finally {
        (globalThis as any).Deno.env.get = original;
      }
    });
  });

  describe("named push apikey end-to-end authorization (mocked delivery only)", () => {
    const namedPushKey = "sb_secret_synthetic_machine_key";
    const adminKey = "sb_secret_generic_admin_synthetic";

    const withNamedKey = async (run: () => Promise<void>) => {
      const original = (globalThis as any).Deno.env.get;
      (globalThis as any).Deno.env.get = (name: string) =>
        name === "CONSUBOV_PUSH_MODERN_MACHINE_KEY_ENABLED" ? "true" :
        name === "SUPABASE_SECRET_KEYS" ? JSON.stringify({ default: adminKey, push: namedPushKey }) :
        original(name);
      try {
        await run();
      } finally {
        (globalThis as any).Deno.env.get = original;
      }
    };

    const namedRequest = (body: unknown, authorization?: string) => new Request(
      "http://localhost/functions/send-push-notification",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: namedPushKey,
          ...(authorization === undefined ? {} : { authorization }),
        },
        body: JSON.stringify(body),
      },
    );

    it("allows the dedicated push key for a scoped farm notification, without JWT", async () => {
      await withNamedKey(async () => {
        queueMachineFazenda(["sub-1"]);
        const response = await handler(namedRequest({ fazenda_id: "faz-1" }));
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.total).toBe(1);
        expect(data.sent).toBe(1);
        expect(hoisted.sendNotification).toHaveBeenCalledTimes(1);
        expect(mockClient.auth.getUser).not.toHaveBeenCalled();
        expect(lastAudit(logSpy)).toMatchObject({
          event: "push.request.completed",
          caller: "machine",
          selections: ["fazenda"],
        });
      });
    });

    it("denies global broadcast despite a valid named machine apikey", async () => {
      await withNamedKey(async () => {
        const response = await handler(namedRequest({ all: true }));
        expect(response.status).toBe(403);
        expect(hoisted.sendNotification).not.toHaveBeenCalled();
        expect(lastAudit(warnSpy)).toMatchObject({
          event: "push.request.denied",
          caller: "machine",
          reason: "broadcast_proibido",
        });
      });
    });

    it("never upgrades an invalid Bearer JWT into machine access using apikey", async () => {
      await withNamedKey(async () => {
        setupAuth(null, new Error("invalid test JWT"));
        const response = await handler(
          namedRequest({ fazenda_id: "faz-1" }, "Bearer invalid-test-jwt"),
        );
        expect(response.status).toBe(401);
        expect(mockClient.auth.getUser).toHaveBeenCalledWith("invalid-test-jwt");
        expect(hoisted.sendNotification).not.toHaveBeenCalled();
      });
    });
  });

  describe("HTTP semantics", () => {
    it("OPTIONS preflight responds 200 with allow-methods and allow-origin", async () => {
      const res = await handler(createRequest({}, { method: "OPTIONS" }));
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(res.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
    });

    it("GET without auth responds 405 with allow header and no auth check", async () => {
      const res = await handler(createRequest({}, { method: "GET" }));
      expect(res.status).toBe(405);
      const data = await res.json();
      expect(data).toEqual({ error: "Método não permitido" });
      expect(res.headers.get("allow")).toBe("POST, OPTIONS");
      expect(mockClient.auth.getUser).not.toHaveBeenCalled();
    });

    it("POST without Authorization responds 401 ausente with CORS and audited reason", async () => {
      const res = await handler(
        createRequest({ fazenda_id: "faz-1" }, { requestId: "req-auth-1" }),
      );
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toEqual({ error: "Token de autorização ausente" });
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(mockClient.auth.getUser).not.toHaveBeenCalled();

      const evt = lastAudit(warnSpy);
      expect(evt).toMatchObject({
        event: "push.request.denied",
        requestId: "req-auth-1",
        caller: "unknown",
        actor: null,
        reason: "auth_ausente",
      });
    });

    it("POST with invalid Bearer token responds 401 inválido and calls getUser with the token", async () => {
      setupAuth(null, { message: "jwt expired" });
      const res = await handler(
        createRequest({ fazenda_id: "faz-1" }, { auth: "Bearer bad-token" }),
      );
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toEqual({ error: "Token inválido ou expirado" });
      expect(mockClient.auth.getUser).toHaveBeenCalledTimes(1);
      expect(mockClient.auth.getUser).toHaveBeenCalledWith("bad-token");

      const evt = lastAudit(warnSpy);
      expect(evt).toMatchObject({ event: "push.request.denied", reason: "auth_invalida" });
    });

    it("POST with non-Bearer Authorization header responds 401 inválido without getUser", async () => {
      const res = await handler(
        createRequest({ fazenda_id: "faz-1" }, { auth: "Basic xyz" }),
      );
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toEqual({ error: "Token inválido ou expirado" });
      expect(mockClient.auth.getUser).not.toHaveBeenCalled();
    });

    it("POST with getUser returning a user without id responds 401 inválido", async () => {
      setupAuth({} as { id: string }, null);
      const res = await handler(
        createRequest({ fazenda_id: "faz-1" }, { auth: "Bearer token-sem-id" }),
      );
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toEqual({ error: "Token inválido ou expirado" });
    });
  });

  describe("deny-by-default authorization", () => {
    it("authenticated user without scope + fazenda_id → 403 escopo_negado", async () => {
      setupAuth({ id: "user-without-scope" });
      const res = await handler(
        createRequest({ fazenda_id: "faz-1" }, { auth: `Bearer ${HUMAN_TOKEN}`, requestId: "req-escopo-1" }),
      );
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data).toEqual({ error: "Acesso negado" });

      const evt = lastAudit(warnSpy);
      expect(evt).toMatchObject({
        event: "push.request.denied",
        requestId: "req-escopo-1",
        caller: "human",
        actor: "user-without-scope",
        selections: ["fazenda"],
        reason: "escopo_negado",
      });
    });

    it("all:true by human (even with valid fazenda scope) → 403 broadcast_proibido", async () => {
      setupAuth({ id: GERENTE_ID });
      // valid scope would exist; broadcast is rejected before anything else can allow it
      push("gerentes", { data: [{ id: "g-1", fazenda_id: "faz-1" }] });
      push("gerentes_fazendas", { data: [{ fazenda_id: "faz-1" }] });

      const res = await handler(
        createRequest({ all: true, fazenda_id: "faz-1" }, { auth: `Bearer ${HUMAN_TOKEN}` }),
      );
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data).toEqual({ error: "Acesso negado" });

      const evt = lastAudit(warnSpy);
      expect(evt).toMatchObject({ event: "push.request.denied", reason: "broadcast_proibido" });
      // contract order: the all-check runs before selections are built, so none are reported yet
      expect(evt.selections).toEqual([]);
    });

    it("all:true by machine → 403 broadcast_proibido and getUser never called", async () => {
      const res = await handler(
        createRequest({ all: true }, { auth: `Bearer ${MACHINE_TOKEN}` }),
      );
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data).toEqual({ error: "Acesso negado" });
      expect(mockClient.auth.getUser).not.toHaveBeenCalled();

      const evt = lastAudit(warnSpy);
      expect(evt).toMatchObject({ event: "push.request.denied", reason: "broadcast_proibido", caller: "machine" });
    });

    it("admins_only by non-admin human → 403 escopo_negado", async () => {
      setupAuth({ id: "regular-user" });
      const res = await handler(
        createRequest({ admins_only: true }, { auth: `Bearer ${HUMAN_TOKEN}` }),
      );
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data).toEqual({ error: "Acesso negado" });

      const evt = lastAudit(warnSpy);
      expect(evt).toMatchObject({ event: "push.request.denied", reason: "escopo_negado", selections: ["admins"] });
    });

    it("user_ids targeting an unrelated user → 403 escopo_negado", async () => {
      setupAuth({ id: GERENTE_ID });
      // gerente scope = faz-1 only; R3 admin link exists but grants nothing here
      push("gerentes", { data: [{ id: "g-1", fazenda_id: "faz-1" }] });
      push("gerentes_fazendas", { data: [{ fazenda_id: "faz-1" }] });
      push("fazendas", { data: [{ administrador_id: "admin-9" }] });

      const res = await handler(
        createRequest({ user_ids: ["outsider-user"] }, { auth: `Bearer ${HUMAN_TOKEN}` }),
      );
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data).toEqual({ error: "Acesso negado" });

      const evt = lastAudit(warnSpy);
      expect(evt).toMatchObject({ event: "push.request.denied", reason: "escopo_negado", selections: ["users"] });
    });

    it("user_ids [validTarget, outsideTarget] → 403: multiple recipients don't widen scope", async () => {
      setupAuth({ id: GERENTE_ID });
      // R2 links gerente's faz-1 to fab-1, proving validTarget only
      push("gerentes", { data: [{ id: "g-1", fazenda_id: "faz-1" }] });
      push("gerentes_fazendas", { data: [{ fazenda_id: "faz-1" }] });
      push("fabrica_destinos", { data: [{ fabrica_id: "fab-1" }] });
      push("operadores_fabrica", { data: [{ user_id: OPERADOR_ID, fabrica_id: "fab-1" }] });

      const res = await handler(
        createRequest(
          { user_ids: [OPERADOR_ID, "outside-user"] },
          { auth: `Bearer ${HUMAN_TOKEN}` },
        ),
      );
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data).toEqual({ error: "Acesso negado" });
    });

    it("fazenda_id cross-tenant (gerente of faz-1 sends faz-2) → 403", async () => {
      setupAuth({ id: GERENTE_ID });
      push("gerentes", { data: [{ id: "g-1", fazenda_id: "faz-1" }] });
      push("gerentes_fazendas", { data: [{ fazenda_id: "faz-1" }] });

      const res = await handler(
        createRequest({ fazenda_id: "faz-2" }, { auth: `Bearer ${HUMAN_TOKEN}` }),
      );
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data).toEqual({ error: "Acesso negado" });

      const evt = lastAudit(warnSpy);
      expect(evt).toMatchObject({ reason: "escopo_negado", selections: ["fazenda"] });
    });

    it("fabrica_id cross-tenant (operador of fab-1 sends fab-2) → 403", async () => {
      setupAuth({ id: OPERADOR_ID });
      push("operadores_fabrica", { data: [{ fabrica_id: "fab-1" }] });

      const res = await handler(
        createRequest({ fabrica_id: "fab-2" }, { auth: `Bearer ${HUMAN_TOKEN}` }),
      );
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data).toEqual({ error: "Acesso negado" });

      const evt = lastAudit(warnSpy);
      expect(evt).toMatchObject({ reason: "escopo_negado", selections: ["fabrica"] });
    });

    it("machine with user_ids → 403 selecao_proibida", async () => {
      const res = await handler(
        createRequest({ user_ids: [MEMBER_ID] }, { auth: `Bearer ${MACHINE_TOKEN}` }),
      );
      expect(res.status).toBe(403);
      expect(mockClient.auth.getUser).not.toHaveBeenCalled();

      const evt = lastAudit(warnSpy);
      expect(evt).toMatchObject({
        event: "push.request.denied",
        caller: "machine",
        actor: null,
        selections: ["users"],
        reason: "selecao_proibida",
      });
    });
  });

  describe("legit flows", () => {
    it("capataz sends to own fazenda_id → 200 sent to gerente + capataz", async () => {
      setupAuth({ id: CAPATAZ_ID });
      // authz order: administradores → gerentes → capatazes → capatazes_retiros → retiros
      push("gerentes", { data: [] });
      push("capatazes", { data: [{ id: "cap-1", retiro_id: "ret-1" }] });
      push("capatazes_retiros", { data: [{ retiro_id: "ret-1" }] });
      push("retiros", { data: [{ fazenda_id: "faz-1" }] });
      push("configuracoes_gerais", { data: null });
      // resolve order: retiros → gerentes → capatazes → capatazes_retiros
      push("retiros", { data: [{ id: "ret-1" }] });
      push("gerentes", { data: [{ user_id: GERENTE_ID }] });
      push("capatazes", { data: [{ user_id: CAPATAZ_ID }] });
      push("capatazes_retiros", { data: [] });
      push("push_subscriptions", { data: [subRow("sub-1"), subRow("sub-2")] });

      const res = await handler(
        createRequest({ fazenda_id: "faz-1" }, { auth: `Bearer ${HUMAN_TOKEN}` }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(2);
      expect(data.sent).toBe(2);
      expect(data.results).toEqual([
        { id: "sub-1", ok: true },
        { id: "sub-2", ok: true },
      ]);
      expect(hoisted.sendNotification).toHaveBeenCalledTimes(2);
    });

    it("gerente sends to a managed fazenda_id → 200", async () => {
      setupAuth({ id: GERENTE_ID });
      push("gerentes", { data: [{ id: "g-1", fazenda_id: "faz-1" }] });
      push("gerentes_fazendas", { data: [{ fazenda_id: "faz-1" }] });
      push("capatazes", { data: [] });
      push("configuracoes_gerais", { data: null });
      push("retiros", { data: [{ id: "ret-1" }] });
      push("gerentes", { data: [{ user_id: GERENTE_ID }] });
      push("capatazes", { data: [{ user_id: CAPATAZ_ID }] });
      push("capatazes_retiros", { data: [] });
      push("push_subscriptions", { data: [subRow("sub-1"), subRow("sub-2")] });

      const res = await handler(
        createRequest({ fazenda_id: "faz-1" }, { auth: `Bearer ${HUMAN_TOKEN}` }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(2);
      expect(data.sent).toBe(2);
      expect(data.results).toEqual([
        { id: "sub-1", ok: true },
        { id: "sub-2", ok: true },
      ]);
    });

    it("gerente sends user_ids whose fabrica is linked to their fazenda (R2) → 200", async () => {
      setupAuth({ id: GERENTE_ID });
      // users selection query order: syncvet scope → gerentes → gerentes_fazendas →
      // capatazes → fabrica_destinos → operadores_fabrica → fazendas
      push("gerentes", { data: [{ id: "g-1", fazenda_id: "faz-1" }] });
      push("gerentes_fazendas", { data: [{ fazenda_id: "faz-1" }] });
      push("capatazes", { data: [] });
      push("fabrica_destinos", { data: [{ fabrica_id: "fab-1" }] });
      push("operadores_fabrica", { data: [{ user_id: OPERADOR_ID, fabrica_id: "fab-1" }] });
      push("configuracoes_gerais", { data: null });
      push("push_subscriptions", { data: [subRow("sub-1")] });

      const res = await handler(
        createRequest({ user_ids: [OPERADOR_ID] }, { auth: `Bearer ${HUMAN_TOKEN}` }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(1);
      expect(data.sent).toBe(1);
      expect(data.results).toEqual([{ id: "sub-1", ok: true }]);
    });

    it("syncvet admin sends user_ids of the same empresa (R1) → 200", async () => {
      setupAuth({ id: "syncvet-admin-1" });
      push("syncvet_equipe", { data: [{ empresa_id: "emp-1", perfil: "administrador" }] });
      push("syncvet_equipe", { data: [{ user_id: MEMBER_ID }] });
      push("configuracoes_gerais", { data: null });
      push("push_subscriptions", { data: [subRow("sub-1")] });

      const res = await handler(
        createRequest({ user_ids: [MEMBER_ID] }, { auth: `Bearer ${HUMAN_TOKEN}` }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(1);
      expect(data.sent).toBe(1);
      expect(data.results).toEqual([{ id: "sub-1", ok: true }]);
    });

    it("machine sends fazenda_id → 200 with getUser never called and machine audit", async () => {
      queueMachineFazenda(["sub-1", "sub-2"]);

      const res = await handler(
        createRequest({ fazenda_id: "faz-1" }, { auth: `Bearer ${MACHINE_TOKEN}` }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(2);
      expect(data.sent).toBe(2);
      expect(data.results).toEqual([
        { id: "sub-1", ok: true },
        { id: "sub-2", ok: true },
      ]);
      expect(mockClient.auth.getUser).not.toHaveBeenCalled();

      const evt = lastAudit(logSpy);
      expect(evt).toMatchObject({
        event: "push.request.completed",
        caller: "machine",
        actor: null,
        selections: ["fazenda"],
        scope: { fazendaId: "faz-1" },
        resolved: 2,
        subscriptions: 2,
        sent: 2,
        failed: 0,
      });
      expect(evt.requestId).toBeTruthy();
    });

    it("admin human sends admins_only → 200 (legit category)", async () => {
      setupAuth({ id: ADMIN_ID });
      queueAdminLegit(["sub-1"]);

      const res = await handler(
        createRequest({ admins_only: true }, { auth: `Bearer ${HUMAN_TOKEN}` }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(1);
      expect(data.sent).toBe(1);
      expect(data.results).toEqual([{ id: "sub-1", ok: true }]);
      expect(mockClient.auth.getUser).toHaveBeenCalledTimes(1);

      const evt = lastAudit(logSpy);
      expect(evt).toMatchObject({
        event: "push.request.completed",
        caller: "human",
        actor: ADMIN_ID,
        selections: ["admins"],
        resolved: 1,
        subscriptions: 1,
        sent: 1,
        failed: 0,
      });
    });
  });

  describe("provider errors and sanitization", () => {
    it("provider 404 with endpoint in message → 200, status in results, no leak, subscription deleted", async () => {
      setupAuth({ id: ADMIN_ID });
      queueAdminLegit(["sub-1"]);
      hoisted.state.sendImpl = () =>
        Promise.reject({
          statusCode: 404,
          message: "Web Push error: subscription endpoint https://push.example/abc has expired",
        });

      const res = await handler(
        createRequest({ admins_only: true }, { auth: `Bearer ${HUMAN_TOKEN}` }),
      );
      hoisted.state.sendImpl = null;

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(1);
      expect(data.sent).toBe(0);
      expect(data.results).toEqual([{ id: "sub-1", ok: false, status: 404 }]);
      expect(data.results[0]).not.toHaveProperty("message");

      const raw = JSON.stringify(data);
      expect(raw).not.toContain("https://push.example");
      expect(raw).not.toContain("Web Push error");
      expect(raw).not.toContain("expired");
      expect(raw).not.toContain("message");

      const deletes = deleteCalls.filter((d) => d.table === "push_subscriptions");
      expect(deletes).toHaveLength(1);
      expect(deletes[0].args).toEqual(["id", "sub-1"]);
    });

    it("push_subscriptions query error → 500 sanitized without leaking relation details", async () => {
      setupAuth({ id: ADMIN_ID });
      push("administradores", { data: [{ id: "adm-row-1", user_id: ADMIN_ID }] });
      push("configuracoes_gerais", { data: null });
      push("administradores", { data: [{ user_id: ADMIN_ID }] });
      push("push_subscriptions", {
        data: null,
        error: { message: 'relation "secret_table" does not exist' },
      });

      const res = await handler(
        createRequest({ admins_only: true }, { auth: `Bearer ${HUMAN_TOKEN}` }),
      );
      expect(res.status).toBe(500);
      const raw = await res.text();
      expect(raw).toBe(JSON.stringify({ error: "Erro interno ao processar notificação" }));
      expect(raw).not.toContain("secret_table");
      expect(raw).not.toContain("relation");

      const errorEvents = [...parseAudit(warnSpy), ...parseAudit(logSpy)].filter(
        (e) => e.event === "push.request.error",
      );
      expect(errorEvents.length).toBeGreaterThan(0);
      const serialized = JSON.stringify(errorEvents);
      expect(serialized).not.toContain("secret_table");
      expect(serialized).not.toContain("does not exist");
      expect(serialized).not.toContain("message");
    });
  });

  describe("rate limit", () => {
    it("human admin: 30 sends pass, 31st → 429 rate_limit", async () => {
      setupAuth({ id: ADMIN_ID });
      fill("administradores", 64, { data: [{ id: "adm-row-1", user_id: ADMIN_ID }] });
      fill("configuracoes_gerais", 35, { data: null });
      fill("push_subscriptions", 35, { data: [subRow("sub-1")] });

      for (let i = 0; i < 30; i++) {
        const res = await handler(
          createRequest({ admins_only: true }, { auth: `Bearer ${HUMAN_TOKEN}` }),
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.sent).toBe(1);
      }

      const res31 = await handler(
        createRequest({ admins_only: true }, { auth: `Bearer ${HUMAN_TOKEN}` }),
      );
      expect(res31.status).toBe(429);
      const data31 = await res31.json();
      expect(data31).toEqual({ error: "Limite de requisições excedido" });

      const evt = lastAudit(warnSpy);
      expect(evt).toMatchObject({
        event: "push.request.denied",
        caller: "human",
        actor: ADMIN_ID,
        reason: "rate_limit",
      });
    });
  });

  describe("network isolation and log leaks", () => {
    it("full success flow performs no network fetch", async () => {
      const fetchMock = vi.fn(() => Promise.reject(new Error("network disabled")));
      vi.stubGlobal("fetch", fetchMock);
      try {
        setupAuth({ id: ADMIN_ID });
        queueAdminLegit(["sub-1"]);

        const res = await handler(
          createRequest({ admins_only: true }, { auth: `Bearer ${HUMAN_TOKEN}` }),
        );
        expect(res.status).toBe(200);
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("audit logs never leak tokens, endpoints, VAPID or the service role key", async () => {
      // machine success
      queueMachineFazenda(["sub-1"]);
      const ok = await handler(
        createRequest({ fazenda_id: "faz-1" }, { auth: `Bearer ${MACHINE_TOKEN}` }),
      );
      expect(ok.status).toBe(200);

      // machine denial
      const denied = await handler(
        createRequest({ user_ids: [MEMBER_ID] }, { auth: `Bearer ${MACHINE_TOKEN}` }),
      );
      expect(denied.status).toBe(403);

      // pre-auth denial
      const noAuth = await handler(createRequest({ fazenda_id: "faz-1" }));
      expect(noAuth.status).toBe(401);

      // provider error with endpoint in message
      setupAuth({ id: ADMIN_ID });
      queueAdminLegit(["sub-9"]);
      hoisted.state.sendImpl = () =>
        Promise.reject({
          statusCode: 404,
          message: "Web Push error: subscription endpoint https://push.example/leak has expired",
        });
      const provider = await handler(
        createRequest({ admins_only: true }, { auth: `Bearer ${HUMAN_TOKEN}` }),
      );
      hoisted.state.sendImpl = null;
      expect(provider.status).toBe(200);

      const all = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls]
        .map((c) => c.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "))
        .join("\n");

      expect(all).toContain("[push:audit]");
      for (const token of [
        "test-service-role-key",
        "Bearer",
        "eyJ",
        "VAPID",
        "https://push.example",
        "push_subscriptions",
        "endpoint",
      ]) {
        expect(all).not.toContain(token);
      }
      // no serialized subscription object may be logged (the scalar `subscriptions` count is fine)
      expect(all).not.toMatch(/subscription"\s*:\s*[{[]/);
    });
  });
});
