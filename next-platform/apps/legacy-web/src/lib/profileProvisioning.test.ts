import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileProvisioningError, provisionProfileUser } from "./profileProvisioning";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

const base = { email: "Example@EXAMPLE.test ", senha: "unique-credential-123", role: "usuario" as const };

describe("unified profile provisioning", () => {
  beforeEach(() => invoke.mockReset());

  it("normalizes email and explicitly asks for the non-admin role", async () => {
    invoke.mockResolvedValue({ data: { success: true, user: { id: "auth-123" } }, error: null });
    expect(await provisionProfileUser(base)).toBe("auth-123");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("create-user", {
      body: { email: "example@example.test", senha: base.senha, role: "usuario" },
    });
  });

  it("allows only explicit administrator role with name", async () => {
    invoke.mockResolvedValue({ data: { success: true, user: { id: "admin-123" } }, error: null });
    expect(await provisionProfileUser({ ...base, role: "administrador", nome: "Admin Test" })).toBe("admin-123");
    expect(invoke.mock.calls[0][1].body.role).toBe("administrador");
  });

  it("rejects weak passwords locally without calling Auth", async () => {
    await expect(provisionProfileUser({ ...base, senha: "123456" }))
      .rejects.toBeInstanceOf(ProfileProvisioningError);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects invalid emails locally without calling Auth", async () => {
    await expect(provisionProfileUser({ ...base, email: "not-an-email" }))
      .rejects.toBeInstanceOf(ProfileProvisioningError);
    expect(invoke).not.toHaveBeenCalled();
  });

  it.each([
    [null], [{}], [{ success: false }], [{ success: true }], [{ success: true, user: { id: "" } }],
    [{ success: true, user: { id: 77 } }],
  ])("never accepts unconfirmed or missing identity: %j", async (data) => {
    invoke.mockResolvedValue({ data, error: null });
    await expect(provisionProfileUser(base)).rejects.toMatchObject({ name: "ProfileProvisioningError" });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("translates Edge HTTP duplicate response and never retries", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(JSON.stringify({ error: "Este e-mail já está cadastrado" }), {
          status: 400, headers: { "content-type": "application/json" },
        }),
      },
    });
    await expect(provisionProfileUser(base)).rejects.toThrow("e-mail exclusivo");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("does not automatically retry an unexpected network failure", async () => {
    invoke.mockImplementationOnce(async () => { throw new TypeError("failed to fetch"); });
    await expect(provisionProfileUser(base)).rejects.toThrow("não foi confirmado");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("never includes provider secrets from a failed HTTP response", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ error: "private-token-invalid" }), { status: 500 }) },
    });
    await expect(provisionProfileUser(base)).rejects.not.toThrow("private-token-invalid");
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
