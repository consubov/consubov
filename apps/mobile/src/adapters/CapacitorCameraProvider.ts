/**
 * CapacitorCameraProvider — FASE 6.2/6.3
 * Contrato: apps/web/src/platform/contracts/index.ts :: CameraProvider
 * Plugin: @capacitor/camera
 * Notas: degrada para null quando permissão negada; não duplica lógica de domínio.
 */

export interface CameraProvider {
  capturePhoto(): Promise<Blob | null>;
}

export function createCapacitorCameraProvider(): CameraProvider {
  return {
    async capturePhoto(): Promise<Blob | null> {
      try {
        const mod = await import("@capacitor/camera").catch(() => null);
        if (!mod?.Camera) return null;

        const perm = await mod.Camera.checkPermissions();
        if (perm.camera !== "granted") {
          const req = await mod.Camera.requestPermissions({ permissions: ["camera"] });
          if (req.camera !== "granted") return null;
        }

        const photo = await mod.Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: mod.CameraResultType?.Blob ?? "blob",
        });

        // Alguns runtimes retornam webPath/base64 em vez de blob dependendo da plataforma.
        if (photo && typeof (photo as { blob?: Blob }).blob !== "undefined") {
          return (photo as { blob: Blob }).blob;
        }
        if (photo && typeof (photo as { webPath?: string }).webPath === "string") {
          const res = await fetch((photo as { webPath: string }).webPath!);
          return await res.blob();
        }
        if (photo && typeof (photo as { base64String?: string }).base64String === "string") {
          const b64 = (photo as { base64String: string }).base64String!;
          const fmt = (photo as { format?: string }).format ?? "jpeg";
          const bin = atob(b64);
          const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
          return new Blob([bytes], { type: `image/${fmt}` });
        }
        return null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/denied|permission|cancel/i.test(msg)) return null;
        console.warn("[CapacitorCameraProvider] capturePhoto degradado:", msg);
        return null;
      }
    },
  };
}