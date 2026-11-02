import { useEffect, useState } from "react";
import { LayoutDashboard, Landmark, UserCog, HardHat, QrCode, Package, ClipboardEdit, Settings, Bell, Globe, Brain, CalendarDays, Building2, Camera, ShieldAlert, ScanLine, Factory, Stethoscope, Scale, Sparkles, UserPlus, FunctionSquare, Trophy } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "nav.dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "nav.farms", url: "/admin/fazendas", icon: Landmark },
  { title: "nav.managers", url: "/admin/gerentes", icon: UserCog },
  { title: "nav.foremen", url: "/admin/capatazes", icon: HardHat },
  { title: "nav.offices", url: "/admin/escritorios", icon: Building2 },
  { title: "nav.products", url: "/admin/produtos", icon: Package },
  { title: "nav.qr", url: "/admin/qrcodes", icon: QrCode },
  { title: "nav.inspection", url: "/conferencia", icon: ScanLine },
  { title: "nav.manual", url: "/admin/lancamento-manual", icon: ClipboardEdit },
  { title: "nav.generalSettings", url: "/admin/configuracoes", icon: Settings },
  { title: "nav.notifications", url: "/admin/notificacoes", icon: Bell },
  { title: "nav.landing", url: "/admin/landing-page", icon: Globe },
  { title: "nav.cycles", url: "/admin/ciclos", icon: CalendarDays },
  { title: "nav.nutrition", url: "/admin/inteligencia", icon: Brain },
  { title: "nav.auditInterval", url: "/admin/auditoria", icon: Camera },
  { title: "nav.recovery", url: "/admin/recuperar", icon: ShieldAlert },
  { title: "nav.factory", url: "/admin/fabricas", icon: Factory },
  { title: "nav.consultants", url: "/admin/consultores", icon: Stethoscope },
  { title: "nav.weighers", url: "/admin/pesadores", icon: Scale },
  { title: "nav.formulas", url: "/admin/formulas-sistema", icon: FunctionSquare },
  { title: "nav.awards", url: "/admin/premiacao", icon: Trophy },
];

export function AdminSidebar() {
  const { state, setOpenMobile, setOpen } = useSidebar();
  const { user } = useAuth();
  const { t } = useTranslation();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const [showSyncvetOnboarding, setShowSyncvetOnboarding] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("syncvet_equipe")
        .select("id")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();
      if (!cancelled) setShowSyncvetOnboarding(!data);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const items = showSyncvetOnboarding
    ? [...menuItems, { title: "nav.onboarding", url: "/admin/syncvet-onboarding", icon: Sparkles }]
    : menuItems;

  const handleNavClick = () => {
    setOpenMobile(false);
    setOpen(false);
  };

  const handleCriarAdmin = () => {
    handleNavClick();
    navigate("/admin?criar-admin=1");
  };

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border">
      <SidebarContent role="navigation" aria-label={t("nav.adminAria")} className="bg-sidebar pt-2">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider mb-1">
              {t("nav.management")}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = item.url === "/admin"
                  ? location.pathname === "/admin"
                  : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/admin"}
                        className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                        onClick={handleNavClick}
                      >
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span>{t(item.title)}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleCriarAdmin}
                  className="justify-start gap-3 px-3 py-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                >
                  <UserPlus className="w-5 h-5 shrink-0" />
                  <span>{t("nav.createAdmin")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
