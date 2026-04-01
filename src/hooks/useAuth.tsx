import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "administrador" | "gerente" | "capataz" | null;

interface RoleData {
  role: UserRole;
  roleId: string | null;
  fazendaId: string | null;
  retiroId: string | null;
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

const emptyRoleData: RoleData = { role: null, roleId: null, fazendaId: null, retiroId: null };
const CACHED_CAPATAZ_ROLE_KEY = "consubov:cached-capataz-role";

function clearCachedCapatazRole() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHED_CAPATAZ_ROLE_KEY);
  } catch {
    // ignore cache errors
  }
}

function getCachedCapatazRole(userId: string): RoleData | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CACHED_CAPATAZ_ROLE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as RoleData & { userId: string };
    if (parsed.userId !== userId || parsed.role !== "capataz" || !parsed.retiroId) {
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

function cacheCapatazRole(userId: string, roleData: RoleData) {
  if (typeof window === "undefined") return;

  try {
    if (roleData.role === "capataz" && roleData.retiroId) {
      window.localStorage.setItem(CACHED_CAPATAZ_ROLE_KEY, JSON.stringify({ userId, ...roleData }));
      return;
    }

    clearCachedCapatazRole();
  } catch {
    // ignore cache errors
  }
}

async function detectRole(userId: string): Promise<RoleData> {
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

  // 3. Check administrador
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
        const cachedCapatazRole = getCachedCapatazRole(currentSession.user.id);

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
      }
      if (!cancelled) setLoading(false);
    }

    // 1. Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // After initial load, handle subsequent auth changes
      if (initializedRef.current) {
        loadRole(session);
      }
    });

    // 2. Then get initial session (prevents race condition)
    supabase.auth.getSession().then(({ data: { session } }) => {
      initializedRef.current = true;
      loadRole(session);
    });

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
    } catch {
      // Force clear even if signOut fails (expired token)
      setSession(null);
      setUser(null);
      setRoleData(emptyRoleData);
      clearCachedCapatazRole();
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
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
