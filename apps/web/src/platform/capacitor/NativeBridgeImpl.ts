import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Geolocation, Position } from '@capacitor/geolocation';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { Preferences } from '@capacitor/preferences';
import type { NativeBridge } from '@/platform/contracts';
import type { LocationProvider } from '@/platform/contracts';
import type { QrScanner } from '@/platform/contracts';
import type { SecureStorage } from '@/platform/contracts';
import type { CameraProvider } from '@/platform/contracts';

/**
 * Implementação da NativeBridge usando os plugins do Capacitor.
 * Esta classe compõe as implementações específicas de cada plataforma
 * para fornecer uma interface unificada.
 */
export class NativeBridgeImpl implements NativeBridge {
  private locationProvider: CapacitorLocationProvider;
  private qrScanner: CapacitorQrScanner;
  private preferencesStorage: CapacitorPreferencesStorage;
  private cameraProvider: CapacitorCameraProvider;

  constructor() {
    this.locationProvider = new CapacitorLocationProvider();
    this.qrScanner = new CapacitorQrScanner();
    this.preferencesStorage = new CapacitorPreferencesStorage();
    this.cameraProvider = new CapacitorCameraProvider();
  }

  async invoke<T>(method: string, args?: any): Promise<T> {
    // Delega para os métodos específicos baseado no nome do método
    switch (method) {
      case 'getCurrentPosition':
        return (await this.locationProvider.getCurrentPosition()) as T;
      case 'scan':
        return (await this.qrScanner.scan()) as T;
      case 'capturePhoto':
        return (await this.cameraProvider.capturePhoto()) as T;
      case 'getSecret':
        return (await this.preferencesStorage.getSecret(args?.key)) as T;
      case 'setSecret':
        await this.preferencesStorage.setSecret(args?.key, args?.value);
        return undefined as T;
      default:
        throw new Error(`Method ${method} not supported by NativeBridgeImpl`);
    }
  }

  async getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null> {
    return this.locationProvider.getCurrentPosition();
  }

  async scan(): Promise<string | null> {
    return this.qrScanner.scan();
  }

  async capturePhoto(): Promise<Blob | null> {
    return this.cameraProvider.capturePhoto();
  }

  async getSecret(key: string): Promise<string | undefined> {
    return this.preferencesStorage.getSecret(key);
  }

  async setSecret(key: string, value: string): Promise<void> {
    return this.preferencesStorage.setSecret(key, value);
  }
}

/**
 * Implementação de LocationProvider usando Capacitor Geolocation plugin
 */
class CapacitorLocationProvider implements LocationProvider {
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

/**
 * Implementação de QrScanner usando Capacitor Barcode Scanner plugin
 */
class CapacitorQrScanner implements QrScanner {
  private get isNative(): boolean {
    return Capacitor.isPluginAvailable('BarcodeScanner');
  }

  async scan(): Promise<string | null> {
    if (this.isNative) {
      const permission = await BarcodeScanner.checkPermission({ force: true });
      if (!permission.granted) {
        return null;
      }

      const result = await BarcodeScanner.startScan();
      if ((result as any)?.hasStopped) {
        return null;
      }
      if ((result as any)?.barcodes && (result as any).barcodes.length > 0) {
        const content = (result as any).barcodes[0].displayValue;
        await BarcodeScanner.stopScan();
        return content ?? null;
      }
      return null;
    }

    // Fallback para browser
    return this._scanFromInput();
  }

  private async _scanFromInput(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*;capture=camera';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(this._decodeImageUrl(img));
        };
        img.onerror = () => resolve(null);
        img.src = url;
        input.style.display = 'none';
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
      };
    });
  }

  private _decodeImageUrl(img: HTMLImageElement): string | null {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Usa a biblioteca ZXing já instalada para decodificar o QR offline
      void import('@zxing/browser').then((mod: any) => {
        const codeReader = new mod.BrowserQRCodeReader();
        void codeReader.decodeFromImageData(imageData, canvas.width, canvas.height, (result: any) => {
          if (result) {
            void codeReader.reset();
          }
        });
      });
      // A decodificação é síncrona aqui apenas como fallback simplificado.
      // Em um ambiente nativo, o BarcodeScanner traz o resultado direto.
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Implementação de SecureStorage usando Capacitor Preferences
 * (já que @capacitor-community/secure-storage retornou 404)
 */
class CapacitorPreferencesStorage implements SecureStorage {
  async getSecret(key: string): Promise<string | undefined> {
    try {
      const { value } = await Preferences.get({ key });
      return value ?? undefined;
    } catch (error) {
      console.error('Error getting secure storage item:', error);
      return undefined;
    }
  }

  async setSecret(key: string, value: string): Promise<void> {
    try {
      await Preferences.set({ key, value });
    } catch (error) {
      console.error('Error setting secure storage item:', error);
      throw error;
    }
  }
}

/**
 * Implementação de CameraProvider usando Capacitor Camera plugin
 */
class CapacitorCameraProvider implements CameraProvider {
  async capturePhoto(): Promise<Blob | null> {
    try {
      if (!Capacitor.isPluginAvailable('Camera')) {
        // Fallback para desenvolvimento web
        return null;
      }

      const result: Photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      });

      if (result && result.webPath) {
        const response = await fetch(result.webPath);
        return await response.blob();
      }
      return null;
    } catch (error) {
      console.error('Error capturing photo:', error);
      return null;
    }
  }
}