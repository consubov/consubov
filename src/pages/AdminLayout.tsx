import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function AdminLayout() {
  const { signOut } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 bg-primary text-primary-foreground px-4 flex items-center justify-between border-b border-primary/20 shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-primary-foreground hover:bg-primary/80" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                  <span className="text-base font-extrabold text-secondary-foreground">C</span>
                </div>
                <span className="text-base font-bold hidden sm:inline">Consubov</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground hover:bg-primary/80">
              <LogOut className="w-5 h-5" />
            </Button>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
