import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { PainelPeriodoProvider } from "@/hooks/usePainelPeriodo";
import { AuthProvider, useAuth, type UserRole } from "@/hooks/useAuth";
import Login from "./pages/Login";
import AdminLayout from "./pages/AdminLayout";
import AdminDashboard from "./pages/AdminDashboard";
import FazendasPage from "./pages/FazendasPage";
import FazendaDetailPage from "./pages/FazendaDetailPage";
import RetiroDetailPage from "./pages/RetiroDetailPage";
import PastoDetailPage from "./pages/PastoDetailPage";
import GerenteDashboard from "./pages/GerenteDashboard";
import CapatazRoute from "./pages/CapatazRoute";
import GerentesPage from "./pages/GerentesPage";
import CapatazesPage from "./pages/CapatazesPage";
import QrCodesPage from "./pages/QrCodesPage";
import ProdutosPage from "./pages/ProdutosPage";
import LancamentoManualPage from "./pages/LancamentoManualPage";
import ConfiguracoesGeraisPage from "./pages/ConfiguracoesGeraisPage";
import NotificacoesPage from "./pages/NotificacoesPage";
import LandingPageConfigPage from "./pages/LandingPageConfigPage";
import PainelInteligenciaPage from "./pages/PainelInteligenciaPage";
import CiclosPage from "./pages/CiclosPage";
import AdminFazendaPainelPage from "./pages/AdminFazendaPainelPage";
import MapaFazendaPage from "./pages/MapaFazendaPage";
import AdminRetiroPainelPage from "./pages/AdminRetiroPainelPage";
import EscritoriosPage from "./pages/EscritoriosPage";
import AuditoriaConfigPage from "./pages/AuditoriaConfigPage";
import LandingPage from "./pages/LandingPage";
import EscritorioLayout from "./pages/EscritorioLayout";
import TransferenciaRetiroPage from "./pages/TransferenciaRetiroPage";
import NotFound from "./pages/NotFound";
import RecuperarDadosPage from "./pages/RecuperarDadosPage";
import FabricasPage from "./pages/FabricasPage";
import FabricaDetailPage from "./pages/FabricaDetailPage";
import OperadoresFabricaPage from "./pages/OperadoresFabricaPage";
import MateriasPrimasPage from "./pages/MateriasPrimasPage";
import EntradaMateriasPrimasPage from "./pages/EntradaMateriasPrimasPage";
import FabricaDashboard from "./pages/FabricaDashboard";
import ConferenciaPage from "./pages/ConferenciaPage";
import ConsultoresPage from "./pages/ConsultoresPage";
import ConsultorLayout from "./pages/ConsultorLayout";
import ConsultorFazendasPage from "./pages/ConsultorFazendasPage";
import ConsultorFazendaDetalhePage from "./pages/ConsultorFazendaDetalhePage";
import VisitaTecnicaPage from "./pages/VisitaTecnicaPage";
import RevisaoVisitaPage from "./pages/RevisaoVisitaPage";
import ConsultorHistoricoPage from "./pages/ConsultorHistoricoPage";
import ConsultorPainelPage from "./pages/ConsultorPainelPage";
import ConsultorDespesasPage from "./pages/ConsultorDespesasPage";
import FormulasSistemaPage from "./pages/FormulasSistemaPage";
import PesadorLayout from "./pages/PesadorLayout";
import PesadorDashboard from "./pages/PesadorDashboard";
import PesadorClientesPage from "./pages/PesadorClientesPage";
import PesadorPesagemPage from "./pages/PesadorPesagemPage";
import PesadorPesagemNovoPage from "./pages/PesadorPesagemNovoPage";
import PesadorPesagemExecPage from "./pages/PesadorPesagemExecPage";
import PesadorPesagemResumoPage from "./pages/PesadorPesagemResumoPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { usePushNotifications } from "@/hooks/usePushNotifications";

function PushNotificationsBootstrap() {
  usePushNotifications();
  return null;
}


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: 1000,
      staleTime: 30000,
    },
  },
});

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center animate-pulse">
      <span className="text-xl font-extrabold text-secondary">C</span>
    </div>
  </div>
);

