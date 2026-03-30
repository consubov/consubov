import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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

async function detectRole(userId: string): Promise<RoleData> {
  // Check administrador
  const { data: admin } = await supabase
    .from("administradores")
    .select("id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  if (admin) {
    return { role: "administrador", roleId: admin.id, fazendaId: null, retiroId: null };
  }

  // Check gerente
  const { data: gerente } = await supabase
    .from("gerentes")
    .select("id, fazenda_id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  if (gerente) {
    return { role: "gerente", roleId: gerente.id, fazendaId: gerente.fazenda_id, retiroId: null };
  }

  return { role: null, roleId: null, fazendaId: null, retiroId: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roleData, setRoleData] = useState<RoleData>({ role: null, roleId: null, fazendaId: null, retiroId: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const rd = await detectRole(session.user.id);
        setRoleData(rd);
      } else {
        setRoleData({ role: null, roleId: null, fazendaId: null, retiroId: null });
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const rd = await detectRole(session.user.id);
        setRoleData(rd);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
