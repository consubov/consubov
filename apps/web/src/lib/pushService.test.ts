import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

import { sendPush } from "./pushService";

const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

describe("sendPush", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("sem sessão: retorna sem chamar fetch e registra warn", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    await sendPush("Título", "Corpo", "/rota", { fazendaId: "faz-1" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  test("sessão sem access_token: retorna sem chamar fetch", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });

    await sendPush("Título", "Corpo", "/rota", { adminsOnly: true });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  test("com sessão: chama fetch uma vez com Bearer do access_token e o payload", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "user-access-token" } },
    });

    await sendPush("Título", "Corpo", "/lotes/1", {
      fazendaId: "faz-1",
      fabricaId: "fab-1",
      adminsOnly: true,
      userIds: ["u2", "u3"],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toBe(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push-notification`,
    );
    expect(init.method).toBe("POST");

    const headers: Record<string, string> = init.headers ?? {};
    const authorization = headers.Authorization ?? headers.authorization;
    expect(authorization).toBe("Bearer user-access-token");
    expect(authorization).not.toBe(
      `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    );

    const payload = JSON.parse(init.body);
    expect(payload).toMatchObject({
      title: "Título",
      body: "Corpo",
      url: "/lotes/1",
      fazenda_id: "faz-1",
      fabrica_id: "fab-1",
      admins_only: true,
      user_ids: ["u2", "u3"],
    });
  });
});
