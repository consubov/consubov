import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { AuthProvider, useAuth } from "./useAuth";

type ProfileReply = { data: Record<string, unknown> | null; error: unknown };
type Listener = ((event: string, session: Session | null) => void) | null;

const mocks = vi.hoisted(() => {
  return {
    listener: null as Listener,
    read: vi.fn<(table: string, userId: string) => Promise<ProfileReply>>(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (listener: Listener) => {
        mocks.listener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      getSession: async () => ({ data: { session: null } }),
      setSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async () => ({ error: null }),
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => {
      let userId = "";
      const query = {
        select: () => query,
        eq: (key: string, value: string) => {
          if (key === "user_id") userId = value;
          return query;
        },
        maybeSingle: () => mocks.read(table, userId),
      };
      return query;
    },
  },
}));

vi.mock("@/lib/demoSession", () => ({
  reconcileDemoSession: async () => undefined,
  isDemoEmail: () => false,
}));

vi.mock("@/lib/offlineSession", () => ({
  getAuthSession: async () => null,
  saveAuthSession: async () => undefined,
  clearAuthSession: async () => undefined,
  buildSessionPayload: () => ({}),
}));

function makeSession(id: string): Session {
  return {
    access_token: "synthetic-token",
    refresh_token: "synthetic-refresh",
    token_type: "bearer",
    expires_in: 3600,
    user: {
      id,
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-11-03T00:00:00Z",
    },
  } as Session;
}

function AuthState() {
  const { user, role, roleResolved, loading } = useAuth();
  return (
    <output data-testid="auth-state">
      {JSON.stringify({ userId: user?.id ?? null, role, roleResolved, loading })}
    </output>
  );
}

function readState() {
  return JSON.parse(screen.getByTestId("auth-state").textContent ?? "{}") as {
    userId: string | null;
    role: string | null;
    roleResolved: boolean;
    loading: boolean;
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((ok) => { resolve = ok; });
  return { promise, resolve };
}

beforeEach(() => {
  mocks.listener = null;
  mocks.read.mockReset();
  mocks.read.mockResolvedValue({ data: null, error: null });
  window.localStorage.clear();
});

afterEach(() => {
  mocks.listener = null;
  vi.restoreAllMocks();
});

describe("auth role bootstrap and session changes", () => {
  it("keeps the new user unresolved during the first role lookup, never showing no-profile", async () => {
    const pending = deferred<ProfileReply>();
    mocks.read.mockImplementation(async (table, userId) => {
      if (table === "syncvet_equipe" && userId === "manager-1") return pending.promise;
      if (table === "gerentes" && userId === "manager-1") {
        return { data: { id: "ger-1", fazenda_id: "farm-1" }, error: null };
      }
      return { data: null, error: null };
    });

    render(<AuthProvider><AuthState /></AuthProvider>);
    await waitFor(() => expect(readState()).toMatchObject({
      userId: null, role: null, roleResolved: true, loading: false,
    }));

    await act(async () => { mocks.listener?.("SIGNED_IN", makeSession("manager-1")); });
    expect(readState()).toMatchObject({
      userId: "manager-1", role: null, roleResolved: false, loading: true,
    });

    await act(async () => { pending.resolve({ data: null, error: null }); });
    await waitFor(() => expect(readState()).toMatchObject({
      userId: "manager-1", role: "gerente", roleResolved: true, loading: false,
    }));
  });

  it("ignores a stale first account's role after switching to another account", async () => {
    const firstRequest = deferred<ProfileReply>();
    mocks.read.mockImplementation(async (table, userId) => {
      if (table === "syncvet_equipe" && userId === "old-user") return firstRequest.promise;
      if (table === "capatazes" && userId === "new-user") {
        return { data: { id: "cap-1", retiro_id: "ret-1" }, error: null };
      }
      if (table === "gerentes" && userId === "old-user") {
        return { data: { id: "ger-old", fazenda_id: "farm-old" }, error: null };
      }
      return { data: null, error: null };
    });
    render(<AuthProvider><AuthState /></AuthProvider>);
    await waitFor(() => expect(readState().loading).toBe(false));

    await act(async () => { mocks.listener?.("SIGNED_IN", makeSession("old-user")); });
    await act(async () => { mocks.listener?.("SIGNED_IN", makeSession("new-user")); });
    await waitFor(() => expect(readState()).toMatchObject({
      userId: "new-user", role: "capataz", roleResolved: true, loading: false,
    }));

    await act(async () => { firstRequest.resolve({ data: null, error: null }); });
    expect(readState()).toMatchObject({
      userId: "new-user", role: "capataz", roleResolved: true, loading: false,
    });
  });

  it("only reports an unconfigured profile after the full lookup has completed", async () => {
    const pending = deferred<ProfileReply>();
    mocks.read.mockImplementation(async (table) =>
      table === "syncvet_equipe" ? pending.promise : { data: null, error: null },
    );
    render(<AuthProvider><AuthState /></AuthProvider>);
    await waitFor(() => expect(readState().loading).toBe(false));

    await act(async () => { mocks.listener?.("SIGNED_IN", makeSession("unconfigured-1")); });
    expect(readState()).toMatchObject({
      userId: "unconfigured-1", role: null, roleResolved: false, loading: true,
    });
    await act(async () => { pending.resolve({ data: null, error: null }); });
    await waitFor(() => expect(readState()).toMatchObject({
      userId: "unconfigured-1", role: null, roleResolved: true, loading: false,
    }));
    expect(mocks.read).toHaveBeenCalledWith("administradores", "unconfigured-1");
  });

  it("clears account permissions on explicit sign-out event", async () => {
    mocks.read.mockImplementation(async (table, userId) =>
      table === "gerentes" && userId === "manager-1"
        ? { data: { id: "ger-1", fazenda_id: "farm-1" }, error: null }
        : { data: null, error: null },
    );
    render(<AuthProvider><AuthState /></AuthProvider>);
    await waitFor(() => expect(readState().loading).toBe(false));
    await act(async () => { mocks.listener?.("SIGNED_IN", makeSession("manager-1")); });
    await waitFor(() => expect(readState().role).toBe("gerente"));
    await act(async () => { mocks.listener?.("SIGNED_OUT", null); });
    await waitFor(() => expect(readState()).toMatchObject({
      userId: null, role: null, roleResolved: true, loading: false,
    }));
  });
});
