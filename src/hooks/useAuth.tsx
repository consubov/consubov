import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  saveAuthSession,
  getAuthSession,
  clearAuthSession,
  buildSessionPayload,
} from "@/lib/offlineSession";

export type UserRole = "administrador" | "gerente" | "capataz" | "escritorio" | "operador_fabrica" | "consultor" | null;

interface RoleData {
  role: UserRole;
  roleId: string | null;
  fazendaId: string | null;
  retiroId: string | null;
  fabricaId?: string | null;
  consultorId?: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: UserRole;
  roleData: RoleData;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Simulation context for admin "view as" mode
interface SimulationOverride {
  roleData: RoleData;
  signOut: () => Promise<void>;
}
const SimulationContext = createContext<SimulationOverride | null>(null);
export { SimulationContext };

const emptyRoleData: RoleData = { role: null, roleId: null, fazendaId: null, retiroId: null };
const CACHED_ROLE_KEY = "consubov:cached-role";
// Legacy key kept only for cleanup on first run.
const LEGACY_CAPATAZ_ROLE_KEY = "consubov:cached-capataz-role";

function clearCachedRole() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHED_ROLE_KEY);
    window.localStorage.removeItem(LEGACY_CAPATAZ_ROLE_KEY);
  } catch {
    // ignore cache errors
  }
}

