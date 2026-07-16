import { Button } from "@/components/ui/button";
import { Loader2, CloudUpload, CheckCircle2, WifiOff } from "lucide-react";
import { useSyncStatus } from "@/lib/consultorOffline/useSyncStatus";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  compact?: boolean;
}

export default function SyncBadge({ className, compact }: Props) {
  const { pending, syncing, syncNow } = useSyncStatus();
  const [showDone, setShowDone] = useState(false);
  const [wasPending, setWasPending] = useState(false);

  useEffect(() => {
    if (pending > 0) setWasPending(true);
    if (pending === 0 && wasPending) {
      setShowDone(true);
      const t = setTimeout(() => setShowDone(false), 3000);
      return () => clearTimeout(t);
    }
  }, [pending, wasPending]);

  const online = typeof navigator === "undefined" ? true : navigator.onLine;

  if (pending === 0 && !showDone) return null;

  if (pending === 0 && showDone) {
    return (
      <div className={cn("flex items-center gap-2 rounded-md bg-primary/10 text-primary px-3 py-2 text-xs font-medium", className)}>
        <CheckCircle2 className="w-4 h-4" />
        Tudo sincronizado
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between gap-2 rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 px-3 py-2", className)}>
      <div className="flex items-center gap-2 min-w-0">
        {online ? (
          <CloudUpload className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0" />
        ) : (
          <WifiOff className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0" />
        )}
        <div className="text-xs text-amber-900 dark:text-amber-100 min-w-0">
          <div className="font-semibold">{pending} {pending === 1 ? "foto pendente" : "fotos pendentes"}</div>
          {!compact && (
            <div className="text-[11px] opacity-80 truncate">
              {online ? (syncing ? "Enviando…" : "Aguardando envio") : "Sem conexão — envia quando voltar"}
            </div>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-xs"
        disabled={syncing || !online}
        onClick={() => void syncNow()}
      >
        {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CloudUpload className="w-3 h-3" />}
        Sincronizar
      </Button>
    </div>
  );
}
