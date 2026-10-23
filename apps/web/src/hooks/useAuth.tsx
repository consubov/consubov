import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearConsubovResumeRoute } from "@/lib/consubovRouteResume";
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

interface DetectRoleResult {
  roleData: RoleData;
  /** true quando ALGUMA consulta falhou (rede, 401, RLS, timeout). */
  queryFailed: boolean;
}

async function detectRoleOnce(userId: string): Promise<DetectRoleResult> {
  // Cada checagem é isolada: se uma tabela falhar (erro de rede, resposta
  // inesperada, permissão), NÃO interrompemos a cadeia — apenas registramos
  // e seguimos para a próxima. Mas agora marcamos `queryFailed` para que o
  // chamador saiba distinguir "não achei perfil" de "não consegui consultar".
  let queryFailed = false;

  const probe = async <T,>(
    label: string,
    runner: () => Promise<{ data: T | null; error: unknown }>,
  ): Promise<T | null> => {
    try {
      const { data, error } = await runner();
      if (error) {
        console.warn(`[detectRole] ${label} falhou:`, error);
        queryFailed = true;
        return null;
      }
      return data;
    } catch (e) {
      console.warn(`[detectRole] ${label} exceção:`, e);
      queryFailed = true;
      return null;
    }
  };

  const found = (roleData: RoleData): DetectRoleResult => ({ roleData, queryFailed: false });


  // SyncVet team member
  const syncvetMember = await probe<{ id: string; empresa_id: string; perfil: string }>(
    "syncvet_equipe",
    () => supabase.from("syncvet_equipe").select("id, empresa_id, perfil")
      .eq("user_id", userId).eq("ativo", true).maybeSingle() as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- pre-existing Supabase generated typing
  );
  if (syncvetMember) {
    return found({
      role: "syncvet",
      roleId: syncvetMember.id,
      fazendaId: null,
      retiroId: null,
      syncvetEmpresaId: syncvetMember.empresa_id,
      syncvetPerfil: syncvetMember.perfil,
    });
  }

  // Consultor
  const consultor = await probe<{ id: string }>(
    "consultores",
    () => supabase.from("consultores").select("id")
      .eq("user_id", userId).eq("ativo", true).maybeSingle() as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- pre-existing Supabase generated typing
  );
  if (consultor) {
    return found({ role: "consultor", roleId: consultor.id, fazendaId: null, retiroId: null, consultorId: consultor.id });
  }

  // Pesador
  const pesador = await probe<{ id: string }>(
    "pesadores",
    () => supabase.from("pesadores").select("id")
      .eq("user_id", userId).maybeSingle() as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- pre-existing Supabase generated typing
  );
  if (pesador) {
    return found({ role: "pesador", roleId: pesador.id, fazendaId: null, retiroId: null });
  }

  // Pecuarista
  const pecuarista = await probe<{ id: string }>(
    "pecuaristas",
    () => supabase.from("pecuaristas").select("id")
      .eq("user_id", userId).maybeSingle() as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- pre-existing Supabase generated typing
  );
  if (pecuarista) {
    return found({ role: "pecuarista", roleId: pecuarista.id, fazendaId: null, retiroId: null });
  }

  // Operador de fábrica
  const operador = await probe<{ id: string; fabrica_id: string }>(
    "operadores_fabrica",
    () => supabase.from("operadores_fabrica").select("id, fabrica_id")
      .eq("user_id", userId).eq("ativo", true).maybeSingle() as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- pre-existing Supabase generated typing
  );
  if (operador) {
    return found({ role: "operador_fabrica", roleId: operador.id, fazendaId: null, retiroId: null, fabricaId: operador.fabrica_id });
  }

  // Capataz
  const capataz = await probe<{ id: string; retiro_id: string }>(
    "capatazes",
    () => supabase.from("capatazes").select("id, retiro_id")
      .eq("user_id", userId).eq("ativo", true).maybeSingle() as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- pre-existing Supabase generated typing
  );
  if (capataz) {
    return found({ role: "capataz", roleId: capataz.id, fazendaId: null, retiroId: capataz.retiro_id });
  }

  // Gerente
  const gerente = await probe<{ id: string; fazenda_id: string }>(
    "gerentes",
    () => supabase.from("gerentes").select("id, fazenda_id")
      .eq("user_id", userId).eq("ativo", true).maybeSingle() as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- pre-existing Supabase generated typing
  );
  if (gerente) {
    return found({ role: "gerente", roleId: gerente.id, fazendaId: gerente.fazenda_id, retiroId: null });
  }

  // Escritório
  const escritorio = await probe<{ id: string; fazenda_id: string }>(
    "escritorios",
    () => supabase.from("escritorios").select("id, fazenda_id")
      .eq("user_id", userId).eq("ativo", true).maybeSingle() as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- pre-existing Supabase generated typing
  );
  if (escritorio) {
    return found({ role: "escritorio", roleId: escritorio.id, fazendaId: escritorio.fazenda_id, retiroId: null });
  }

  // Administrador
  const admin = await probe<{ id: string }>(
    "administradores",
    () => supabase.from("administradores").select("id")
      .eq("user_id", userId).eq("ativo", true).maybeSingle() as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- pre-existing Supabase generated typing
  );
  if (admin) {
    return found({ role: "administrador", roleId: admin.id, fazendaId: null, retiroId: null });
  }

  return { roleData: emptyRoleData, queryFailed };
}

