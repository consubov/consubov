import { LocalizedText } from "@/components/i18n/LocalizedText";
import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

const NotFound = () => {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground"><LocalizedText source={"Ops! Página não encontrada"} /></p>
        <Link to={user ? "/app" : "/"} className="text-primary underline hover:text-primary/90">
          {user ? <LocalizedText source={"Voltar ao painel"} /> : <LocalizedText source={"Voltar para o início"} />}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
