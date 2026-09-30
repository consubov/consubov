/**
 * Redundant backup of all pending IndexedDB records to localStorage.
 * Survives IndexedDB corruption / eviction. Limited to ~5MB by browser
 * localStorage quota, which is enough for weeks of pending salgas.
 *
 * Also exposes an "export emergency JSON" helper so the capataz can ship
 * pending data over WhatsApp if all sync paths fail.
 */

import {
  getLancamentosPendentes,
  getObservacoesPendentes,
  getPesagensPendentes,
  getFecharMesPendente,
  getSyncErrors,
} from "@/lib/offlineDb";

const BACKUP_KEY = "pending_backup";
const BACKUP_AT_KEY = "pending_backup_at";

export interface PendingBackup {
  generatedAt: string;
  appVersion: string;
  userInfo?: {
    userId?: string | null;
    email?: string | null;
    retiroId?: string | null;
    retiroNome?: string | null;
    capatazNome?: string | null;
  };
  lancamentos: any[];
  observacoes: any[];
  pesagens: any[];
  fecharMes: any | null;
  syncErrors: any[];
}

export async function collectPendingBackup(userInfo?: PendingBackup["userInfo"]): Promise<PendingBackup> {
  const [lanc, obs, pes, fechar, errors] = await Promise.all([
    getLancamentosPendentes(),
    getObservacoesPendentes(),
    getPesagensPendentes(),
    getFecharMesPendente(),
    getSyncErrors(),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    appVersion: "consubov-pwa",
    userInfo,
    lancamentos: lanc,
    observacoes: obs,
    pesagens: pes,
    fecharMes: fechar,
    syncErrors: errors,
  };
}

/**
 * Mirror current pending records to localStorage. Trims base64 photo data
 * if the payload exceeds the localStorage budget, so we never throw.
 */
export async function backupPendingToLocalStorage(userInfo?: PendingBackup["userInfo"]): Promise<{
  ok: boolean;
  bytes: number;
  trimmed: boolean;
  error?: string;
}> {
  if (typeof window === "undefined") return { ok: false, bytes: 0, trimmed: false };
  try {
    const payload = await collectPendingBackup(userInfo);
    let json = JSON.stringify(payload);
    let trimmed = false;
    // localStorage budget is browser-dependent (~5MB). If we approach it,
    // strip large base64 photo URLs from the mirror (originals stay in IDB).
    if (json.length > 4_500_000) {
      const slim: PendingBackup = {
        ...payload,
        lancamentos: payload.lancamentos.map((l) => ({
          ...l,
          foto_auditoria_url: l?.foto_auditoria_url ? "[stripped]" : null,
          foto_cocho_url: l?.foto_cocho_url ? "[stripped]" : null,
          observacoes: Array.isArray(l?.observacoes)
            ? l.observacoes.map((o: any) => ({ ...o, foto_url: o?.foto_url ? "[stripped]" : null }))
            : [],
        })),
        observacoes: payload.observacoes.map((o) => ({
          ...o,
          foto_url: o?.foto_url ? "[stripped]" : null,
        })),
      };
      json = JSON.stringify(slim);
      trimmed = true;
    }
    window.localStorage.setItem(BACKUP_KEY, json);
    window.localStorage.setItem(BACKUP_AT_KEY, new Date().toISOString());
    return { ok: true, bytes: json.length, trimmed };
  } catch (err: any) {
    console.warn("[backupMirror] backup failed:", err);
    return { ok: false, bytes: 0, trimmed: false, error: err?.message };
  }
}

export function readBackupFromLocalStorage(): PendingBackup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingBackup;
  } catch {
    return null;
  }
}

export function getLastBackupAt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(BACKUP_AT_KEY);
  } catch {
    return null;
  }
}

/** Trigger a download of the current pending data as a JSON file. */
export async function downloadPendingBackup(userInfo?: PendingBackup["userInfo"]): Promise<{
  ok: boolean;
  count: number;
}> {
  const payload = await collectPendingBackup(userInfo);
  const totalCount =
    payload.lancamentos.length +
    payload.observacoes.length +
    payload.pesagens.length +
    (payload.fecharMes ? 1 : 0);

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const name = userInfo?.capatazNome?.replace(/\s+/g, "_") || "capataz";
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.href = url;
  a.download = `consubov_backup_${name}_${ts}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { ok: true, count: totalCount };
}

/** Periodic auto-backup. Returns the interval id so callers can clear it. */
export function startPeriodicBackup(
  userInfo?: PendingBackup["userInfo"],
  intervalMs = 30 * 60 * 1000,
): number | null {
  if (typeof window === "undefined") return null;
  // Run once immediately
  void backupPendingToLocalStorage(userInfo);
  const id = window.setInterval(() => {
    void backupPendingToLocalStorage(userInfo);
  }, intervalMs);
  return id;
}
