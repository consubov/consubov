import { beforeEach, describe, expect, it, vi } from "vitest";
import { administradorAtivoParaReabertura } from "@/lib/ciclosAuthorization";

const { from, select, eq, maybeSingle } = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from },
}));

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ select });
  select.mockReturnValue({ eq });
  eq.mockReturnValue({ eq, maybeSingle });
});

describe("reabertura de ciclos — preflight de administrador ativo", () => {
  it("permite administrador ativo e consulta apenas o usuario atual", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "admin-id" }, error: null });

    expect(await administradorAtivoParaReabertura("user-1")).toBe(true);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("administradores");
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith("id");
    expect(eq).toHaveBeenNthCalledWith(1, "user_id", "user-1");
    expect(eq).toHaveBeenNthCalledWith(2, "ativo", true);
  });

  it("nega quando o administrador foi desativado ou removido", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await administradorAtivoParaReabertura("user-1")).toBe(false);
  });

  it("nega em erro de permissao ou rede", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect(await administradorAtivoParaReabertura("user-1")).toBe(false);
    maybeSingle.mockRejectedValue(new Error("network"));
    expect(await administradorAtivoParaReabertura("user-1")).toBe(false);
  });

  it("nega sem identificador de usuario e nao consulta o banco", async () => {
    expect(await administradorAtivoParaReabertura("")).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
});
