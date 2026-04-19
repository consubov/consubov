import { useEffect, useState } from "react";
import { AlertTriangle, HardDrive } from "lucide-react";
import { getStorageState, formatBytes, type StorageState } from "@/lib/storageProtection";

interface Props {
  /** Refresh interval in ms (default 60s) */
  refreshMs?: number;
  /** Show even when everything is fine (default false — only renders on warning or denied persist) */
  alwaysShow?: boolean;
  className?: string;
}

/**
 * Compact banner that warns the capataz when:
 *   - Persistent storage was DENIED by the browser
 *   - IndexedDB usage > 70% of quota
 * Otherwise renders nothing (unless `alwaysShow` is true).
 */
export function StorageStatusBanner({ refreshMs = 60_000, alwaysShow = false, className }: Props) {
  const [state, setState] = useState<StorageState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const s = await getStorageState();
      if (!cancelled) setState(s);
    };
    void tick();
    const id = window.setInterval(tick, refreshMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [refreshMs]);

  if (!state) return null;

  const denied = state.persisted === false;
  const overQuota = state.warning;

  if (!denied && !overQuota && !alwaysShow) return null;

  if (denied) {
    return (
      <div
        className={`bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 flex items-start gap-2 text-xs ${className ?? ""}`}
        role="status"
      >
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">Atenção: armazenamento não está protegido</p>
          <p className="opacity-80 mt-0.5">
            Ative o armazenamento persistente nas configurações do navegador para proteger seus dados offline.
          </p>
        </div>
      </div>
    );
  }

  if (overQuota) {
    return (
      <div
        className={`bg-secondary/30 border border-secondary text-secondary-foreground rounded-lg px-3 py-2 flex items-start gap-2 text-xs ${className ?? ""}`}
        role="status"
      >
        <HardDrive className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">
            Armazenamento {Math.round((state.usagePercent ?? 0) * 100)}% cheio
          </p>
          <p className="opacity-80 mt-0.5">
            {formatBytes(state.usageBytes)} de {formatBytes(state.quotaBytes)}. Sincronize logo para liberar espaço.
          </p>
        </div>
      </div>
    );
  }

  // alwaysShow path
  return (
    <div className={`bg-muted/40 border border-border text-muted-foreground rounded-lg px-3 py-2 flex items-center gap-2 text-xs ${className ?? ""}`}>
      <HardDrive className="w-4 h-4 shrink-0" />
      <span>
        {formatBytes(state.usageBytes)} de {formatBytes(state.quotaBytes)} usados
      </span>
    </div>
  );
}

export default StorageStatusBanner;
