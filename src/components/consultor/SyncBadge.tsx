import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle2, WifiOff } from "lucide-react";
import { useSyncStatus } from "@/lib/consultorOffline/useSyncStatus";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

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
  const { pending, photoPending, mutPending, syncing, syncNow } = useSyncStatus();
  const [showDone, setShowDone] = useState(false);
  const [wasPending, setWasPending] = useState(false);
  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);

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
  const disabled = syncing || !hasPending || !online;

  // Sempre visível: mesmo durante o drain, mostrar progresso para o usuário
  // acompanhar quantas visitas estão sendo sincronizadas.

  const label = (() => {
    if (syncing) {
      const total = pending || 1;
      return `Sincronizando… ${total} visita${total === 1 ? "" : "s"} pendente${total === 1 ? "" : "s"}`;
    }
    if (!online && hasPending) return `Sem conexão · ${pending} visita${pending === 1 ? "" : "s"} pendente${pending === 1 ? "" : "s"}`;
    if (hasPending) return `Sincronizar (${pending} visita${pending === 1 ? "" : "s"} pendente${pending === 1 ? "" : "s"})`;
    if (showDone) return "Sincronização concluída ✓";
    return "Tudo sincronizado";
  })();

  const Icon = syncing
    ? Loader2
    : !online && hasPending
      ? WifiOff
      : hasPending
        ? RefreshCw
        : CheckCircle2;

  return (
    <Button
      onClick={() => void syncNow()}
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
    </Button>
  );
}
