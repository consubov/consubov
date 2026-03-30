import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Login from "./pages/Login";
import AdminLayout from "./pages/AdminLayout";
import AdminDashboard from "./pages/AdminDashboard";
import FazendasPage from "./pages/FazendasPage";
import RetirosPage from "./pages/RetirosPage";
import PastosPage from "./pages/PastosPage";
import GerenteDashboard from "./pages/GerenteDashboard";
import CapatazDashboard from "./pages/CapatazDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center animate-pulse">
          <span className="text-xl font-extrabold text-secondary">C</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
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
      return <Navigate to="/admin" replace />;
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
            <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="fazendas" element={<FazendasPage />} />
              <Route path="retiros" element={<RetirosPage />} />
            </Route>

            {/* Gerente */}
            <Route path="/gerente" element={<ProtectedRoute><GerenteDashboard /></ProtectedRoute>} />

            {/* Capataz */}
            <Route path="/capataz" element={<ProtectedRoute><CapatazDashboard /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
