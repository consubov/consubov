/**
 * CapacitorQrScanner — FASE 6.5
 * Contrato: apps/web/src/platform/contracts/index.ts :: QrScanner
 * Plugin: @capacitor-community/barcode-scanner
 * Regras: decoder local sem internet; retorna identificador estável do recurso;
 * nunca coloca segredo/autorização dentro do QR; valida QR inválido/unknown.
 */

export interface QrScanner {
  scan(): Promise<string | null>;
}

export function createCapacitorQrScanner(): QrScanner {
  return {
    async scan(): Promise<string | null> {
      try {
        const mod = await import("@capacitor-community/barcode-scanner").catch(() => null);
        if (!mod?.BarcodeScanner) return null;

        // iOS/Android permission flow é interno ao plugin.
        const status = await mod.BarcodeScanner.checkPermission({ force: true });
        if (!status.granted) return null;

        // Evita duplicar lógica de permissão — 6.3 degrada para null.
        const result = await mod.BarcodeScanner.startScan();
        const raw = result?.content?.trim();
        if (!raw) return null;

        // Validação mínima: QR deve ser identificador estável (sem segredo inline).
        // Lookup real no SQLite fica em FASE 7; aqui apenas sanitiza o valor bruto.
        if (raw.length > 512) return null; // QR anormalmente grande
        if (/^(Bearer |sk_|service_role|eyJ)/i.test(raw)) return null; // segredo inline rejeitado
        return raw;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/denied|permission|cancel/i.test(msg)) return null;
        console.warn("[CapacitorQrScanner] scan degradado:", msg);
        return null;
      }
    },
  };
}