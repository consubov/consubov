import { useEffect, useState } from "react";
import { useSWUpdate } from "@/lib/swRegistration";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { APP_VERSION } from "@/lib/appVersion";
import { classifyPublishedRelease } from "@/lib/publishedUpdate";
import { useHasCriticalOperations } from "@/lib/criticalOperations";

declare const __APP_BUILD_VERSION__: string;

/**
 * Banner fixo no topo. Mostra quando:
 *  - /version.json comprova um build NOVO e uma versão do produto igual ou maior.
 *  Um SW waiting, ou um version.json diferente, não garante upgrade válido.
 *  Nunca anunciar/ativar versões mais antigas do que o app carregado.
 */
export function UpdateBanner() {
  const { applyUpdate } = useSWUpdate();
  const busy = useHasCriticalOperations();
  const [remoteMismatch, setRemoteMismatch] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setRemoteMismatch(null);
          return;
        }
        const data = (await res.json()) as { version?: string; appVersion?: string };
        if (cancelled) return;
        const status = classifyPublishedRelease(APP_VERSION, __APP_BUILD_VERSION__, data);
        setRemoteMismatch(status === "newer" && typeof data.appVersion === "string" ? data.appVersion : null);
      } catch {
        // Offline ou metadata inconsistente: nunca sugerir downgrade.
        if (!cancelled) setRemoteMismatch(null);
      }
    };
    void check();
    const onVis = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", check);
    const interval = window.setInterval(check, 60 * 1000);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", check);
      window.clearInterval(interval);
    };
  }, []);

  // Não interrompe o usuário no meio de uma operação crítica (visita aberta).
  const show = remoteMismatch !== null && !busy;
  if (!show) return null;

  const handleClick = () => {
    // A version.json mismatch alone does not prove the new worker is ready.
    // Use the same activation-safe path as an already waiting worker.
    applyUpdate();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[60] bg-card border-b border-border shadow-md"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <RefreshCw className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground truncate">
            Nova atualização disponível{remoteMismatch ? ` (v${remoteMismatch})` : ""}!
          </span>
        </div>
        <Button
          size="sm"
          onClick={handleClick}
          className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
        >
          Atualizar agora
        </Button>
      </div>
    </div>
  );
}

export function RefreshButton({ className = "" }: { className?: string }) {
  const { forceRefresh } = useSWUpdate();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={forceRefresh}
      className={`text-primary-foreground hover:bg-primary/80 ${className}`}
      title="Atualizar app"
    >
      <RefreshCw className="w-4 h-4" />
    </Button>
  );
}