function getCachedRole(userId: string): RoleData | null {
  if (typeof window === "undefined") return null;

  try {
    const raw =
      window.localStorage.getItem(CACHED_ROLE_KEY) ||
      window.localStorage.getItem(LEGACY_CAPATAZ_ROLE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as RoleData & { userId: string };
    if (parsed.userId !== userId || !parsed.role) {
      return null;
    }

    return {
      role: parsed.role,
      roleId: parsed.roleId ?? null,
      fazendaId: parsed.fazendaId ?? null,
      retiroId: parsed.retiroId ?? null,
    };
  } catch {
    return null;
  }
}

function cacheRole(userId: string, roleData: RoleData) {
  if (typeof window === "undefined") return;

  try {
    if (roleData.role) {
      window.localStorage.setItem(
        CACHED_ROLE_KEY,
        JSON.stringify({ userId, ...roleData }),
      );
      return;
    }
    // Don't clear cache here — when offline detectRole may return empty due
    // to network failure; preserve the last-known good role.
  } catch {
    // ignore cache errors
  }
}

// Back-compat aliases (kept so other call sites don't break).
const getCachedCapatazRole = getCachedRole;
const cacheCapatazRole = cacheRole;
const clearCachedCapatazRole = clearCachedRole;

function isCapatazRoute() {
  if (typeof window === "undefined") return false;
  return window.location.pathname === "/capataz" || window.location.pathname.startsWith("/capataz/");
}

function deferNonCritical(task: () => void) {
  if (typeof window === "undefined") {
    task();
    return;
  }

  const run = () => {
    window.setTimeout(task, 0);
  };

  if ("requestAnimationFrame" in window) {
    window.requestAnimationFrame(run);
    return;
  }

  run();
}

async function detectRole(userId: string): Promise<RoleData> {
  // 0. Check operador_fabrica first
  const { data: operador, error: operadorError } = await supabase
    .from("operadores_fabrica")
    .select("id, fabrica_id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  if (operadorError) throw operadorError;

  if (operador) {
    return { role: "operador_fabrica", roleId: operador.id, fazendaId: null, retiroId: null, fabricaId: operador.fabrica_id };
  }

  // 1. Check capataz first (as user requested order)
  const { data: capataz, error: capatazError } = await supabase
    .from("capatazes")
    .select("id, retiro_id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  if (capatazError) throw capatazError;

  if (capataz) {
    return { role: "capataz", roleId: capataz.id, fazendaId: null, retiroId: capataz.retiro_id };
  }

  // 2. Check gerente
  const { data: gerente, error: gerenteError } = await supabase
    .from("gerentes")
    .select("id, fazenda_id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  if (gerenteError) throw gerenteError;

  if (gerente) {
    return { role: "gerente", roleId: gerente.id, fazendaId: gerente.fazenda_id, retiroId: null };
  }

  // 3. Check escritorio
  const { data: escritorio, error: escritorioError } = await supabase
    .from("escritorios")
    .select("id, fazenda_id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  if (escritorioError) throw escritorioError;

  if (escritorio) {
    return { role: "escritorio", roleId: escritorio.id, fazendaId: escritorio.fazenda_id, retiroId: null };
  }

  // 4. Check administrador
  const { data: admin, error: adminError } = await supabase
    .from("administradores")
    .select("id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  if (adminError) throw adminError;

  if (admin) {
    return { role: "administrador", roleId: admin.id, fazendaId: null, retiroId: null };
  }

  return emptyRoleData;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roleData, setRoleData] = useState<RoleData>(emptyRoleData);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRole(currentSession: Session | null) {
      if (cancelled) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Never block the first paint of /capataz on an IndexedDB write.
          deferNonCritical(() => {
            void saveAuthSession(buildSessionPayload(currentSession));
          });

        const cachedCapatazRole = getCachedCapatazRole(currentSession.user.id);

        if (cachedCapatazRole && !cancelled) {
          setRoleData(cachedCapatazRole);
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            setLoading(false);
          }
        }

        try {
          const detectedRole = await detectRole(currentSession.user.id);
          const effectiveRole = detectedRole.role
            ? detectedRole
            : cachedCapatazRole && typeof navigator !== "undefined" && !navigator.onLine
              ? cachedCapatazRole
              : detectedRole;

          cacheCapatazRole(currentSession.user.id, effectiveRole);
          if (!cancelled) setRoleData(effectiveRole);
        } catch (e) {
          console.error("Error detecting role:", e);
          if (!cancelled) setRoleData(cachedCapatazRole ?? emptyRoleData);
        }
      } else {
        setRoleData(emptyRoleData);
        clearCachedCapatazRole();
        void clearAuthSession();
      }
      if (!cancelled) setLoading(false);
    }

    // 1. Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Persist session payload on every auth change so refresh tokens are
      // always up-to-date in IndexedDB even when the page reloads cold.
      if (session) {
        deferNonCritical(() => {
          void saveAuthSession(buildSessionPayload(session));
        });
      }

      // After initial load, handle subsequent auth changes
      if (initializedRef.current) {
        if (event === "TOKEN_REFRESHED" && session?.user) {
          setSession(session);
          setUser(session.user);
          return;
        }
        loadRole(session);
      }
    });

    // 2. Then get initial session — try Supabase first, then fall back to
    //    IndexedDB-persisted session if we're offline / token expired.
    (async () => {
      try {
        const { data: { session: liveSession } } = await supabase.auth.getSession();
        if (liveSession) {
          initializedRef.current = true;
          await loadRole(liveSession);
          return;
        }

        // No live session — try restoring from IndexedDB
        const shouldDelayOfflineRestore = isCapatazRoute() && typeof navigator !== "undefined" && navigator.onLine;
        if (shouldDelayOfflineRestore) {
          initializedRef.current = true;
          await loadRole(null);
          return;
        }

        const persisted = await getAuthSession();
        if (persisted?.access_token && persisted?.refresh_token) {
          const { data, error } = await supabase.auth.setSession({
            access_token: persisted.access_token,
            refresh_token: persisted.refresh_token,
          });
          if (!error && data.session) {
            initializedRef.current = true;
            await loadRole(data.session);
            return;
          }
          // setSession failed (e.g. truly offline). Build a synthetic session
          // so the capataz lands on their dashboard instead of the login screen.
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            const offlineSession = {
              access_token: persisted.access_token,
              refresh_token: persisted.refresh_token,
              expires_at: persisted.expires_at,
              expires_in: Math.max(0, persisted.expires_at - Math.floor(Date.now() / 1000)),
              token_type: "bearer",
              user: {
                id: persisted.user_id,
                email: persisted.email ?? undefined,
                app_metadata: {},
                user_metadata: { nome: persisted.user_name ?? undefined },
                aud: "authenticated",
                created_at: persisted.saved_at,
              },
            } as unknown as Session;
            initializedRef.current = true;
            await loadRole(offlineSession);
            return;
          }
        }

        initializedRef.current = true;
        await loadRole(null);
      } catch (e) {
        console.error("[useAuth] init failed:", e);
        initializedRef.current = true;
        await loadRole(null);
      }
    })();

    // Safety timeout
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 5000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setSession(null);
      setUser(null);
      setRoleData(emptyRoleData);
      clearCachedCapatazRole();
      void clearAuthSession();
      if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, role: roleData.role, roleData, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  const sim = useContext(SimulationContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  if (sim) {
    return {
      ...ctx,
      role: sim.roleData.role,
      roleData: sim.roleData,
      signOut: sim.signOut,
    };
  }
  return ctx;
}
