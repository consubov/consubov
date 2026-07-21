import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, Users, Landmark, Pill, Snowflake, Workflow, Calendar, Settings, Baby } from "lucide-react";
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
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate("/syncvet/preferencias")} className="text-primary-foreground hover:bg-white/10">
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => void signOut()} className="text-primary-foreground hover:bg-white/10">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-3 pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
        <div className="max-w-5xl mx-auto grid grid-cols-8">
          {[
            { to: "/syncvet", end: true, icon: LayoutDashboard, label: "Painel" },
            { to: "/syncvet/fazendas", icon: Landmark, label: "Fazendas" },
            { to: "/syncvet/agenda", icon: Calendar, label: "Agenda" },
            { to: "/syncvet/partos", icon: Baby, label: "Partos" },
            { to: "/syncvet/equipe", icon: Users, label: "Equipe" },
            { to: "/syncvet/medicamentos", icon: Pill, label: "Medic." },
            { to: "/syncvet/semen", icon: Snowflake, label: "Sêmen" },
            { to: "/syncvet/protocolos", icon: Workflow, label: "Protoc." },
          ].map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn("flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
                  isActive ? "text-primary" : "text-muted-foreground")
              }
            >
              <it.icon className="w-5 h-5" /> {it.label}
            </NavLink>
          ))}
        </div>
        <div className="text-center pb-1">
          <AppVersionBadge />
        </div>
      </nav>
    </div>
  );
}
