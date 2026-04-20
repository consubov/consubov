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
import CapatazRoute from "./CapatazRoute";
import EscritorioLayout from "./EscritorioLayout";

type ViewMode = "administrador" | "gerente" | "capataz" | "escritorio";

interface GerenteOption { id: string; nome: string; fazenda_id: string | null; }
interface CapatazOption { id: string; nome: string; retiro_id: string | null; }
interface EscritorioOption { id: string; nome: string; fazenda_id: string; }

const VIEW_MODE_KEY = "consubov:admin-view-mode";

function loadPersistedViewMode(): ViewMode {
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.mode) return parsed.mode;
    }
  } catch { /* ignore */ }
  return "administrador";
}

function persistViewMode(mode: ViewMode, selectedId: string) {
  try {
    localStorage.setItem(VIEW_MODE_KEY, JSON.stringify({ mode, selectedId }));
  } catch { /* ignore */ }
}

function loadPersistedSelectedId(): string {
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.selectedId ?? "";
    }
  } catch { /* ignore */ }
  return "";
}

function clearPersistedViewMode() {
  try { localStorage.removeItem(VIEW_MODE_KEY); } catch { /* ignore */ }
}

export default function AdminLayout() {
  const { signOut } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>(loadPersistedViewMode);
  const [gerentes, setGerentes] = useState<GerenteOption[]>([]);
  const [capatazes, setCapatazes] = useState<CapatazOption[]>([]);
  const [escritorios, setEscritorios] = useState<EscritorioOption[]>([]);
  const [selectedGerenteId, setSelectedGerenteId] = useState("");
  const [selectedCapatazId, setSelectedCapatazId] = useState("");
  const [selectedEscritorioId, setSelectedEscritorioId] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("gerentes").select("id, nome, fazenda_id").eq("ativo", true),
      supabase.from("capatazes").select("id, nome, retiro_id").eq("ativo", true),
      supabase.from("escritorios").select("id, nome, fazenda_id").eq("ativo", true),
    ]).then(([gRes, cRes, eRes]) => {
      setGerentes(gRes.data ?? []);
      setCapatazes(cRes.data ?? []);
      setEscritorios((eRes.data ?? []) as EscritorioOption[]);

      // Restore persisted selection
      const persistedId = loadPersistedSelectedId();
      const persistedMode = loadPersistedViewMode();
      if (persistedId && persistedMode !== "administrador") {
        if (persistedMode === "gerente" && gRes.data?.find(g => g.id === persistedId)) {
          setSelectedGerenteId(persistedId);
        } else if (persistedMode === "capataz" && cRes.data?.find(c => c.id === persistedId)) {
          setSelectedCapatazId(persistedId);
        } else if (persistedMode === "escritorio" && (eRes.data ?? []).find((e: any) => e.id === persistedId)) {
          setSelectedEscritorioId(persistedId);
        } else {
          // Persisted selection no longer valid
          clearPersistedViewMode();
          setViewMode("administrador");
        }
      }
    });
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setSelectedGerenteId("");
    setSelectedCapatazId("");
    setSelectedEscritorioId("");
    if (mode === "administrador") clearPersistedViewMode();
  };

  const handleSelectGerente = (id: string) => {
    setSelectedGerenteId(id);
    persistViewMode("gerente", id);
  };

  const handleSelectCapataz = (id: string) => {
    setSelectedCapatazId(id);
    persistViewMode("capataz", id);
  };

  const handleSelectEscritorio = (id: string) => {
    setSelectedEscritorioId(id);
    persistViewMode("escritorio", id);
  };

  const backToAdmin = useCallback(async () => {
    setViewMode("administrador");
    setSelectedGerenteId("");
    setSelectedCapatazId("");
    setSelectedEscritorioId("");
    clearPersistedViewMode();
  }, []);

  const selectedGerente = gerentes.find(g => g.id === selectedGerenteId);
  const selectedCapataz = capatazes.find(c => c.id === selectedCapatazId);
  const selectedEscritorio = escritorios.find(e => e.id === selectedEscritorioId);

  const isSimulating =
    (viewMode === "gerente" && !!selectedGerenteId) ||
    (viewMode === "capataz" && !!selectedCapatazId) ||
    (viewMode === "escritorio" && !!selectedEscritorioId);

  const simulatedName =
    viewMode === "gerente" ? selectedGerente?.nome :
    viewMode === "capataz" ? selectedCapataz?.nome :
    viewMode === "escritorio" ? selectedEscritorio?.nome : "";

  const viewModeLabel =
    viewMode === "gerente" ? "Gerente" :
    viewMode === "capataz" ? "Capataz" :
    viewMode === "escritorio" ? "Escritório" : "Admin";

  const simulationOverride = isSimulating ? {
    roleData: viewMode === "gerente"
      ? { role: "gerente" as const, roleId: selectedGerenteId, fazendaId: selectedGerente?.fazenda_id ?? null, retiroId: null }
      : viewMode === "capataz"
      ? { role: "capataz" as const, roleId: selectedCapatazId, fazendaId: null, retiroId: selectedCapataz?.retiro_id ?? null }
      : { role: "escritorio" as const, roleId: selectedEscritorioId, fazendaId: selectedEscritorio?.fazenda_id ?? null, retiroId: null },
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
                👁 Visualizando como {viewModeLabel}: <strong>{simulatedName}</strong>
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
                    <SelectItem value="escritorio">Escritório</SelectItem>
                  </SelectContent>
                </Select>

                {viewMode === "gerente" && (
                  <Select value={selectedGerenteId} onValueChange={handleSelectGerente}>
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
                  <Select value={selectedCapatazId} onValueChange={handleSelectCapataz}>
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

                {viewMode === "escritorio" && (
                  <Select value={selectedEscritorioId} onValueChange={handleSelectEscritorio}>
                    <SelectTrigger className="h-7 w-[180px] text-xs bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                      <SelectValue placeholder="Selecione o escritório" />
                    </SelectTrigger>
                    <SelectContent>
                      {escritorios.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
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
              {viewMode === "gerente" ? <GerenteDashboard /> :
               viewMode === "capataz" ? <CapatazRoute /> :
               <EscritorioLayout />}
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
