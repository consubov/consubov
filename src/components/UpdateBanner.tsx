import { useSWUpdate } from "@/lib/swRegistration";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

/**
 * Banner fixo no topo exibido automaticamente quando uma nova versão do app
 * está disponível. Não bloqueia o uso e funciona offline (UI puramente local).
 */
export function UpdateBanner() {
  const { updateAvailable, applyUpdate } = useSWUpdate();

  if (!updateAvailable) return null;

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
            Nova atualização disponível!
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => applyUpdate()}
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
