/**
 * CapacitorLocationProvider — FASE 6.4
 * Contrato: apps/web/src/platform/contracts/index.ts :: LocationProvider
 * Plugin: @capacitor/geolocation
 * Notas: getCurrentPosition() é read-only, não exige internet, respeita permissão
 * e degrada para null quando negada (6.3). accuracy/timestamp são expostos quando
 * o plugin fornece; o contrato Web permanece {latitude, longitude} | null — o
 * adapter nativo expõe o detalhe estendido via LocationReading opcional.
 */

export type LocationReading = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

export interface LocationProvider {
  getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null>;
  /** Extra nativo; não faz parte do contrato Web — usado apenas em testes/adapter nativo. */
  getReading?(): Promise<LocationReading | null>;
}

export function createCapacitorLocationProvider(): LocationProvider {
  return {
    async getCurrentPosition() {
      try {
        // Lazy import — funciona em Web (fallback) e nativo (plugin real).
        const mod = await import("@capacitor/geolocation").catch(() => null);
        if (!mod?.Geolocation) return null;
        const pos = await mod.Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10_000,
        });
        const { latitude, longitude } = pos.coords;
        if (typeof latitude !== "number" || typeof longitude !== "number") return null;
        return { latitude, longitude };
      } catch (err) {
        // Permissão negada ou GPS indisponível → degradação exigida em 6.3.
        const msg = err instanceof Error ? err.message : String(err);
        if (/denied|permission|not authorized/i.test(msg)) return null;
        // Outros erros também degradam, mas ficam rastreáveis em telemetry.
        console.warn("[CapacitorLocationProvider] getCurrentPosition degradado:", msg);
        return null;
      }
    },

    async getReading(): Promise<LocationReading | null> {
      try {
        const mod = await import("@capacitor/geolocation").catch(() => null);
        if (!mod?.Geolocation) return null;
        const pos = await mod.Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10_000,
        });
        return {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
          timestamp: pos.timestamp ?? Date.now(),
        };
      } catch {
        return null;
      }
    },
  };
}