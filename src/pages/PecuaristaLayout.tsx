import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw, BarChart3, Landmark, History } from "lucide-react";
import maisArrobasAsset from "@/assets/mais-arrobas-logo.png.asset.json";
import { AppVersionBadge } from "@/components/AppVersionBadge";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { UpdateBanner } from "@/components/UpdateBanner";
import { supabase } from "@/integrations/supabase/client";

export default function PecuaristaLayout() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [nome, setNome] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("pecuaristas")
        .select("nome")
        .eq("user_id", user.id)
        .maybeSingle();
      setNome((data as any)?.nome ?? "");
    })();
  }, [user]);

  async function handleRefresh() {
    setRefreshing(true);
    try { window.location.reload(); } finally { setRefreshing(false); }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-3 py-2">
          <button onClick={() => navigate("/pecuarista")} className="flex items-center gap-2">
            <img src={maisArrobasAsset.url} alt="Mais Arrobas" className="w-9 h-9 rounded-md object-cover bg-white" />
            <div className="text-left">
              <div className="text-sm font-bold leading-tight">Mais Arrobas</div>
              <div className="text-[10px] uppercase tracking-wider opacity-80">Pecuarista</div>
            </div>
          </button>
          <div className="flex items-center gap-1">
            <AtualizarAppButton className="text-primary-foreground hover:bg-white/10" />
            <Button variant="ghost" size="icon" onClick={() => void signOut()} className="text-primary-foreground hover:bg-white/10">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>
      <UpdateBanner />

      <main className="flex-1 max-w-5xl w-full mx-auto p-3 pb-20">
        <Outlet context={{ nome }} />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
        <div className="max-w-5xl mx-auto grid grid-cols-3">
          <NavLink to="/pecuarista" end className={({ isActive }) => cn("flex flex-col items-center gap-1 py-2.5 text-xs font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
            <BarChart3 className="w-5 h-5" /> Painel
          </NavLink>
          <NavLink to="/pecuarista/fazendas" className={({ isActive }) => cn("flex flex-col items-center gap-1 py-2.5 text-xs font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
            <Landmark className="w-5 h-5" /> Fazendas
          </NavLink>
          <NavLink to="/pecuarista/lotes" className={({ isActive }) => cn("flex flex-col items-center gap-1 py-2.5 text-xs font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
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
