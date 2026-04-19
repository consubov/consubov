import { CheckCircle2, CloudOff, Loader2, AlertTriangle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SyncEngineState } from "@/hooks/useSyncEngine";

interface SyncStatusBannerProps extends SyncEngineState {
  onRetry?: () => void;
  onLoginAgain?: () => void;
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/**
 * Always-visible band of sync status. Never hides errors silently.
 *  - red: pending records / offline
 *  - yellow: syncing (with spinner + retry counter when applicable)
 *  - green: synced + last time
 *  - destructive: needs login again
 */
export function SyncStatusBanner({
  status,
  pendingCount,
  lastSyncedAt,
  retryAttempt,
  errorMessage,
  onRetry,
  onLoginAgain,
}: SyncStatusBannerProps) {
  // Auth required → blocking action
  if (status === "auth-required") {
    return (
      <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
        <LogIn className="w-4 h-4 shrink-0" />
        <span className="flex-1 font-medium">Faça login novamente para sincronizar</span>
        {onLoginAgain && (
          <Button size="sm" variant="destructive" onClick={onLoginAgain} className="h-7 text-xs">
            Entrar
          </Button>
        )}
      </div>
    );
  }

  if (status === "syncing") {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-900 dark:text-yellow-200 rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
        <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
        <span className="flex-1 font-medium">
          Sincronizando…
          {retryAttempt > 0 && ` (tentativa ${retryAttempt})`}
        </span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 flex items-start gap-2 text-sm">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">
            Falha ao sincronizar
            {retryAttempt > 0 && ` — tentativa ${retryAttempt}`}
          </p>
          {errorMessage && (
            <p className="text-xs opacity-80 break-words mt-0.5">{errorMessage}</p>
          )}
          {pendingCount > 0 && (
            <p className="text-xs mt-0.5">{pendingCount} registro(s) pendente(s)</p>
          )}
        </div>
        {onRetry && (
          <Button size="sm" variant="destructive" onClick={onRetry} className="h-7 text-xs shrink-0">
            Tentar
          </Button>
        )}
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
        <CloudOff className="w-4 h-4 shrink-0" />
        <span className="flex-1 font-medium">
          {pendingCount} registro{pendingCount === 1 ? "" : "s"} pendente{pendingCount === 1 ? "" : "s"} de sync
        </span>
        {onRetry && (
          <Button size="sm" variant="destructive" onClick={onRetry} className="h-7 text-xs">
            Sincronizar
          </Button>
        )}
      </div>
    );
  }

  if (status === "success" || lastSyncedAt) {
    return (
      <div className="bg-primary/10 border border-primary/20 text-primary rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span className="flex-1 font-medium">
          Sincronizado{lastSyncedAt ? ` às ${formatTime(lastSyncedAt)}` : ""}
        </span>
      </div>
    );
  }

  return null;
}

export default SyncStatusBanner;
