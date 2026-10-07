/**
 * CapacitorConnectivityProvider — FASE 6.2
 * Contrato: apps/web/src/platform/contracts/index.ts :: ConnectivityProvider
 *   interface ConnectivityProvider { isOnline(): boolean }   // SÍNCRONO
 * Plugin: @capacitor/network
 *
 * O contrato Web é síncrono, então este adapter mantém um snapshot local
 * atualizado por listener (`Network.addListener("networkStatusChange")`) e
 * responde isOnline() de forma síncrona. O estado inicial é assumido online
 * (degradação segura: o app não bloqueia operação por falta de plugin) e é
 * corrigido assim que o primeiro status do plugin chega.
 */

export interface ConnectivityProvider {
  isOnline(): boolean;
}

export function createCapacitorConnectivityProvider(
  onDegrade?: (reason: string) => void,
): ConnectivityProvider {
  let online = true; // default seguro; corrigido pelo listener abaixo

  void (async () => {
    try {
      const mod = await import("@capacitor/network").catch(() => null);
      if (!mod?.Network) return; // Web fallback: mantém default
      const status = await mod.Network.getStatus();
      online = status?.connected !== false;
      if (typeof mod.Network.addListener === "function") {
        await mod.Network.addListener("networkStatusChange", (s: { connected?: boolean }) => {
          online = s?.connected !== false;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onDegrade?.(msg);
      // Mantém default online — app não bloqueia por falha de plugin.
    }
  })();

  return {
    isOnline(): boolean {
      return online;
    },
  };
}