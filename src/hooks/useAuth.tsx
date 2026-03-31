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

async function detectRole(userId: string): Promise<RoleData> {
  // 1. Check capataz first (as user requested order)
  const { data: capataz } = await supabase
    .from("capatazes")
    .select("id, retiro_id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  if (capataz) {
    return { role: "capataz", roleId: capataz.id, fazendaId: null, retiroId: capataz.retiro_id };
  }

  // 2. Check gerente
  const { data: gerente } = await supabase
    .from("gerentes")
    .select("id, fazenda_id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  if (gerente) {
    return { role: "gerente", roleId: gerente.id, fazendaId: gerente.fazenda_id, retiroId: null };
  }

  // 3. Check administrador
  const { data: admin } = await supabase
    .from("administradores")
    .select("id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

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
        try {
          const rd = await detectRole(currentSession.user.id);
          if (!cancelled) setRoleData(rd);
        } catch (e) {
          console.error("Error detecting role:", e);
          if (!cancelled) setRoleData(emptyRoleData);
        }
      } else {
        setRoleData(emptyRoleData);
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