function LegacyRetiroPainelRedirect() {
  const { retiroId } = useParams<{ retiroId: string }>();
  const location = useLocation();

  if (!retiroId) {
    return <Navigate to="/app" replace />;
  }

  return <Navigate to={`/dashboard/retiro/${retiroId}${location.search}`} replace />;
}

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: UserRole[] }) {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [roleTimeout, setRoleTimeout] = useState(false);

  useEffect(() => {
    if (!loading && user && allowedRoles && !role) {
      const timer = setTimeout(() => setRoleTimeout(true), 3000);
      return () => clearTimeout(timer);
    }
    setRoleTimeout(false);
  }, [loading, user, role, allowedRoles]);

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  // While role is still being resolved, show loading briefly
  if (allowedRoles && !role && !roleTimeout) {
    return <LoadingScreen />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center space-y-3">
          <p className="text-destructive font-semibold text-lg">Acesso não autorizado</p>
          <p className="text-muted-foreground text-sm">Seu perfil não possui permissão para acessar esta área.</p>
          <Button variant="outline" onClick={() => navigate("/app", { replace: true })}>
            Voltar ao painel
          </Button>
        </div>
      </div>
    );
  }

  // Role never resolved — user has no profile.
  // When offline, never show the "sem perfil" error: the role detection
  // simply couldn't reach Supabase. Keep the loading screen so the cached
  // session can be restored silently when connectivity returns.
  if (allowedRoles && !role && roleTimeout) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return <LoadingScreen />;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center space-y-3">
          <p className="text-destructive font-semibold text-lg">Usuário sem perfil configurado</p>
          <p className="text-muted-foreground text-sm">Contate o administrador para vincular seu acesso.</p>
          <Button variant="outline" onClick={() => void signOut()}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function RoleRedirect() {
  const { role, loading, signOut } = useAuth();
  if (loading) return <LoadingScreen />;

  switch (role) {
    case "administrador":
      return <Navigate to="/admin" replace />;
    case "gerente":
      return <Navigate to="/gerente" replace />;
    case "capataz":
      return <Navigate to="/capataz" replace />;
    case "escritorio":
      return <Navigate to="/escritorio" replace />;
    case "operador_fabrica":
      return <Navigate to="/fabrica" replace />;
    case "consultor":
      return <Navigate to="/consultor" replace />;
    case "pesador":
      return <Navigate to="/pesador" replace />;
    default:
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return <LoadingScreen />;
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="text-center space-y-3">
            <p className="text-destructive font-semibold text-lg">Usuário sem perfil configurado</p>
            <p className="text-muted-foreground text-sm">Contate o administrador para vincular seu acesso.</p>
            <Button variant="outline" onClick={() => void signOut()}>
              Sair
            </Button>
          </div>
        </div>
      );
  }
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/app" replace />;
  return <Login />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PainelPeriodoProvider>
          <AuthProvider>
            <PushNotificationsBootstrap />
            <Routes>

              <Route path="/" element={<LandingPage />} />
              <Route path="/landing" element={<Navigate to="/" replace />} />
              <Route path="/index" element={<Navigate to="/" replace />} />
              <Route path="/login" element={<LoginRoute />} />
              <Route path="/app" element={<ProtectedRoute><RoleRedirect /></ProtectedRoute>} />
              <Route path="/conferencia" element={<ProtectedRoute allowedRoles={["administrador", "gerente"]}><ConferenciaPage /></ProtectedRoute>} />
              <Route path="/dashboard/retiro/:retiroId" element={<ProtectedRoute allowedRoles={["administrador", "gerente"]}><AdminRetiroPainelPage /></ProtectedRoute>} />
              <Route path="/mapa/retiro/:retiroId" element={<ProtectedRoute allowedRoles={["administrador", "gerente", "capataz"]}><MapaFazendaPage /></ProtectedRoute>} />

              <Route path="/admin" element={<ProtectedRoute allowedRoles={["administrador"]}><AdminLayout /></ProtectedRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="fazendas" element={<FazendasPage />} />
                <Route path="fazendas/:fazendaId" element={<FazendaDetailPage />} />
                <Route path="fazendas/:fazendaId/painel" element={<AdminFazendaPainelPage />} />
                <Route path="fazendas/:fazendaId/retiros/:retiroId/mapa" element={<MapaFazendaPage />} />
                <Route path="fazendas/:fazendaId/retiros/:retiroId" element={<RetiroDetailPage />} />
                <Route path="fazendas/:fazendaId/retiros/:retiroId/painel" element={<LegacyRetiroPainelRedirect />} />
                <Route path="fazendas/:fazendaId/retiros/:retiroId/pastos/:pastoId" element={<PastoDetailPage />} />
                <Route path="gerentes" element={<GerentesPage />} />
                <Route path="capatazes" element={<CapatazesPage />} />
                <Route path="escritorios" element={<EscritoriosPage />} />
                <Route path="produtos" element={<ProdutosPage />} />
                <Route path="qrcodes" element={<QrCodesPage />} />
                <Route path="lancamento-manual" element={<LancamentoManualPage />} />
                <Route path="configuracoes" element={<ConfiguracoesGeraisPage />} />
                <Route path="notificacoes" element={<NotificacoesPage />} />
                <Route path="landing-page" element={<LandingPageConfigPage />} />
                <Route path="ciclos" element={<CiclosPage />} />
                <Route path="inteligencia" element={<PainelInteligenciaPage />} />
                <Route path="auditoria" element={<AuditoriaConfigPage />} />
                <Route path="recuperar" element={<RecuperarDadosPage />} />
                <Route path="fabricas" element={<FabricasPage />} />
                <Route path="fabricas/:id" element={<FabricaDetailPage />} />
                <Route path="operadores-fabrica" element={<OperadoresFabricaPage />} />
                <Route path="materias-primas" element={<MateriasPrimasPage />} />
                <Route path="entrada-materias-primas" element={<EntradaMateriasPrimasPage />} />
                <Route path="consultores" element={<ConsultoresPage />} />
                <Route path="formulas-sistema" element={<FormulasSistemaPage />} />
              </Route>

              <Route path="/gerente" element={<ProtectedRoute allowedRoles={["gerente"]}><GerenteDashboard /></ProtectedRoute>} />
              <Route path="/gerente/fazendas/:fazendaId/retiros/:retiroId/painel" element={<ProtectedRoute allowedRoles={["gerente"]}><LegacyRetiroPainelRedirect /></ProtectedRoute>} />
              <Route path="/gerente/materias-primas" element={<ProtectedRoute allowedRoles={["administrador", "gerente"]}><MateriasPrimasPage /></ProtectedRoute>} />
              <Route path="/gerente/entrada-materias-primas" element={<ProtectedRoute allowedRoles={["administrador", "gerente"]}><EntradaMateriasPrimasPage /></ProtectedRoute>} />
              <Route path="/capataz" element={<ProtectedRoute allowedRoles={["capataz"]}><CapatazRoute /></ProtectedRoute>} />
              <Route path="/capataz/transferencia-retiro" element={<ProtectedRoute allowedRoles={["capataz", "administrador"]}><ErrorBoundary><TransferenciaRetiroPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/escritorio" element={<ProtectedRoute allowedRoles={["escritorio"]}><EscritorioLayout /></ProtectedRoute>} />
              <Route path="/fabrica" element={<ProtectedRoute allowedRoles={["operador_fabrica"]}><FabricaDashboard /></ProtectedRoute>} />

              <Route path="/consultor" element={<ProtectedRoute allowedRoles={["consultor"]}><ConsultorLayout /></ProtectedRoute>}>
                <Route index element={<ConsultorFazendasPage />} />
                <Route path="fazendas/:fazendaId" element={<ConsultorFazendaDetalhePage />} />
                <Route path="visitas/:visitaId" element={<VisitaTecnicaPage />} />
                <Route path="visitas/:visitaId/revisao" element={<RevisaoVisitaPage />} />
                <Route path="historico" element={<ConsultorHistoricoPage />} />
                <Route path="painel" element={<ConsultorPainelPage />} />
                <Route path="despesas" element={<ConsultorDespesasPage />} />
              </Route>

              <Route path="/pesador" element={<ProtectedRoute allowedRoles={["pesador"]}><PesadorLayout /></ProtectedRoute>}>
                <Route index element={<PesadorDashboard />} />
                <Route path="clientes" element={<PesadorClientesPage />} />
                <Route path="pesagem" element={<PesadorPesagemPage />} />
                <Route path="pesagem/novo" element={<PesadorPesagemNovoPage />} />
                <Route path="pesagem/:pesagemId" element={<PesadorPesagemExecPage />} />
                <Route path="pesagem/:pesagemId/resumo" element={<PesadorPesagemResumoPage />} />
              </Route>







              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </PainelPeriodoProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
