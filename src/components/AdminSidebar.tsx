import { LayoutDashboard, Landmark, UserCog, HardHat, QrCode } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
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
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Fazendas", url: "/admin/fazendas", icon: Landmark },
  { title: "Gerentes", url: "/admin/gerentes", icon: UserCog },
  { title: "Capatazes", url: "/admin/capatazes", icon: HardHat },
  { title: "QR Codes", url: "/admin/qrcodes", icon: QrCode },
];

export function AdminSidebar() {
  const { state, setOpenMobile, setOpen } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const handleNavClick = () => {
    setOpenMobile(false);
    setOpen(false);
  };

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border">
      <SidebarContent className="bg-sidebar pt-2">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider mb-1">
              Gestão
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
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
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
