import { useEffect, useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { maybeUpdateActiveServiceWorker } from "@/lib/swRegistration";

function CapatazFallback({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center space-y-3">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button onClick={() => window.location.reload()} className="w-full">
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

export default function CapatazRoute() {
  const [Dashboard, setDashboard] = useState<ComponentType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const browserWindow = window;
    let cancelled = false;
    let timeoutId: number | null = null;
    let rafId: number | null = null;

    const handleWindowError = (event: ErrorEvent) => {
      console.error("[CapatazRoute] uncaught error:", event.error ?? event.message);
      if (!cancelled) {
        setLoadError("Erro ao carregar. Seus dados estão salvos.");
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("[CapatazRoute] unhandled rejection:", event.reason);
      event.preventDefault?.();
      if (!cancelled) {
        setLoadError("Erro ao carregar. Seus dados estão salvos.");
      }
    };

    const loadDashboard = () => {
      timeoutId = browserWindow.setTimeout(async () => {
        try {
          void maybeUpdateActiveServiceWorker();
          const module = await import("./CapatazDashboard");
          if (!cancelled) {
            setDashboard(() => module.default);
          }
        } catch (error) {
          console.error("[CapatazRoute] dashboard bootstrap failed:", error);
          if (!cancelled) {
            setLoadError("Erro ao iniciar o painel do capataz.");
          }
        }
      }, 0);
    };

    browserWindow.addEventListener("error", handleWindowError);
    browserWindow.addEventListener("unhandledrejection", handleUnhandledRejection);

    if ("requestAnimationFrame" in browserWindow) {
      rafId = browserWindow.requestAnimationFrame(loadDashboard);
    } else {
      loadDashboard();
    }

    return () => {
      cancelled = true;
      browserWindow.removeEventListener("error", handleWindowError);
      browserWindow.removeEventListener("unhandledrejection", handleUnhandledRejection);
      if (rafId !== null) browserWindow.cancelAnimationFrame(rafId);
      if (timeoutId !== null) browserWindow.clearTimeout(timeoutId);
    };
  }, []);

  // NOTE: Do NOT unregister/re-register the SW here. iOS Safari treats every
  // cold start as a "first load" and would loop: cleanup → re-register →
  // controllerchange → restart. The SW lifecycle is handled in registerSW().

  if (loadError) {
    return <CapatazFallback title="Falha ao abrir o painel" description={loadError} />;
  }

  if (!Dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center space-y-2">
          <p className="text-base font-medium text-foreground">Abrindo painel do capataz…</p>
          <p className="text-sm text-muted-foreground">Inicializando a tela com segurança.</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      title="Erro ao carregar"
      message="Seus dados estão salvos."
      retryLabel="Tentar novamente"
      showErrorDetails={false}
    >
      <Dashboard />
    </ErrorBoundary>
  );
}