import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import { useAuth, SimulationContext } from "@/hooks/useAuth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, ArrowLeft, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoConsubov from "@/assets/logo-consubov.jpeg";
import { UpdateBanner, RefreshButton } from "@/components/UpdateBanner";
import GerenteDashboard from "./GerenteDashboard";
import CapatazDashboard from "./CapatazDashboard";

type ViewMode = "administrador" | "gerente" | "capataz";

interface GerenteOption { id: string; nome: string; fazenda_id: string | null; }
interface CapatazOption { id: string; nome: string; retiro_id: string | null; }

export default function AdminLayout() {
  const { signOut } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("administrador");
  const [gerentes, setGerentes] = useState<GerenteOption[]>([]);
  const [capatazes, setCapatazes] = useState<CapatazOption[]>([]);
  const [selectedGerenteId, setSelectedGerenteId] = useState("");
  const [selectedCapatazId, setSelectedCapatazId] = useState("");

  useEffect(() => {
    supabase.from("gerentes").select("id, nome, fazenda_id").eq("ativo", true).then(({ data }) => setGerentes(data ?? []));
    supabase.from("capatazes").select("id, nome, retiro_id").eq("ativo", true).then(({ data }) => setCapatazes(data ?? []));
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setSelectedGerenteId("");
    setSelectedCapatazId("");
  };

  const backToAdmin = useCallback(async () => {
    setViewMode("administrador");
    setSelectedGerenteId("");
    setSelectedCapatazId("");
  }, []);

  const selectedGerente = gerentes.find(g => g.id === selectedGerenteId);
  const selectedCapataz = capatazes.find(c => c.id === selectedCapatazId);

  const isSimulating =
    (viewMode === "gerente" && !!selectedGerenteId) ||
    (viewMode === "capataz" && !!selectedCapatazId);

  const simulatedName = viewMode === "gerente" ? selectedGerente?.nome : selectedCapataz?.nome;

  const simulationOverride = isSimulating ? {
    roleData: viewMode === "gerente"
      ? { role: "gerente" as const, roleId: selectedGerenteId, fazendaId: selectedGerente?.fazenda_id ?? null, retiroId: null }
      : { role: "capataz" as const, roleId: selectedCapatazId, fazendaId: null, retiroId: selectedCapataz?.retiro_id ?? null },
    signOut: backToAdmin,
  } : null;

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        {!isSimulating && <AdminSidebar />}
        <div className="flex-1 flex flex-col min-w-0">
          <UpdateBanner />
          {/* Header */}
          <header className="h-auto bg-primary text-primary-foreground px-4 py-2 flex flex-col gap-2 border-b border-primary/20 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {!isSimulating && <SidebarTrigger className="text-primary-foreground hover:bg-primary/80" />}
                {isSimulating && (
                  <Button variant="ghost" size="icon" onClick={backToAdmin} className="text-primary-foreground hover:bg-primary/80">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg overflow-hidden">
                    <img src={logoConsubov} alt="Consubov" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-base font-bold hidden sm:inline">Consubov</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isSimulating && (
                  <Button variant="secondary" size="sm" onClick={backToAdmin} className="gap-1 text-xs font-semibold">
                    <ArrowLeft className="w-3 h-3" />
                    Voltar ao Admin
                  </Button>
                )}
                <RefreshButton />
                <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground hover:bg-primary/80">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Simulation badge */}
            {isSimulating && (
              <div className="bg-secondary/20 text-secondary-foreground rounded-md px-3 py-1.5 text-xs font-medium flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                👁 Visualizando como: <strong>{simulatedName}</strong>
              </div>
            )}

            {/* View mode selector */}
            {!isSimulating && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs opacity-80 shrink-0">Visualizar como:</span>
                <Select value={viewMode} onValueChange={(v) => handleViewModeChange(v as ViewMode)}>
                  <SelectTrigger className="h-7 w-[140px] text-xs bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="administrador">Administrador</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="capataz">Capataz</SelectItem>
                  </SelectContent>
                </Select>

                {viewMode === "gerente" && (
                  <Select value={selectedGerenteId} onValueChange={setSelectedGerenteId}>
                    <SelectTrigger className="h-7 w-[180px] text-xs bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                      <SelectValue placeholder="Selecione o gerente" />
                    </SelectTrigger>
                    <SelectContent>
                      {gerentes.map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {viewMode === "capataz" && (
                  <Select value={selectedCapatazId} onValueChange={setSelectedCapatazId}>
                    <SelectTrigger className="h-7 w-[180px] text-xs bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                      <SelectValue placeholder="Selecione o capataz" />
                    </SelectTrigger>
                    <SelectContent>
                      {capatazes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </header>

          {/* Content */}
          {isSimulating && simulationOverride ? (
            <SimulationContext.Provider value={simulationOverride}>
              {viewMode === "gerente" ? <GerenteDashboard /> : <CapatazDashboard />}
            </SimulationContext.Provider>
          ) : (
            <main className="flex-1 overflow-auto p-4 md:p-6">
              <Outlet />
            </main>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}
