import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn() }));
const fixtures = vi.hoisted(() => ({
  authValid: true, adminPresent: true, rlsDenied: false, offline: false,
}));

vi.mock("@/hooks/useAuth", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({
    user: fixtures.authValid ? { id: "admin-id" } : null,
    role: "administrador", roleResolved: true, loading: false,
    roleData: { role: "administrador", roleId: "cached-id" },
  }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const counts: Record<string, number> = { fazendas: 5, retiros: 5, pastos: 5,
    produtos: 5, ciclos: 5, lancamentos: 5, fabricas: 5 };
  const from = vi.fn((table: string) => ({
    select: (cols: string, opts: { head?: boolean } = {}) => {
      const response = table === "administradores"
        ? { data: fixtures.adminPresent ? { id: "active-id" } : null, error: null, status: 200 }
        : fixtures.rlsDenied && table === "fazendas"
        ? { data: null, count: null, error: { code: "42501" }, status: 403 }
        : fixtures.offline && table === "fazendas"
        ? { data: null, count: null, error: { code: "NETWORK" }, status: 503 }
        : opts.head
        ? { data: null, count: counts[table] ?? 0, error: null, status: 200 }
        : cols === "num_animais"
        ? { data: Array.from({ length: 10 }, () => ({ num_animais: 5 })), error: null, status: 200 }
        : { data: [], error: null, status: 200 };
      const q = {
        eq: () => q, maybeSingle: () => q, abortSignal: () => q,
        then: (resolve: (value: typeof response) => unknown, reject?: (err: unknown) => unknown) =>
          Promise.resolve(response).then(resolve, reject),
      };
      return q;
    },
  }));
  api.from = from;
  api.getUser = vi.fn(async () => { throw new Error("auth offline"); });
  return { supabase: {
    auth: { getUser: api.getUser },
    from: api.from, channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  }};
});
vi.mock("@/components/admin/AdminListSection", () => ({ default: () => null }));

import AdminDashboard from "@/pages/AdminDashboard";

function renderDashboard() {
  return render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(fixtures, { authValid: true, adminPresent: true, rlsDenied: false, offline: false });
});

describe("AdminDashboard production auth regression", () => {
  it("renders verified metrics without calling the redundant auth network endpoint", async () => {
    renderDashboard();
    expect(await screen.findByText("50")).toBeInTheDocument();
    expect(screen.getAllByText("5")).toHaveLength(7);
    expect(api.getUser).not.toHaveBeenCalled();
    expect(api.from).toHaveBeenCalledWith("administradores");
  });
  it("rejects missing admin membership even when browser role is cached", async () => {
    fixtures.adminPresent = false;
    renderDashboard();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Sessão ou acesso/);
    expect(screen.queryByText("50")).not.toBeInTheDocument();
  });
  it("rejects missing session user", async () => {
    fixtures.authValid = false;
    renderDashboard();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Sessão ou acesso/);
    expect(api.from).not.toHaveBeenCalled();
  });
  it("does not render false zeros on a server-side RLS denial", async () => {
    fixtures.rlsDenied = true;
    renderDashboard();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Sessão ou acesso/);
    expect(screen.queryByText("50")).not.toBeInTheDocument();
  });
  it("offers retry when the data API is unavailable", async () => {
    fixtures.offline = true;
    renderDashboard();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível consultar o banco/);
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeEnabled();
  });
});
