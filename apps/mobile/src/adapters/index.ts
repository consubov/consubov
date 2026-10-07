/**
 * Índice dos adapters nativos — FASE 6.2
 * Ponto único de composição: o app mobile chama createPlatformAdapters() no
 * boot e injeta o resultado no mesmo PlatformProvider que a Web usa. Assim a
 * UI/domínio Web não conhece se está rodando em Web ou nativo.
 */

export { createCapacitorLocationProvider, type LocationReading } from "./CapacitorLocationProvider";
export { createCapacitorQrScanner } from "./CapacitorQrScanner";
export { createCapacitorCameraProvider } from "./CapacitorCameraProvider";
export { createCapacitorLocalDatabase } from "./CapacitorLocalDatabase";
export { createCapacitorConnectivityProvider } from "./CapacitorConnectivityProvider";
export { createCapacitorSecureStorage } from "./CapacitorSecureStorage";
export {
  createCapacitorNativeBridge,
  registerNativeHandler,
  clearNativeHandlers,
  listNativeHandlers,
  UnknownNativeMethodError,
  type NativeHandler,
} from "./CapacitorNativeBridge";

import { createCapacitorLocationProvider } from "./CapacitorLocationProvider";
import { createCapacitorQrScanner } from "./CapacitorQrScanner";
import { createCapacitorCameraProvider } from "./CapacitorCameraProvider";
import { createCapacitorLocalDatabase } from "./CapacitorLocalDatabase";
import { createCapacitorConnectivityProvider } from "./CapacitorConnectivityProvider";
import { createCapacitorSecureStorage } from "./CapacitorSecureStorage";
import { createCapacitorNativeBridge } from "./CapacitorNativeBridge";

/** Conjunto de adapters nativos que satisfazem os contratos da Web (FASE 2). */
export function createPlatformAdapters() {
  return {
    database: createCapacitorLocalDatabase(),
    secureStorage: createCapacitorSecureStorage(),
    location: createCapacitorLocationProvider(),
    qrScanner: createCapacitorQrScanner(),
    camera: createCapacitorCameraProvider(),
    connectivity: createCapacitorConnectivityProvider(),
    nativeBridge: createCapacitorNativeBridge(),
  };
}

export type PlatformAdapters = ReturnType<typeof createPlatformAdapters>;
