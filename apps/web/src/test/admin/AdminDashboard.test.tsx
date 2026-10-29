import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import AdminDashboard from "@/pages/AdminDashboard";

const fixtures = vi.hoisted(() => ({ unauthorized: false, authValid: true }));
vi.mock("@/integrations/supabase/client", () => {
  const headCounts: Record<string, number> = {
    fazendas: 5, retiros: 5, pastos: 5, produtos: 5,
    ciclos: 5, lancamentos: 5, fabricas: 5,
  };
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        getUser: vi.fn(() => Promise.resolve(fixtures.authValid
          ? { data: { user: { id: "verified-admin" } }, error: null }
          : { data: { user: null }, error: { message: "invalid jwt" } })),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      },
      from: (table: string) => ({
        select: (columns: string, options: { head?: boolean } = {}) => {
          const response = table === "administradores"
            ? { data: { id: "active-admin" }, error: null, status: 200 }
            : fixtures.unauthorized && table === "fazendas"
            ? { data: null, count: null, error: { code: "42501" }, status: 403 }
            : options.head
            ? { data: null, count: headCounts[table] ?? 0, error: null, status: 200 }
            : columns === "num_animais"
            ? { data: Array.from({ length: 10 }, () => ({ num_animais: 5 })), error: null, status: 200 }
            : { data: [], error: null, status: 200 };
          const query = {
            eq: () => query,
            maybeSingle: () => query,
            abortSignal: () => query,
            then: (resolve: (value: typeof response) => unknown, reject?: (error: unknown) => unknown) =>
              Promise.resolve(response).then(resolve, reject),
          };
          return query;
        },
      }),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
    },
  };
});
vi.mock("@/components/admin/AdminListSection", () => ({ default: () => null }));

const mount = () => render(
  <AuthProvider><MemoryRouter><AdminDashboard /></MemoryRouter></AuthProvider>
);
beforeEach(() => { fixtures.unauthorized = false; fixtures.authValid = true; });

describe("AdminDashboard", () => {
  it("shows verified totals only when queries succeed", async () => {
    mount();
    expect(await screen.findByText("50")).toBeInTheDocument();
    expect(screen.getAllByText("5")).toHaveLength(7);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not show false zeros when a query is denied by RLS", async () => {
    fixtures.unauthorized = true;
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Sessão ou acesso/);
    expect(screen.queryByText("50")).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("rejects a cached admin view without a verified live session", async () => {
    fixtures.authValid = false;
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Sessão ou acesso/);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
