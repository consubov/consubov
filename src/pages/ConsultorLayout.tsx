import { Outlet, NavLink, useNavigate, useLocation, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw, Landmark, History, BarChart3, Receipt } from "lucide-react";
import relattoLogo from "@/assets/relatto-logo.png.asset.json";
import { AppVersionBadge } from "@/components/AppVersionBadge";
import { UpdateBanner } from "@/components/UpdateBanner";
import { UserNotificationToggle } from "@/components/UserNotificationToggle";
import SyncHeaderIndicator from "@/components/consultor/SyncHeaderIndicator";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function ConsultorLayout() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [refreshing, setRefreshing] = useState(false);
  const [despesasAtivo, setDespesasAtivo] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("consultores")
        .select("modulo_despesas_ativo")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancel) setDespesasAtivo(Boolean((data as any)?.modulo_despesas_ativo));
    })();
    return () => { cancel = true; };
  }, [user]);


  async function handleRefresh() {
    setRefreshing(true);
    try {
      window.location.reload();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <UpdateBanner />
      {/* Header */}
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-3 py-2">
          <button onClick={() => navigate("/consultor")} className="flex items-center gap-2">
            <img src={relattoLogo.url} alt="Relatto" className="w-9 h-9 rounded-md object-contain bg-white" />
            <div className="text-left">
              <div className="text-sm font-bold leading-tight">Relatto</div>
              <div className="text-[10px] uppercase tracking-wider opacity-80">
                Consultor
              </div>
            </div>
          </button>
          <div className="flex items-center gap-1">
            <UserNotificationToggle />
            <SyncHeaderIndicator />
            <Button variant="ghost" size="icon" onClick={handleRefresh} className="text-primary-foreground hover:bg-white/10">
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => void signOut()} className="text-primary-foreground hover:bg-white/10">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-3 pb-20">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
        <div className="max-w-5xl mx-auto grid grid-cols-4">
          <NavLink
            to="/consultor"
            end
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 py-2.5 text-xs font-medium",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            <Landmark className="w-5 h-5" /> Fazendas
          </NavLink>
          <NavLink
            to="/consultor/painel"
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 py-2.5 text-xs font-medium",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            <BarChart3 className="w-5 h-5" /> Painel
          </NavLink>
          <NavLink
            to="/consultor/despesas"
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 py-2.5 text-xs font-medium",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            <Receipt className="w-5 h-5" /> Despesas
          </NavLink>
          <NavLink
            to="/consultor/historico"
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 py-2.5 text-xs font-medium",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            <History className="w-5 h-5" /> Histórico
          </NavLink>
        </div>
        <div className="text-center pb-1">
          <AppVersionBadge />
        </div>
      </nav>
    </div>
  );
}
