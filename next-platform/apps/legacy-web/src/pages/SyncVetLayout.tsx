import { Outlet, NavLink, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, Users, Landmark, Pill, Snowflake, Workflow, Calendar, Settings, Route as RouteIcon } from "lucide-react";
import { CalfIcon } from "@/components/icons/CalfIcon";
import syncvetLogo from "@/assets/syncvet-logo.png.asset.json";
import { AppVersionBadge } from "@/components/AppVersionBadge";
import { cn } from "@/lib/utils";
import { isSyncvetFullAccess, isSyncvetRestrictedPathAllowed } from "@/lib/syncvetPerfil";

export default function SyncVetLayout() {
  const { signOut, roleData } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const fullAccess = isSyncvetFullAccess(roleData.syncvetPerfil);

  // Guard: perfis restritos só podem acessar Agenda e Trajetos
  if (!fullAccess && !isSyncvetRestrictedPathAllowed(location.pathname)) {
    return <Navigate to="/syncvet/meu-painel" replace />;
  }

  const navItems = fullAccess
    ? [
        { to: "/syncvet", end: true, icon: LayoutDashboard, label: "nav.panel" },
        { to: "/syncvet/fazendas", icon: Landmark, label: "nav.farms" },
        { to: "/syncvet/agenda", icon: Calendar, label: "syncvet.schedule" },
        { to: "/syncvet/partos", icon: CalfIcon, label: "syncvet.births" },
        { to: "/syncvet/equipe", icon: Users, label: "syncvet.team" },
        { to: "/syncvet/medicamentos", icon: Pill, label: "syncvet.meds" },
        { to: "/syncvet/semen", icon: Snowflake, label: "syncvet.semen" },
        { to: "/syncvet/protocolos", icon: Workflow, label: "syncvet.protocol" },
      ]
    : [
        { to: "/syncvet/meu-painel", icon: LayoutDashboard, label: "nav.panel" },
        { to: "/syncvet/fazendas", icon: Landmark, label: "nav.farms" },
        { to: "/syncvet/agenda", icon: Calendar, label: "syncvet.schedule" },
        { to: "/syncvet/partos", icon: CalfIcon, label: "syncvet.births" },
        { to: "/syncvet/trajetos", icon: RouteIcon, label: "syncvet.routes" },
      ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-3 py-2">
          <button onClick={() => navigate(fullAccess ? "/syncvet" : "/syncvet/meu-painel")} className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-md bg-white flex items-center justify-center overflow-hidden shrink-0">
              <img src={syncvetLogo.url} alt="syncvet" className="w-full h-full object-contain" />
            </div>
            <div className="text-left leading-tight">
              <div className="text-xl font-extrabold tracking-tight lowercase">syncvet</div>
              <div className="text-[10px] uppercase tracking-wider opacity-80">{t("role.veterinary")}</div>
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
        <div
          className="max-w-5xl mx-auto grid"
          style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
        >
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={(it as { end?: boolean }).end}
              className={({ isActive }) =>
                cn("flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
                  isActive ? "text-primary" : "text-muted-foreground")
              }
            >
              <it.icon className="w-5 h-5" /> {t(it.label)}
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
