import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GerenteGmdPage from "@/pages/GerenteGmdPage";

const db = vi.hoisted(() => ({
  failConfigRead: false,
  denyFarmUpdate: false,
  updateFarm: vi.fn(),
}));

const notifications = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: notifications }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ roleData: { roleId: "manager-a", fazendaId: "farm-a", role: "gerente" } }),
}));
vi.mock("@/components/gerente/GerenteFazendaSelect", () => ({
  useGerenteFazendaAtiva: () => ({
    fazendas: [{ id: "farm-a", nome: "Fazenda A" }],
    fazendaId: "farm-a",
    setFazendaId: vi.fn(),
    carregado: true,
  }),
  GerenteFazendaSelect: () => null,
}));
vi.mock("@/components/gerente/CircularMonthSelect", () => ({ CircularMonthSelect: () => null }));

vi.mock("@/integrations/supabase/client", () => {
  const configRow = {
    id: "config-a",
    fazenda_id: "farm-a",
    retiro_id: null,
    categoria: null,
    gmd_kg: null,
    gmd_verao_kg: 0.5,
    gmd_inverno_kg: 0.2,
  };
  class Query {
    private operation: "select" | "update" = "select";
    constructor(private readonly table: string) {}
    select(_columns: string) { return this; }
    eq(_column: string, _value: unknown) { return this; }
    order(_column: string) { return this; }
    update(payload: unknown) {
      this.operation = "update";
      if (this.table === "fazendas") db.updateFarm(payload);
      return this;
    }
    maybeSingle() {
      return Promise.resolve({
        data: this.table === "fazendas"
          ? { id: "farm-a", gmd_modo: "geral", verao_mes_inicio: 2, verao_mes_fim: 8 }
          : null,
        error: null,
      });
    }
    private result() {
      if (this.operation === "update" && this.table === "fazendas") {
        return { data: db.denyFarmUpdate ? [] : [{ id: "farm-a" }], error: null };
      }
      if (this.table === "gmd_config") {
        return db.failConfigRead
          ? { data: null, error: { code: "42501", message: "PRIVATE_SQL_DETAIL" } }
          : { data: [configRow], error: null };
      }
      return { data: [], error: null };
    }
    then(onSuccess: (value: ReturnType<Query["result"]>) => unknown, onError?: (error: unknown) => unknown) {
      return Promise.resolve(this.result()).then(onSuccess, onError);
    }
  }
  return { supabase: { from: (table: string) => new Query(table) } };
});

function renderPage() {
  return render(<MemoryRouter><GerenteGmdPage /></MemoryRouter>);
}

beforeEach(() => {
  db.failConfigRead = false;
  db.denyFarmUpdate = false;
  db.updateFarm.mockClear();
  notifications.error.mockClear();
  notifications.success.mockClear();
});

describe("GerenteGmdPage: falha fechada e confirmação de gravação", () => {
  it("bloqueia edição quando a leitura de gmd_config é negada pela RLS", async () => {
    db.failConfigRead = true;
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Nenhuma alteração pode ser feita");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(db.updateFarm).not.toHaveBeenCalled();
    expect(screen.queryByText("PRIVATE_SQL_DETAIL")).not.toBeInTheDocument();
  });

  it("somente libera edição após repetir uma leitura válida", async () => {
    db.failConfigRead = true;
    renderPage();
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    db.failConfigRead = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(db.updateFarm).not.toHaveBeenCalled();
  });

  it("não exibe sucesso quando UPDATE não altera nenhuma linha", async () => {
    db.denyFarmUpdate = true;
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(db.updateFarm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(notifications.error).toHaveBeenCalledWith(
      expect.stringContaining("Gravação não confirmada"),
    ));
    expect(notifications.success).not.toHaveBeenCalled();
  });
});
