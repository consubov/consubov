import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertCircle, CloudOff, WifiOff } from "lucide-react";
import { useSyncStatus } from "@/lib/consultorOffline/useSyncStatus";
import SyncQueueDialog from "./SyncQueueDialog";
import { cn } from "@/lib/utils";

/**
 * Ícone discreto de status de sincronização, para o cabeçalho.
 * Ao tocar, abre a fila de sincronização.
 */
export default function SyncHeaderIndicator() {
  const { pending, mutPending, photoPending, photoFailures, syncing } = useSyncStatus();
  const [open, setOpen] = useState(false);

  const hasPending = pending > 0;
  const hasFailures = photoFailures.length > 0;
  const online = typeof navigator === "undefined" ? true : navigator.onLine;

  const Icon = syncing
    ? Loader2
    : hasFailures
      ? AlertCircle
      : !online && hasPending
        ? WifiOff
        : hasPending
          ? CloudOff
          : CheckCircle2;

  const color = hasFailures || (!online && hasPending)
    ? "text-red-200"
    : hasPending
      ? "text-yellow-200"
      : "text-green-300";

  const label = syncing
    ? "Sincronizando"
    : hasFailures
      ? `${photoFailures.length} foto(s) com falha`
      : hasPending
        ? `${pending} pendente(s)`
        : "Tudo sincronizado";

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="text-primary-foreground hover:bg-white/10"
        title={label}
        aria-label={`Sincronização: ${label}`}
      >
        <Icon className={cn("w-4 h-4", color, syncing && "animate-spin")} />
      </Button>
      <SyncQueueDialog
        open={open}
        onOpenChange={setOpen}
        pending={pending}
        mutPending={mutPending}
        photoPending={photoPending}
      />
    </>
  );
}