/** Executa detectRoleOnce com retry/backoff enquanto houver falha de consulta. */
async function detectRole(userId: string, attempts = 3): Promise<DetectRoleResult> {
  let last: DetectRoleResult = { roleData: emptyRoleData, queryFailed: true };
  for (let i = 0; i < attempts; i++) {
    last = await detectRoleOnce(userId);
    if (last.roleData.role || !last.queryFailed) return last;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 600 * Math.pow(2, i)));
    }
  }
  return last;
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roleData, setRoleData] = useState<RoleData>(emptyRoleData);
  const [loading, setLoading] = useState(true);
  const [roleResolved, setRoleResolved] = useState(false);
  const initializedRef = useRef(false);
  // true enquanto a detecção de perfil falhou por erro de consulta (sem cache).
  const roleUnresolvedRef = useRef(false);
  // true só quando o usuário tocou em "Sair".
  const explicitSignOutRef = useRef(false);

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
              if (!explicitSignOutRef.current) void saveAuthSession(buildSessionPayload(currentSession));
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
          const { roleData: detectedRole, queryFailed } = await detectRole(currentSession.user.id);

          if (detectedRole.role) {
            // Perfil encontrado.
            cacheCapatazRole(currentSession.user.id, detectedRole);
            if (!cancelled) {
              roleUnresolvedRef.current = false;
              setRoleData(detectedRole);
              setRoleResolved(true);
              setLoading(false);
            }
          } else if (!queryFailed) {
            // Consultamos com sucesso as 9 tabelas e realmente não há perfil.
            if (!cancelled) {
              roleUnresolvedRef.current = false;
              setRoleData(emptyRoleData);
              setRoleResolved(true);
              setLoading(false);
            }
          } else if (cachedCapatazRole) {
            // Falha de consulta (rede/401/RLS) — usa o cache mesmo online.
            console.warn("[useAuth] detectRole falhou; usando role em cache.");
            if (!cancelled) {
              roleUnresolvedRef.current = false;
              setRoleData(cachedCapatazRole);
              setRoleResolved(true);
              setLoading(false);
            }
          } else {
            // Falha de consulta e sem cache: NÃO declarar "sem perfil".
            console.warn("[useAuth] detectRole falhou e não há cache; mantendo loading.");
            if (!cancelled) {
              roleUnresolvedRef.current = true;
              setRoleData(emptyRoleData);
              setRoleResolved(false);
              setLoading(true);
              // Continua tentando em background até conseguir consultar.
              window.setTimeout(() => {
                if (!cancelled && roleUnresolvedRef.current) void loadRole(currentSession);
              }, 8000);
            }
          }
        } catch (e) {
          console.error("Error detecting role:", e);
          if (!cancelled) {
            if (cachedCapatazRole) {
              roleUnresolvedRef.current = false;
              setRoleData(cachedCapatazRole);
              setRoleResolved(true);
              setLoading(false);
            } else {
              roleUnresolvedRef.current = true;
              setRoleResolved(false);
              setLoading(true);
              window.setTimeout(() => {
                if (!cancelled && roleUnresolvedRef.current) void loadRole(currentSession);
              }, 8000);
            }
          }
        }
        return;
      } else {
        setRoleData(emptyRoleData);
        setRoleResolved(true);
        clearCachedCapatazRole();
        // A cópia de segurança do login só é apagada no "Sair" explícito.
      }
      if (!cancelled) setLoading(false);

    }

    let restoring = false;
    async function tryRestoreBackup(): Promise<boolean> {
      if (restoring || explicitSignOutRef.current) return false;
      restoring = true;
      try {
        const persisted = await getAuthSession();
        if (explicitSignOutRef.current || !persisted?.access_token || !persisted?.refresh_token) return false;
        const { data, error } = await supabase.auth.setSession({
          access_token: persisted.access_token,
          refresh_token: persisted.refresh_token,
        });
        if (error || !data.session) return false;
        // setSession dispara SIGNED_IN, que recarrega o perfil.
        return true;
      } catch {
        return false;
      } finally {
        restoring = false;
      }
    }

    // 1. Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Persist session payload on every auth change so refresh tokens are
      // always up-to-date in IndexedDB even when the page reloads cold.
      if (!explicitSignOutRef.current && session && !isDemoEmail(session.user?.email)) {
        deferNonCritical(() => {
          if (!explicitSignOutRef.current) void saveAuthSession(buildSessionPayload(session));
        });
      }

      // After initial load, handle subsequent auth changes
      if (initializedRef.current) {
        if (event === "TOKEN_REFRESHED" && session?.user) {
          setSession(session);
          setUser(session.user);
          return;
        }
        if (!session && !explicitSignOutRef.current) {
          // Token recusado / sessão perdida sem "Sair": tenta a cópia de
          // segurança antes de mandar para a tela de login.
          void (async () => {
            const restored = await tryRestoreBackup();
            if (!restored) loadRole(null);
          })();
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
        if (!explicitSignOutRef.current && persisted?.access_token && persisted?.refresh_token) {
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

    // Safety timeout — nunca libera a UI enquanto a detecção de perfil estiver
    // pendente por falha de consulta (evita renderizar rotas com role vazia).
    const timeout = setTimeout(() => {
      if (!cancelled && !roleUnresolvedRef.current) setLoading(false);
    }, 15000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    explicitSignOutRef.current = false;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    explicitSignOutRef.current = true;
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setSession(null);
      setUser(null);
      setRoleData(emptyRoleData);
      clearCachedCapatazRole();
      // Wait for the offline authentication backup to be deleted before any
      // navigation can initiate a new session restoration.
      clearConsubovResumeRoute();
      await clearAuthSession();
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
