import { useEffect, useState } from "react";
import { useSWUpdate } from "@/lib/swRegistration";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { APP_VERSION } from "@/lib/appVersion";

declare const __APP_BUILD_VERSION__: string;

/**
 * Banner fixo no topo. Mostra quando:
 *  - existe um SW em waiting (updateAvailable do SW), OU
 *  - /version.json publicado é diferente do build atualmente carregado
 *    (cobre o caso de o SW ter aplicado a atualização sem o usuário perceber).
 */
export function UpdateBanner() {
  const { updateAvailable, applyUpdate } = useSWUpdate();
  const busy = useHasCriticalOperations();
  const [remoteMismatch, setRemoteMismatch] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string; appVersion?: string };
        if (cancelled) return;
        const remoteBuild = data.version ?? null;
        const remoteApp = data.appVersion ?? null;
        const mismatch =
          (remoteBuild && remoteBuild !== __APP_BUILD_VERSION__) ||
          (remoteApp && remoteApp !== APP_VERSION);
        setRemoteMismatch(mismatch ? (remoteApp ?? remoteBuild) : null);
      } catch {
        /* offline — ignore */
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

  const show = updateAvailable || remoteMismatch !== null;
  if (!show) return null;

  const handleClick = () => {
    if (updateAvailable) {
      applyUpdate();
    } else {
      // SW já se atualizou — basta recarregar buscando bypass do cache
      const url = new URL(window.location.href);
      url.searchParams.set("__v", String(Date.now()));
      window.location.replace(url.toString());
    }
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
