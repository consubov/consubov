import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, RefreshCw, CheckCircle2, WifiOff } from "lucide-react";
import { getPendingVisitaDebugInfos, type PendingVisitaDebugInfo, useSyncStatus } from "@/lib/consultorOffline/useSyncStatus";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/consultorOffline/network";
import { getPhotoFailures, retryQueuedPhoto } from "@/lib/consultorOffline/photoQueue";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Props {
  className?: string;
  compact?: boolean;
}

/**
 * Botão fixo de sincronização — sempre visível.
 * Verde quando há pendências (habilitado) ou opaco quando nada pendente (desabilitado).
 * Auto-sincroniza em segundo plano ao detectar internet; o clique força/repete.
 */
export default function SyncBadge({ className, compact }: Props) {
  const { pending, photoPending, mutPending, photoFailures, syncing, syncNow } = useSyncStatus();
  const [showDone, setShowDone] = useState(false);
  const [wasPending, setWasPending] = useState(false);
  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugItems, setDebugItems] = useState<PendingVisitaDebugInfo[]>([]);

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

  const handleSync = async () => {
    try {
      await syncNow();
      const failures = await getPhotoFailures();
      if (failures.length > 0) {
        const first = failures[0];
        toast.error(`${failures.length} foto(s) com falha. ${first.label}: ${first.lastError} (${first.mime}, ${first.sizeLabel}).`, {
          action: { label: `Reenviar ${first.ordem}`, onClick: () => void retryQueuedPhoto(first.localId) },
        });
      }
    } catch (err) {
      const motivo = getErrorMessage(err);
      toast.error(`Não foi possível sincronizar. ${motivo}. Tentar novamente?`, {
        action: { label: "Tentar novamente", onClick: () => void handleSync() },
      });
    }
  };

  const loadDebugItems = async () => {
    setDebugLoading(true);
    try {
      setDebugItems(await getPendingVisitaDebugInfos({ includeDeleted: true }));
    } catch (err) {
      toast.error(`Erro ao ler fila local: ${getErrorMessage(err)}`);
    } finally {
      setDebugLoading(false);
    }
  };

  const openDebug = () => {
    setDebugOpen(true);
    void loadDebugItems();
  };

  // Sempre visível: mesmo durante o drain, mostrar progresso para o usuário
  // acompanhar quantas visitas estão sendo sincronizadas.

  const label = (() => {
    if (syncing) {
      const total = pending || 1;
      return `Sincronizando… ${total} visita${total === 1 ? "" : "s"} pendente${total === 1 ? "" : "s"}`;
    }
    if (hasPhotoFailures) return `${photoFailures.length} foto${photoFailures.length === 1 ? "" : "s"} com falha`;
    if (!online && hasPending) return `Sem conexão · ${pending} visita${pending === 1 ? "" : "s"} pendente${pending === 1 ? "" : "s"}`;
    if (hasPending) return `Sincronizar (${pending} visita${pending === 1 ? "" : "s"} pendente${pending === 1 ? "" : "s"})`;
    if (showDone) return "Sincronização concluída ✓";
    return "Tudo sincronizado";
  })();

  const Icon = syncing
    ? Loader2
    : hasPhotoFailures
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

      {!compact && (
        <Button type="button" variant="ghost" size="sm" onClick={openDebug} className="w-full h-8 text-xs text-muted-foreground">
          Ver fila de sincronização
        </Button>
      )}

      <Dialog open={debugOpen} onOpenChange={setDebugOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Fila de sincronização</DialogTitle>
            <DialogDescription>
              Itens locais detectados no Consultor. Registros excluídos são mostrados para diagnóstico, mas não entram na contagem do badge.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{pending} visita(s) contada(s) · {mutPending} alteração(ões) · {photoPending} foto(s)</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadDebugItems()} disabled={debugLoading}>
              {debugLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Atualizar"}
            </Button>
          </div>
          <div className="overflow-y-auto space-y-2 pr-1">
            {debugLoading && debugItems.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lendo fila local…
              </div>
            ) : debugItems.length === 0 ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">Nenhum item na fila local.</div>
            ) : debugItems.map((item) => (
              <div key={item.visitaId} className="rounded-md border p-3 space-y-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">{item.fazenda}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.tipo} · {item.data ? new Date(item.data).toLocaleString("pt-BR") : "data não identificada"}
                    </div>
                  </div>
                  <Badge variant={item.deleted ? "destructive" : "secondary"} className="shrink-0">
                    {item.deleted ? "Excluída · ignorada" : "Contada"}
                  </Badge>
                </div>
                {item.deletedAt && <div className="text-xs text-destructive">deleted_at: {item.deletedAt}</div>}
                <div className="grid gap-1 text-xs text-muted-foreground">
                  <div>ID: <span className="font-mono break-all">{item.visitaId}</span></div>
                  <div>Alterações: {item.mutationTables.length ? item.mutationTables.join(", ") : "nenhuma"}</div>
                  <div>Fotos: {item.photoParents.length ? item.photoParents.join(", ") : "nenhuma"}</div>
                  {item.photoErrors.length > 0 && <div className="text-destructive">Falhas: {item.photoErrors.join("; ")}</div>}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
