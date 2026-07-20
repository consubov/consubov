import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw, BarChart3, Users, Scale, Settings } from "lucide-react";
import logoConsubov from "@/assets/logo-consubov.jpeg";
import { AppVersionBadge } from "@/components/AppVersionBadge";
import { cn } from "@/lib/utils";
import { useState } from "react";
import PesadorConfigModal from "@/components/PesadorConfigModal";
import { UpdateBanner } from "@/components/UpdateBanner";

export default function PesadorLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

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
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-3 py-2">
          <button onClick={() => navigate("/pesador")} className="flex items-center gap-2">
            <img src={logoConsubov} alt="Consubov" className="w-9 h-9 rounded-md object-cover" />
            <div className="text-left">
              <div className="text-sm font-bold leading-tight">Consubov</div>
              <div className="text-[10px] uppercase tracking-wider opacity-80">Pesador</div>
            </div>
          </button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setConfigOpen(true)} className="text-primary-foreground hover:bg-white/10">
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleRefresh} className="text-primary-foreground hover:bg-white/10">
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => void signOut()} className="text-primary-foreground hover:bg-white/10">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>
      <PesadorConfigModal open={configOpen} onOpenChange={setConfigOpen} />

      <main className="flex-1 max-w-5xl w-full mx-auto p-3 pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
        <div className="max-w-5xl mx-auto grid grid-cols-3">
          <NavLink
            to="/pesador"
            end
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
            to="/pesador/clientes"
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 py-2.5 text-xs font-medium",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            <Users className="w-5 h-5" /> Clientes
          </NavLink>
          <NavLink
            to="/pesador/pesagem"
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 py-2.5 text-xs font-medium",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            <Scale className="w-5 h-5" /> Pesagem
          </NavLink>
        </div>
        <div className="text-center pb-1">
          <AppVersionBadge />
        </div>
      </nav>
    </div>
  );
}
