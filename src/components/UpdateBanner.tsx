import { useSWUpdate } from "@/lib/swRegistration";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";
import { useState } from "react";

export function UpdateBanner() {
  const { updateAvailable, applyUpdate } = useSWUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="bg-secondary text-secondary-foreground px-4 py-2 flex items-center justify-between text-sm font-medium z-50">
      <span>Nova versão disponível — Toque para atualizar</span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={applyUpdate} className="gap-1 text-xs h-7">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setDismissed(true)} className="h-7 w-7">
          <X className="w-3 h-3" />
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
