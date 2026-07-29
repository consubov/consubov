import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  saveAuthSession,
  getAuthSession,
  clearAuthSession,
  buildSessionPayload,
} from "@/lib/offlineSession";
import { reconcileDemoSession, isDemoEmail } from "@/lib/demoSession";

export type UserRole = "administrador" | "gerente" | "capataz" | "escritorio" | "operador_fabrica" | "consultor" | "pesador" | "pecuarista" | "syncvet" | null;

interface RoleData {
  role: UserRole;
  roleId: string | null;
  fazendaId: string | null;
  retiroId: string | null;
  fabricaId?: string | null;
  consultorId?: string | null;
  syncvetEmpresaId?: string | null;
  syncvetPerfil?: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: UserRole;
  roleData: RoleData;
  loading: boolean;
  roleResolved: boolean;
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
      fabricaId: parsed.fabricaId ?? null,
      consultorId: parsed.consultorId ?? null,
      syncvetEmpresaId: parsed.syncvetEmpresaId ?? null,
      syncvetPerfil: parsed.syncvetPerfil ?? null,
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
  // Cada checagem é isolada: se uma tabela falhar (erro de rede, resposta
  // inesperada, permissão), NÃO interrompemos a cadeia — apenas registramos
  // e seguimos para a próxima. Isso garante que um perfil válido em uma
  // tabela mais abaixo (ex.: pecuaristas) não fique invisível por causa
  // de um erro transitório numa tabela anterior.
  const probe = async <T,>(
    label: string,
    runner: () => Promise<{ data: T | null; error: unknown }>,
  ): Promise<T | null> => {
    try {
      const { data, error } = await runner();
      if (error) {
        console.warn(`[detectRole] ${label} falhou:`, error);
        return null;
      }
      return data;
    } catch (e) {
      console.warn(`[detectRole] ${label} exceção:`, e);
      return null;
    }
  };

  // SyncVet team member
  const syncvetMember = await probe<{ id: string; empresa_id: string; perfil: string }>(
    "syncvet_equipe",
    () => supabase.from("syncvet_equipe").select("id, empresa_id, perfil")
      .eq("user_id", userId).eq("ativo", true).maybeSingle() as any,
  );
  if (syncvetMember) {
    return {
      role: "syncvet",
      roleId: syncvetMember.id,
      fazendaId: null,
      retiroId: null,
      syncvetEmpresaId: syncvetMember.empresa_id,
      syncvetPerfil: syncvetMember.perfil,
    };
  }

  // Consultor
  const consultor = await probe<{ id: string }>(
    "consultores",
    () => supabase.from("consultores").select("id")
      .eq("user_id", userId).eq("ativo", true).maybeSingle() as any,
  );
  if (consultor) {
    return { role: "consultor", roleId: consultor.id, fazendaId: null, retiroId: null, consultorId: consultor.id };
  }

  // Pesador
  const pesador = await probe<{ id: string }>(
    "pesadores",
    () => supabase.from("pesadores").select("id")
      .eq("user_id", userId).maybeSingle() as any,
  );
  if (pesador) {
    return { role: "pesador", roleId: pesador.id, fazendaId: null, retiroId: null };
  }

  // Pecuarista
  const pecuarista = await probe<{ id: string }>(
    "pecuaristas",
    () => supabase.from("pecuaristas").select("id")
      .eq("user_id", userId).maybeSingle() as any,
  );
  if (pecuarista) {
    return { role: "pecuarista", roleId: pecuarista.id, fazendaId: null, retiroId: null };
  }

  // Operador de fábrica
  const operador = await probe<{ id: string; fabrica_id: string }>(
    "operadores_fabrica",
    () => supabase.from("operadores_fabrica").select("id, fabrica_id")
      .eq("user_id", userId).eq("ativo", true).maybeSingle() as any,
  );
  if (operador) {
    return { role: "operador_fabrica", roleId: operador.id, fazendaId: null, retiroId: null, fabricaId: operador.fabrica_id };
  }

  // Capataz
  const capataz = await probe<{ id: string; retiro_id: string }>(
    "capatazes",
    () => supabase.from("capatazes").select("id, retiro_id")
      .eq("user_id", userId).eq("ativo", true).maybeSingle() as any,
  );
  if (capataz) {
    return { role: "capataz", roleId: capataz.id, fazendaId: null, retiroId: capataz.retiro_id };
  }

  // Gerente
  const gerente = await probe<{ id: string; fazenda_id: string }>(
    "gerentes",
    () => supabase.from("gerentes").select("id, fazenda_id")
      .eq("user_id", userId).eq("ativo", true).maybeSingle() as any,
  );
  if (gerente) {
    return { role: "gerente", roleId: gerente.id, fazendaId: gerente.fazenda_id, retiroId: null };
  }

  // Escritório
  const escritorio = await probe<{ id: string; fazenda_id: string }>(
    "escritorios",
    () => supabase.from("escritorios").select("id, fazenda_id")
      .eq("user_id", userId).eq("ativo", true).maybeSingle() as any,
  );
  if (escritorio) {
    return { role: "escritorio", roleId: escritorio.id, fazendaId: escritorio.fazenda_id, retiroId: null };
  }

  // Administrador
  const admin = await probe<{ id: string }>(
    "administradores",
    () => supabase.from("administradores").select("id")
      .eq("user_id", userId).eq("ativo", true).maybeSingle() as any,
  );
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
  const [roleResolved, setRoleResolved] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRole(currentSession: Session | null) {
      if (cancelled) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Never block the first paint of /capataz on an IndexedDB write.
          // Sessões de demonstração NUNCA são persistidas offline.
          if (!isDemoEmail(currentSession.user.email)) {
            deferNonCritical(() => {
              void saveAuthSession(buildSessionPayload(currentSession));
            });
          }

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
          if (!cancelled) {
            setRoleData(effectiveRole);
            setRoleResolved(true);
          }
        } catch (e) {
          console.error("Error detecting role:", e);
          if (!cancelled) {
            setRoleData(cachedCapatazRole ?? emptyRoleData);
            setRoleResolved(true);
          }
        }
      } else {
        setRoleData(emptyRoleData);
        setRoleResolved(true);
        clearCachedCapatazRole();
        void clearAuthSession();
      }
      if (!cancelled) setLoading(false);
    }

    // 1. Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Persist session payload on every auth change so refresh tokens are
      // always up-to-date in IndexedDB even when the page reloads cold.
      if (session && !isDemoEmail(session.user?.email)) {
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
        // Isola a sessão de demonstração antes de qualquer leitura de perfil.
        await reconcileDemoSession();
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
    <AuthContext.Provider value={{ session, user, role: roleData.role, roleData, loading, roleResolved, signIn, signOut }}>
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
