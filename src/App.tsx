import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { AuthProvider, useAuth, type UserRole } from "@/hooks/useAuth";
import Login from "./pages/Login";
import AdminLayout from "./pages/AdminLayout";
import AdminDashboard from "./pages/AdminDashboard";
import FazendasPage from "./pages/FazendasPage";
import FazendaDetailPage from "./pages/FazendaDetailPage";
import RetiroDetailPage from "./pages/RetiroDetailPage";
import PastoDetailPage from "./pages/PastoDetailPage";
import GerenteDashboard from "./pages/GerenteDashboard";
import CapatazDashboard from "./pages/CapatazDashboard";
import GerentesPage from "./pages/GerentesPage";
import CapatazesPage from "./pages/CapatazesPage";
import QrCodesPage from "./pages/QrCodesPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center animate-pulse">
      <span className="text-xl font-extrabold text-secondary">C</span>
    </div>
  </div>
);

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: UserRole[] }) {
  const { user, role, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center space-y-3">
          <p className="text-destructive font-semibold text-lg">Usuário sem perfil configurado</p>
          <p className="text-muted-foreground text-sm">Contate o administrador para vincular seu acesso.</p>
          <Button variant="outline" onClick={() => { import("@/integrations/supabase/client").then(m => m.supabase.auth.signOut()); }}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function RoleRedirect() {
  const { role, loading } = useAuth();
  if (loading) return null;

  switch (role) {
    case "administrador":
      return <Navigate to="/admin" replace />;
    case "gerente":
      return <Navigate to="/gerente" replace />;
    case "capataz":
      return <Navigate to="/capataz" replace />;
    default:
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="text-center space-y-3">
            <p className="text-destructive font-semibold text-lg">Usuário sem perfil configurado</p>
            <p className="text-muted-foreground text-sm">Contate o administrador para vincular seu acesso.</p>
            <Button variant="outline" onClick={() => { import("@/integrations/supabase/client").then(m => m.supabase.auth.signOut()); }}>
              Sair
            </Button>
          </div>
        </div>
      );
  }
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/" element={<ProtectedRoute><RoleRedirect /></ProtectedRoute>} />

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={["administrador"]}><AdminLayout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="fazendas" element={<FazendasPage />} />
              <Route path="fazendas/:fazendaId" element={<FazendaDetailPage />} />
              <Route path="fazendas/:fazendaId/retiros/:retiroId" element={<RetiroDetailPage />} />
              <Route path="fazendas/:fazendaId/retiros/:retiroId/pastos/:pastoId" element={<PastoDetailPage />} />
              <Route path="gerentes" element={<GerentesPage />} />
              <Route path="capatazes" element={<CapatazesPage />} />
            </Route>

            {/* Gerente */}
            <Route path="/gerente" element={<ProtectedRoute allowedRoles={["gerente"]}><GerenteDashboard /></ProtectedRoute>} />

            {/* Capataz */}
            <Route path="/capataz" element={<ProtectedRoute allowedRoles={["capataz"]}><CapatazDashboard /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
