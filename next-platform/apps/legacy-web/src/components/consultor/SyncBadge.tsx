import { LocalizedText, useStaticUiText } from "@/components/i18n/LocalizedText";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, RefreshCw, CheckCircle2, WifiOff } from "lucide-react";
import { useSyncStatus } from "@/lib/consultorOffline/useSyncStatus";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/consultorOffline/network";
import { getPhotoFailures, retryQueuedPhoto } from "@/lib/consultorOffline/photoQueue";
import SyncQueueDialog from "./SyncQueueDialog";

interface Props {
  className?: string;
  compact?: boolean;
  /** Quando true, não renderiza nada no estado "tudo sincronizado". */
  hideWhenIdle?: boolean;
}

/**
 * Botão fixo de sincronização — sempre visível.
 * Verde quando há pendências (habilitado) ou opaco quando nada pendente (desabilitado).
 * Auto-sincroniza em segundo plano ao detectar internet; o clique força/repete.
 */
export default function SyncBadge({ className, compact, hideWhenIdle }: Props) {
  const uiText = useStaticUiText();
  const { pending, photoPending, mutPending, photoFailures, syncing, stuck, stuckMinutes, syncNow } = useSyncStatus();
  const [showDone, setShowDone] = useState(false);
  const [wasPending, setWasPending] = useState(false);
  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [debugOpen, setDebugOpen] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (pending > 0) setWasPending(true);
    if (pending === 0 && wasPending) {
      setShowDone(true);
      const t = setTimeout(() => setShowDone(false), 3000);
      return () => clearTimeout(t);
    }
  }, [pending, wasPending]);

  const hasPending = pending > 0;
  const hasPhotoFailures = photoFailures.length > 0;
  const disabled = syncing || (!hasPending && !hasPhotoFailures) || !online;

  const stuckAlerted = useRef(false);
  useEffect(() => {
    if (!stuck || stuckAlerted.current) return;
    stuckAlerted.current = true;
    toast.warning(`${uiText("Há ")}${pending} ${uiText(pending === 1 ? "visita" : "visitas")}${uiText(" sem sincronizar há ")}${stuckMinutes} ${uiText("min mesmo com internet. Abra a fila para ver o motivo técnico.")}`, {
      duration: 10000,
      action: { label: uiText("Ver fila"), onClick: () => setDebugOpen(true) },
    });
  }, [stuck, stuckMinutes, pending, uiText]);

  const handleSync = async () => {
    try {
      await syncNow();
      const failures = await getPhotoFailures();
      if (failures.length > 0) {
        const first = failures[0];
        toast.error(`${failures.length} ${uiText(failures.length === 1 ? "foto com falha. " : "fotos com falha. ")}${first.label}: ${first.lastError} (${first.mime}, ${first.sizeLabel}).`, {
          action: { label: `${uiText("Reenviar ")}${first.ordem}`, onClick: () => void retryQueuedPhoto(first.localId) },
        });
      }
    } catch (err) {
      const motivo = getErrorMessage(err);
      toast.error(`${uiText("Não foi possível sincronizar. ")}${motivo}${uiText(". Tentar novamente?")}`, {
        action: { label: uiText("Tentar novamente"), onClick: () => void handleSync() },
      });
    }
  };

  // Modo "hideWhenIdle": não renderiza banner grande quando não há nada a fazer.
  if (hideWhenIdle && !hasPending && !hasPhotoFailures && !syncing && !showDone) {
    return null;
  }

  const label = (() => {
    if (syncing) {
      const total = pending || 1;
      return `${uiText("Sincronizando… ")}${total} ${uiText(total === 1 ? "visita pendente" : "visitas pendentes")}`;
    }
    if (hasPhotoFailures) return `${photoFailures.length} ${uiText(photoFailures.length === 1 ? "foto com falha" : "fotos com falha")}`;
    if (!online && hasPending) return `${uiText("Sem conexão · ")}${pending} ${uiText(pending === 1 ? "visita pendente" : "visitas pendentes")}`;
    if (stuck) return `${uiText("Parado há ")}${stuckMinutes} ${uiText("min · toque para forçar envio")}`;
    if (hasPending) return `${uiText("Sincronizar (")}${pending} ${uiText(pending === 1 ? "visita pendente" : "visitas pendentes")})`;
    if (showDone) return uiText("Sincronização concluída ✓");
    return uiText("Tudo sincronizado");
  })();

  const Icon = syncing
    ? Loader2
    : hasPhotoFailures || stuck
      ? AlertCircle
    : !online && hasPending
      ? WifiOff
      : hasPending
        ? RefreshCw
        : CheckCircle2;

  return (
    <div className="space-y-2">
      <Button
        onClick={() => void handleSync()}
        disabled={disabled}
        className={cn(
          "w-full gap-2 font-semibold text-white shadow-sm",
          "bg-[#1F7A4D] hover:bg-[#166A42] disabled:opacity-60 disabled:text-white",
          "disabled:bg-[#1F7A4D]",
          className,
        )}
      >
        <Icon className={cn("w-4 h-4", syncing && "animate-spin")} />
        <span className="truncate">{label}</span>
        {hasPhotoFailures && !compact && (
          <span className="sr-only">
            {photoFailures.map(f => `${f.label}: ${f.lastError}`).join("; ")}
          </span>
        )}
      </Button>

      {!compact && !hideWhenIdle && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setDebugOpen(true)} className="w-full h-8 text-xs text-muted-foreground">
          <LocalizedText source={"Ver fila de sincronização"} /></Button>
      )}

      <SyncQueueDialog
        open={debugOpen}
        onOpenChange={setDebugOpen}
        pending={pending}
        mutPending={mutPending}
        photoPending={photoPending}
      />
    </div>
  );
}

