import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Building2, Users, Landmark } from "lucide-react";
import { AppVersionBadge } from "@/components/AppVersionBadge";
import { cn } from "@/lib/utils";

export default function SyncVetLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-3 py-2">
          <button onClick={() => navigate("/syncvet")} className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-secondary text-primary flex items-center justify-center font-extrabold">S</div>
            <div className="text-left">
              <div className="text-sm font-bold leading-tight">SyncVet</div>
              <div className="text-[10px] uppercase tracking-wider opacity-80">Módulo Veterinário</div>
            </div>
          </button>
          <Button variant="ghost" size="icon" onClick={() => void signOut()} className="text-primary-foreground hover:bg-white/10">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-3 pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
        <div className="max-w-5xl mx-auto grid grid-cols-3">
          <NavLink
            to="/syncvet"
            end
            className={({ isActive }) =>
              cn("flex flex-col items-center gap-1 py-2.5 text-xs font-medium",
                isActive ? "text-primary" : "text-muted-foreground")
            }
          >
            <Building2 className="w-5 h-5" /> Empresa
          </NavLink>
          <NavLink
            to="/syncvet/equipe"
            className={({ isActive }) =>
              cn("flex flex-col items-center gap-1 py-2.5 text-xs font-medium",
                isActive ? "text-primary" : "text-muted-foreground")
            }
          >
            <Users className="w-5 h-5" /> Equipe
          </NavLink>
          <NavLink
            to="/syncvet/fazendas"
            className={({ isActive }) =>
              cn("flex flex-col items-center gap-1 py-2.5 text-xs font-medium",
                isActive ? "text-primary" : "text-muted-foreground")
            }
          >
            <Landmark className="w-5 h-5" /> Fazendas
          </NavLink>
        </div>
        <div className="text-center pb-1">
          <AppVersionBadge />
        </div>
      </nav>
    </div>
  );
}
