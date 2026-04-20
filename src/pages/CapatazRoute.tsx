import { useEffect, useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
          Recarregar
        </Button>
      </div>
    </div>
  );
}

export default function CapatazRoute() {
  const [Dashboard, setDashboard] = useState<ComponentType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;
    let rafId: number | null = null;

    const loadDashboard = () => {
      timeoutId = window.setTimeout(async () => {
        try {
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

    if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
      rafId = window.requestAnimationFrame(loadDashboard);
    } else {
      loadDashboard();
    }

    return () => {
      cancelled = true;
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || window.location.pathname !== "/capataz") return;
    if (!("serviceWorker" in navigator)) return;

    const onceKey = "consubov-capataz-sw-reregister-v1";
    if (window.sessionStorage.getItem(onceKey)) return;

    let isPreview = false;
    try {
      isPreview =
        window.self !== window.top ||
        window.location.hostname.includes("id-preview--") ||
        window.location.hostname.includes("lovableproject.com");
    } catch {
      isPreview = true;
    }

    if (isPreview) return;

    window.sessionStorage.setItem(onceKey, "1");

    void (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        const registration = await navigator.serviceWorker.register("/sw.js");
        console.log("[CapatazRoute] service worker re-registered:", registration.scope);
      } catch (error) {
        console.warn("[CapatazRoute] service worker reset failed:", error);
      }
    })();
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
    <ErrorBoundary message="O painel do capataz encontrou um erro ao iniciar. Seus dados offline continuam preservados.">
      <Dashboard />
    </ErrorBoundary>
  );
}