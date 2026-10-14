import { GerenteFabricaGuard } from "@/hooks/useGerenteTemFabrica";
import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import PesagemEmAndamentoPrompt from "@/components/maisarrobas/PesagemEmAndamentoPrompt";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { PainelPeriodoProvider } from "@/hooks/usePainelPeriodo";
import { AuthProvider, useAuth, type UserRole } from "@/hooks/useAuth";
import Login from "./pages/Login";
const RecuperarSenhaPage = lazy(() => import("./pages/RecuperarSenhaPage"));
const RedefinirSenhaPage = lazy(() => import("./pages/RedefinirSenhaPage"));
const AdminLayout = lazy(() => import("./pages/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const FazendasPage = lazy(() => import("./pages/FazendasPage"));
const FazendaDetailPage = lazy(() => import("./pages/FazendaDetailPage"));
const RetiroDetailPage = lazy(() => import("./pages/RetiroDetailPage"));
const PastoDetailPage = lazy(() => import("./pages/PastoDetailPage"));
const GerenteDashboard = lazy(() => import("./pages/GerenteDashboard"));
const CapatazRoute = lazy(() => import("./pages/CapatazRoute"));
const GerentesPage = lazy(() => import("./pages/GerentesPage"));
const CapatazesPage = lazy(() => import("./pages/CapatazesPage"));
const QrCodesPage = lazy(() => import("./pages/QrCodesPage"));
const ProdutosPage = lazy(() => import("./pages/ProdutosPage"));
const LancamentoManualPage = lazy(() => import("./pages/LancamentoManualPage"));
const ConfiguracoesGeraisPage = lazy(() => import("./pages/ConfiguracoesGeraisPage"));
const NotificacoesPage = lazy(() => import("./pages/NotificacoesPage"));
const LandingPageConfigPage = lazy(() => import("./pages/LandingPageConfigPage"));
const PainelInteligenciaPage = lazy(() => import("./pages/PainelInteligenciaPage"));
const CiclosPage = lazy(() => import("./pages/CiclosPage"));
const AdminFazendaPainelPage = lazy(() => import("./pages/AdminFazendaPainelPage"));
const MapaFazendaPage = lazy(() => import("./pages/MapaFazendaPage"));
const AdminRetiroPainelPage = lazy(() => import("./pages/AdminRetiroPainelPage"));
const EscritoriosPage = lazy(() => import("./pages/EscritoriosPage"));
const AuditoriaConfigPage = lazy(() => import("./pages/AuditoriaConfigPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const RelattoLandingPage = lazy(() => import("./pages/RelattoLandingPage"));

const EscritorioLayout = lazy(() => import("./pages/EscritorioLayout"));
const TransferenciaRetiroPage = lazy(() => import("./pages/TransferenciaRetiroPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const RecuperarDadosPage = lazy(() => import("./pages/RecuperarDadosPage"));
const FabricasPage = lazy(() => import("./pages/FabricasPage"));
const FabricaDetailPage = lazy(() => import("./pages/FabricaDetailPage"));
const OperadoresFabricaPage = lazy(() => import("./pages/OperadoresFabricaPage"));
const MateriasPrimasPage = lazy(() => import("./pages/MateriasPrimasPage"));
const EntradaMateriasPrimasPage = lazy(() => import("./pages/EntradaMateriasPrimasPage"));
const GerenteProdutosPage = lazy(() => import("./pages/GerenteProdutosPage"));
const GerenteAuditoriaFotosPage = lazy(() => import("./pages/GerenteAuditoriaFotosPage"));
const GerenteGmdPage = lazy(() => import("./pages/GerenteGmdPage"));
const GerentePrevisaoAbatePage = lazy(() => import("./pages/GerentePrevisaoAbatePage"));
const FabricaDashboard = lazy(() => import("./pages/FabricaDashboard"));
const ConferenciaPage = lazy(() => import("./pages/ConferenciaPage"));
const ConsultoresPage = lazy(() => import("./pages/ConsultoresPage"));
const PesadoresPage = lazy(() => import("./pages/PesadoresPage"));
const ConsultorLayout = lazy(() => import("./pages/ConsultorLayout"));
const ConsultorFazendasPage = lazy(() => import("./pages/ConsultorFazendasPage"));
const ConsultorFazendaDetalhePage = lazy(() => import("./pages/ConsultorFazendaDetalhePage"));
const VisitaTecnicaPage = lazy(() => import("./pages/VisitaTecnicaPage"));
const RevisaoVisitaPage = lazy(() => import("./pages/RevisaoVisitaPage"));
const ConsultorHistoricoPage = lazy(() => import("./pages/ConsultorHistoricoPage"));
const ConsultorPainelPage = lazy(() => import("./pages/ConsultorPainelPage"));
const ConsultorDespesasPage = lazy(() => import("./pages/ConsultorDespesasPage"));
const ConsultorConfiguracoesPage = lazy(() => import("./pages/ConsultorConfiguracoesPage"));

const FormulasSistemaPage = lazy(() => import("./pages/FormulasSistemaPage"));
const AdminPremiacaoPage = lazy(() => import("./pages/AdminPremiacaoPage"));
const PesadorLayout = lazy(() => import("./pages/PesadorLayout"));
const PesadorDashboard = lazy(() => import("./pages/PesadorDashboard"));
const PesadorClientesPage = lazy(() => import("./pages/PesadorClientesPage"));
const PesadorPesagemPage = lazy(() => import("./pages/PesadorPesagemPage"));
const PesadorPesagemNovoPage = lazy(() => import("./pages/PesadorPesagemNovoPage"));
const PesadorPesagemExecPage = lazy(() => import("./pages/PesadorPesagemExecPage"));
const PesadorPesagemResumoPage = lazy(() => import("./pages/PesadorPesagemResumoPage"));
const PecuaristaLayout = lazy(() => import("./pages/PecuaristaLayout"));
const PecuaristaDashboard = lazy(() => import("./pages/PecuaristaDashboard"));
const PecuaristaFazendasPage = lazy(() => import("./pages/PecuaristaFazendasPage"));
const PecuaristaFazendaDetalhePage = lazy(() => import("./pages/PecuaristaFazendaDetalhePage"));
const PecuaristaLoteDetalhePage = lazy(() => import("./pages/PecuaristaLoteDetalhePage"));
const PecuaristaPesagemExecPage = lazy(() => import("./pages/PecuaristaPesagemExecPage"));
const PecuaristaPesagemResumoPage = lazy(() => import("./pages/PecuaristaPesagemResumoPage"));
const PecuaristaApartacaoPage = lazy(() => import("./pages/PecuaristaApartacaoPage"));
const PecuaristaApartacaoResumoPage = lazy(() => import("./pages/PecuaristaApartacaoResumoPage"));
const PecuaristaHistoricoPage = lazy(() => import("./pages/PecuaristaHistoricoPage"));
const PecuaristaBuscarAnimalPage = lazy(() => import("./pages/PecuaristaBuscarAnimalPage"));
const SyncVetLayout = lazy(() => import("./pages/SyncVetLayout"));
const SyncVetEmpresaPage = lazy(() => import("./pages/SyncVetEmpresaPage"));
const SyncVetEquipePage = lazy(() => import("./pages/SyncVetEquipePage"));
const SyncVetFazendasPage = lazy(() => import("./pages/SyncVetFazendasPage"));
const SyncVetFazendaDetalhePage = lazy(() => import("./pages/SyncVetFazendaDetalhePage"));
const SyncVetLoteDetalhePage = lazy(() => import("./pages/SyncVetLoteDetalhePage"));
const SyncVetMedicamentosPage = lazy(() => import("./pages/SyncVetMedicamentosPage"));
const SyncVetSemenPage = lazy(() => import("./pages/SyncVetSemenPage"));
const SyncVetProtocolosPage = lazy(() => import("./pages/SyncVetProtocolosPage"));
const SyncVetProtocoloDetalhePage = lazy(() => import("./pages/SyncVetProtocoloDetalhePage"));
const SyncVetEstacaoDetalhePage = lazy(() => import("./pages/SyncVetEstacaoDetalhePage"));
const SyncVetAgendaPage = lazy(() => import("./pages/SyncVetAgendaPage"));
const SyncVetPreferenciasPage = lazy(() => import("./pages/SyncVetPreferenciasPage"));
const SyncVetTrajetosPage = lazy(() => import("./pages/SyncVetTrajetosPage"));
const SyncVetPrecosPage = lazy(() => import("./pages/SyncVetPrecosPage"));
const SyncVetServicoNovoPage = lazy(() => import("./pages/SyncVetServicoNovoPage"));
const SyncVetContasPage = lazy(() => import("./pages/SyncVetContasPage"));
const SyncVetDashboardPage = lazy(() => import("./pages/SyncVetDashboardPage"));
const SyncVetPartosPage = lazy(() => import("./pages/SyncVetPartosPage"));
const SyncVetAuditoriaPage = lazy(() => import("./pages/SyncVetAuditoriaPage"));
const AdminSyncVetOnboardingPage = lazy(() => import("./pages/AdminSyncVetOnboardingPage"));
const SyncVetNovoManejoPage = lazy(() => import("./pages/SyncVetNovoManejoPage"));
const SyncVetManejoExecucaoPage = lazy(() => import("./pages/SyncVetManejoExecucaoPage"));
const SyncVetMeuPainelPage = lazy(() => import("./pages/SyncVetMeuPainelPage"));
import { ErrorBoundary } from "./components/ErrorBoundary";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { applyPwaProfile } from "@/lib/pwaManifest";
import { getRoleHomePath } from "@/lib/authNavigation";
import { RouteMemory } from "@/components/RouteMemory";

function PushNotificationsBootstrap() {
  usePushNotifications();
  return null;
}

function PwaProfileSync() {
  const location = useLocation();
  useEffect(() => {
    applyPwaProfile(location.pathname);
  }, [location.pathname]);
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
  const { user, role, loading, roleResolved, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  // Wait until role detection actually finished before deciding anything.
  if (allowedRoles && !roleResolved) {
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

  // Role detection completed and returned nothing.
  if (allowedRoles && !role) {
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
  const { role, loading, roleResolved, signOut } = useAuth();
  if (loading || !roleResolved) return <LoadingScreen />;

  const target = getRoleHomePath(role);
  if (target) return <Navigate to={target} replace />;

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
            <PwaProfileSync />
            <RouteMemory />
            <PushNotificationsBootstrap />
            <PesagemEmAndamentoPrompt />

            <Suspense fallback={<LoadingScreen />}>
              <Routes>

              <Route path="/" element={<LandingPage />} />
              <Route path="/relatto/*" element={<RelattoLandingPage />} />
              <Route path="/landing" element={<Navigate to="/" replace />} />

              <Route path="/index" element={<Navigate to="/" replace />} />
              <Route path="/login" element={<LoginRoute />} />
              <Route path="/recuperar-senha" element={<RecuperarSenhaPage />} />
              <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
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
                <Route path="pesadores" element={<PesadoresPage />} />
                <Route path="formulas-sistema" element={<FormulasSistemaPage />} />
                <Route path="premiacao" element={<AdminPremiacaoPage />} />
                <Route path="syncvet-onboarding" element={<AdminSyncVetOnboardingPage />} />
              </Route>

              <Route path="/gerente" element={<ProtectedRoute allowedRoles={["gerente"]}><GerenteDashboard /></ProtectedRoute>} />
              <Route path="/gerente/fazendas/:fazendaId/retiros/:retiroId/painel" element={<ProtectedRoute allowedRoles={["gerente"]}><LegacyRetiroPainelRedirect /></ProtectedRoute>} />
              <Route path="/gerente/materias-primas" element={<ProtectedRoute allowedRoles={["administrador", "gerente"]}><GerenteFabricaGuard><MateriasPrimasPage /></GerenteFabricaGuard></ProtectedRoute>} />
              <Route path="/gerente/entrada-materias-primas" element={<ProtectedRoute allowedRoles={["administrador", "gerente"]}><GerenteFabricaGuard><EntradaMateriasPrimasPage /></GerenteFabricaGuard></ProtectedRoute>} />
              <Route path="/gerente/produtos" element={<ProtectedRoute allowedRoles={["gerente"]}><GerenteProdutosPage /></ProtectedRoute>} />
              <Route path="/gerente/auditoria-fotos" element={<ProtectedRoute allowedRoles={["gerente"]}><GerenteAuditoriaFotosPage /></ProtectedRoute>} />
              <Route path="/gerente/gmd" element={<ProtectedRoute allowedRoles={["gerente"]}><GerenteGmdPage /></ProtectedRoute>} />
              <Route path="/gerente/previsao-abate" element={<ProtectedRoute allowedRoles={["gerente"]}><GerentePrevisaoAbatePage /></ProtectedRoute>} />
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
                <Route path="configuracoes" element={<ConsultorConfiguracoesPage />} />

              </Route>

              <Route path="/pesador" element={<ProtectedRoute allowedRoles={["pesador"]}><PesadorLayout /></ProtectedRoute>}>
                <Route index element={<PesadorDashboard />} />
                <Route path="clientes" element={<PesadorClientesPage />} />
                <Route path="pesagem" element={<PesadorPesagemPage />} />
                <Route path="pesagem/novo" element={<PesadorPesagemNovoPage />} />
                <Route path="pesagem/:pesagemId" element={<PesadorPesagemExecPage />} />
                <Route path="pesagem/:pesagemId/resumo" element={<PesadorPesagemResumoPage />} />
              </Route>

              <Route path="/pecuarista" element={<ProtectedRoute allowedRoles={["pecuarista"]}><PecuaristaLayout /></ProtectedRoute>}>
                <Route index element={<PecuaristaDashboard />} />
                <Route path="fazendas" element={<PecuaristaFazendasPage />} />
                <Route path="fazendas/:fazendaId" element={<PecuaristaFazendaDetalhePage />} />
                <Route path="fazendas/:fazendaId/lotes/:loteId" element={<PecuaristaLoteDetalhePage />} />
                <Route path="fazendas/:fazendaId/lotes/:loteId/buscar" element={<PecuaristaBuscarAnimalPage />} />
                <Route path="fazendas/:fazendaId/lotes/:loteId/pesagem/:pesagemId" element={<PecuaristaPesagemExecPage />} />
                <Route path="fazendas/:fazendaId/lotes/:loteId/pesagem/:pesagemId/resumo" element={<PecuaristaPesagemResumoPage />} />
                <Route path="fazendas/:fazendaId/lotes/:loteId/apartacao" element={<PecuaristaApartacaoPage />} />
                <Route path="fazendas/:fazendaId/lotes/:loteId/apartacao/:apartacaoId/resumo" element={<PecuaristaApartacaoResumoPage />} />
                <Route path="lotes" element={<PecuaristaHistoricoPage />} />
              </Route>


              <Route path="/syncvet" element={<ProtectedRoute allowedRoles={["syncvet"]}><SyncVetLayout /></ProtectedRoute>}>
                <Route index element={<SyncVetDashboardPage />} />
                <Route path="empresa" element={<SyncVetEmpresaPage />} />
                <Route path="equipe" element={<SyncVetEquipePage />} />
                <Route path="fazendas" element={<SyncVetFazendasPage />} />
                <Route path="fazendas/:fazendaId" element={<SyncVetFazendaDetalhePage />} />
                <Route path="fazendas/:fazendaId/lotes/:loteId" element={<SyncVetLoteDetalhePage />} />
                <Route path="fazendas/:fazendaId/novo-manejo" element={<SyncVetNovoManejoPage />} />
                <Route path="manejos/:manejoId/executar" element={<SyncVetManejoExecucaoPage />} />
                <Route path="fazendas/:fazendaId/estacoes/:estacaoId" element={<SyncVetEstacaoDetalhePage />} />
                <Route path="medicamentos" element={<SyncVetMedicamentosPage />} />
                <Route path="semen" element={<SyncVetSemenPage />} />
                <Route path="protocolos" element={<SyncVetProtocolosPage />} />
                <Route path="protocolos/:protocoloId" element={<SyncVetProtocoloDetalhePage />} />
                <Route path="agenda" element={<SyncVetAgendaPage />} />
                <Route path="partos" element={<SyncVetPartosPage />} />
                <Route path="preferencias" element={<SyncVetPreferenciasPage />} />
                <Route path="trajetos" element={<SyncVetTrajetosPage />} />
                <Route path="precos" element={<SyncVetPrecosPage />} />
                <Route path="servicos/novo" element={<SyncVetServicoNovoPage />} />
                <Route path="contas" element={<SyncVetContasPage />} />
                <Route path="auditoria" element={<SyncVetAuditoriaPage />} />
                <Route path="meu-painel" element={<SyncVetMeuPainelPage />} />
              </Route>

              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </PainelPeriodoProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
