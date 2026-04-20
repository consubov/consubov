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

    // NOTE: We intentionally do NOT attach window 'error' / 'unhandledrejection'
    // listeners here. iOS Safari fires transient unhandled rejections when the
    // app resumes from background (aborted fetches, IndexedDB timeouts, etc.)
    // that are NOT fatal. Letting those flip loadError caused the spurious
    // "Falha ao abrir o painel" screen on resume. Real render crashes are
    // caught by the ErrorBoundary below; the dynamic import has its own catch.

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

    if ("requestAnimationFrame" in browserWindow) {
      rafId = browserWindow.requestAnimationFrame(loadDashboard);
    } else {
      loadDashboard();
    }

    return () => {
      cancelled = true;
      if (rafId !== null) browserWindow.cancelAnimationFrame(rafId);
      if (timeoutId !== null) browserWindow.clearTimeout(timeoutId);
    };
  }, []);

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
      autoResetOnVisibility
    >
      <Dashboard />
    </ErrorBoundary>
  );
}
