import { Geolocation, Position } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import type { LocationProvider } from '@/platform/contracts';

/**
 * Implementação Capacitor da interface LocationProvider.
 *
 * Quando o código roda dentro do wrapper nativo (ex.: app Android/iOS),
 * usa o plugin @capacitor/geolocation para acessar o GPS do dispositivo.
 * Quando roda em um navegador padrão (durante desenvolvimento web),
 * delega para a Geolocation API nativa do browser, se disponível, para
 * preservar uma experiência de desenvolvimento consistente. Caso a API
 * não esteja disponível, retorna nulo de forma segura.
 */
export class CapacitorLocationProvider implements LocationProvider {
  private get isNative(): boolean {
    return Capacitor.isPluginAvailable('Geolocation');
  }

  async getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      if (this.isNative) {
        const loc: Position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
        });
        return {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
      }
      // Fallback para browser durante desenvolvimento
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              resolve({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              });
            },
            () => resolve(null),
            { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 },
          );
        });
      }
      return null;
    } catch {
      // Permissão negada ou erro de hardware: degrade graciosamente
      return null;
    }
  }
}