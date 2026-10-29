import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({ load: vi.fn(), toast: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          abortSignal: (_signal: AbortSignal) => api.load(),
        }),
      }),
    }),
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ roleData: { roleId: "admin-fixture" } }) }));
vi.mock("sonner", () => ({ toast: { error: api.toast, success: vi.fn() } }));
import FazendasPage from "@/pages/FazendasPage";

const mount = () => render(<MemoryRouter><FazendasPage /></MemoryRouter>);
beforeEach(() => vi.clearAllMocks());

describe("farm loading failure recovery", () => {
  it("ends loading and shows an accessible denial without exposing rejected data", async () => {
    api.load.mockResolvedValue({ data: [{ id: "other", nome: "PRIVATE-TENANT" }], error: { code: "42501" }, status: 403 });
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Acesso não autorizado/);
    expect(screen.queryByText("PRIVATE-TENANT")).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhuma fazenda cadastrada.")).not.toBeInTheDocument();
  });

  it("retries a failed request and displays authorized data", async () => {
    api.load.mockResolvedValueOnce({ data: null, error: { code: "UNAVAILABLE" }, status: 503 })
      .mockResolvedValueOnce({
        data: [{ id: "farm-1", nome: "Fazenda de teste", cidade: "Palmas", estado: "TO", ativo: true }],
        error: null, status: 200,
      });
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Erro ao carregar fazendas/);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("link", { name: "Fazenda de teste" })).toBeVisible();
    expect(api.load).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
