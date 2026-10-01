import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { getServeHandler } from "../test/setup.ts";

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANON_KEY = "test-anon-key";
const getUserMock = vi.fn();
const callerClient = { auth: { getUser: getUserMock } };

let lovableKey: string | undefined;

function createRequest(method: string, body?: unknown, authHeader?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authHeader !== undefined) headers["authorization"] = authHeader;
  return new Request("http://localhost/functions/analisar-retiro", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const BEARER = "Bearer valid-jwt";
const VALID_BODY = { observacoes: "Pasto do fundo com cocho vazio há 3 dias.", retiroNome: "Retiro Sede" };

function sseResponse(text: string, status = 200) {
  const sse = `data: {"type":"response.output_text.delta","delta":${JSON.stringify(text)}}\n\ndata: [DONE]\n`;
  // Não usar `new Response`: o setup de teste substitui o Response global
  // por um mock sem stream. O handler só usa ok/status/body/text.
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(sse));
      c.close();
    },
  });
  return { ok: status >= 200 && status < 300, status, body: stream, text: async () => "" };
}

describe("analisar-retiro edge function (PRD-SEC-04)", () => {
  let handler: (req: Request) => Promise<Response>;
  let fetchMock: Mock;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    lovableKey = "test-lovable-key";
    (globalThis as any).Deno.env.get = vi.fn((key: string) => {
      if (key === "SUPABASE_URL") return "http://localhost:54321";
      if (key === "SUPABASE_ANON_KEY") return ANON_KEY;
      if (key === "LOVABLE_API_KEY") return lovableKey;
      return undefined;
    });
    (createClient as Mock).mockReturnValue(callerClient);
    getUserMock.mockResolvedValue({ data: { user: { id: "gestor-1" } }, error: null });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await import("./index.ts");
    handler = getServeHandler();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("responde preflight OPTIONS sem exigir auth", async () => {
    const res = await handler(createRequest("OPTIONS"));
    expect(res.status).toBe(200);
  });

  it("rejeita método indevido com 405 (GET)", async () => {
    const res = await handler(createRequest("GET", undefined, BEARER));
    expect(res.status).toBe(405);
  });

  it("anônimo → 401 sem consumir cota de IA", async () => {
    const res = await handler(createRequest("POST", VALID_BODY));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("token inválido → 401 sem consumir cota de IA", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    const res = await handler(createRequest("POST", VALID_BODY, BEARER));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sem LOVABLE_API_KEY → 500 genérico", async () => {
    lovableKey = undefined;
    const res = await handler(createRequest("POST", VALID_BODY, BEARER));
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("observações curtas → 400", async () => {
    const res = await handler(createRequest("POST", { observacoes: "ok" }, BEARER));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("contexto oversized → 400 (contenção de custo)", async () => {
    const big = { blob: "x".repeat(9000) };
    const res = await handler(createRequest("POST", { ...VALID_BODY, contexto: big }, BEARER));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fluxo legítimo → 200 com análise e chave no header", async () => {
    fetchMock.mockResolvedValue(sseResponse("Resumo ok"));
    const res = await handler(createRequest("POST", VALID_BODY, BEARER));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ analise: "Resumo ok" });
    const [_url, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)["Lovable-API-Key"]).toBe("test-lovable-key");
  });

  it("gateway 429 → 429 com mensagem amigável", async () => {
    fetchMock.mockResolvedValue(new Response("rate limited", { status: 429 }));
    const res = await handler(createRequest("POST", VALID_BODY, BEARER));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: "Muitas solicitações no momento. Tente novamente em instantes.",
    });
  });

  it("gateway 402 → 402 com mensagem amigável", async () => {
    fetchMock.mockResolvedValue(new Response("no credits", { status: 402 }));
    const res = await handler(createRequest("POST", VALID_BODY, BEARER));
    expect(res.status).toBe(402);
  });

  it("gateway 500 → 502 genérico sem repassar status nem detalhe", async () => {
    fetchMock.mockResolvedValue(new Response("internal gateway marker-SECRET", { status: 500 }));
    const res = await handler(createRequest("POST", VALID_BODY, BEARER));
    expect(res.status).toBe(502);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain("marker-SECRET");
  });
});
