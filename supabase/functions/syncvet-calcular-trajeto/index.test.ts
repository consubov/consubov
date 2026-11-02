import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServeHandler } from "../test/setup.ts";

const auth = vi.hoisted(() => ({
  getClaims: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("npm:@supabase/supabase-js@2", () => ({
  createClient: auth.createClient,
}));

vi.mock("npm:@supabase/supabase-js@2/cors", () => ({
  corsHeaders: { "Access-Control-Allow-Origin": "*" },
}));

vi.mock("../_shared/apiKeys.ts", () => ({
  getSupabasePublishableKey: () => "qa-only-publishable",
}));

vi.mock("npm:zod@3", () => ({
  z: {
    number: () => ({ min: () => ({ max: () => ({}) }) }),
    object: () => ({
      safeParse: () => ({
        success: false,
        error: { flatten: () => ({ fieldErrors: { qa: ["invalid fixture"] } }) },
      }),
    }),
  },
}));

async function loadHandler() {
  vi.resetModules();
  auth.createClient.mockReturnValue({ auth: { getClaims: auth.getClaims } });
  await import("./index.ts");
  const handler = getServeHandler();
  if (!handler) throw new Error("SyncVet Deno.serve handler not registered");
  return handler;
}

function request(method: string, token?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== undefined) headers.Authorization = "Bearer " + token;
  return new Request("http://localhost/functions/v1/syncvet-calcular-trajeto", {
    method,
    headers,
    ...(method === "POST" ? { body: "{}" } : {}),
  });
}

describe("SyncVet Edge HTTP authentication fail-closed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).Deno.env.get = vi.fn((name: string) => {
      if (name === "SUPABASE_URL") return "http://localhost:54321";
      if (name === "SUPABASE_ANON_KEY") return "qa-only-anon";
      return undefined;
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("rejects a malformed Bearer with 401 when getClaims throws", async () => {
    auth.getClaims.mockRejectedValue(new Error("malformed JWT"));
    const handler = await loadHandler();
    const response = await handler(request("POST", "staged.invalid.jwt"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(auth.getClaims).toHaveBeenCalledOnce();
  });

  it("rejects an invalid signature response with 401", async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: null }, error: new Error("invalid signature") });
    const handler = await loadHandler();
    const response = await handler(request("POST", "invalid-signature"));
    expect(response.status).toBe(401);
  });

  it("rejects missing Bearer and unsupported methods before token verification", async () => {
    const handler = await loadHandler();
    expect((await handler(request("POST"))).status).toBe(401);
    expect((await handler(request("GET"))).status).toBe(405);
    expect(auth.getClaims).not.toHaveBeenCalled();
  });
});
