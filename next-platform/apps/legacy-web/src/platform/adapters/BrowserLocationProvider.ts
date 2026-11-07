import type { LocationProvider, LocationPosition } from "../contracts";

/** Browser features, not permissions or physical-device guarantees. */
export interface BrowserCapabilities {
  secureContext: boolean;
  geolocation: boolean;
  camera: boolean;
  microphone: boolean;
  indexedDB: boolean;
  barcodeDetector: boolean;
  barcodeFallbackZxing: boolean;
  share: boolean;
  badging: boolean;
  wakeLock: boolean;
  webrtc: boolean;
  quota: boolean;
}

export interface BrowserLocationEnvironment {
  secureContext: boolean;
  navigator?: {
    geolocation?: Pick<Geolocation, "getCurrentPosition"> | null;
    mediaDevices?: { getUserMedia?: unknown } | null;
    share?: unknown;
    setAppBadge?: unknown;
    wakeLock?: { request?: unknown } | unknown;
    storage?: { estimate?: unknown } | null;
  } | null;
  indexedDB?: { open?: unknown } | null;
  barcodeDetector?: unknown;
  rtcPeerConnection?: unknown;
}

function safeRead<T>(read: () => T): T | undefined {
  try {
    return read();
  } catch {
    // Browser APIs may be disabled by the embedding context or enterprise policy.
    return undefined;
  }
}

function readBrowserEnvironment(): BrowserLocationEnvironment {
  return {
    secureContext: safeRead(() => globalThis.isSecureContext) === true,
    navigator: safeRead(() => globalThis.navigator),
    indexedDB: safeRead(() => globalThis.indexedDB),
    barcodeDetector: safeRead(() => Reflect.get(globalThis, "BarcodeDetector")),
    rtcPeerConnection: safeRead(() => Reflect.get(globalThis, "RTCPeerConnection")),
  };
}

/** Detect API presence without requesting any hardware or user permission. */
export function detectBrowserCapabilities(
  environment: BrowserLocationEnvironment = readBrowserEnvironment(),
): BrowserCapabilities {
  const nav = safeRead(() => environment.navigator);
  const barcodeDetector = typeof safeRead(() => environment.barcodeDetector) === "function";

  const microphone = typeof safeRead(() => nav?.mediaDevices?.getUserMedia) === "function";
  const share = typeof safeRead(() => nav?.share) === "function";
  const badging = typeof safeRead(() => nav?.setAppBadge) === "function";
  const wakeLock = typeof safeRead(() => (nav?.wakeLock as { request?: unknown } | null | undefined)?.request) === "function";
  const webrtc = typeof safeRead(() => environment.rtcPeerConnection) === "function";
  const quota = typeof safeRead(() => nav?.storage?.estimate) === "function";

  return {
    secureContext: safeRead(() => environment.secureContext) === true,
    geolocation: typeof safeRead(() => nav?.geolocation?.getCurrentPosition) === "function",
    camera: typeof safeRead(() => nav?.mediaDevices?.getUserMedia) === "function",
    microphone,
    indexedDB: typeof safeRead(() => environment.indexedDB?.open) === "function",
    barcodeDetector,
    barcodeFallbackZxing: !barcodeDetector,
    share,
    badging,
    wakeLock,
    webrtc,
    quota,
  };
}

function normalizePosition(position: GeolocationPosition): LocationPosition | null {
  const { latitude, longitude, accuracy } = position.coords;
  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) return null;

  const fix: LocationPosition = { latitude, longitude };
  if (Number.isFinite(accuracy) && accuracy >= 0) fix.accuracy = accuracy;
  if (Number.isFinite(position.timestamp) && position.timestamp >= 0) fix.timestamp = position.timestamp;
  return fix;
}

/**
 * Bound geolocation independently of browser callbacks: a blocked, missing,
 * denied or late GPS result never blocks QR processing or retries an audit.
 */
export function createBrowserLocationProvider(
  readEnvironment: () => BrowserLocationEnvironment = readBrowserEnvironment,
  timeoutMs = 4000,
): LocationProvider {
  return {
    async getCurrentPosition(): Promise<LocationPosition | null> {
      const environment = safeRead(readEnvironment);
      if (!environment || safeRead(() => environment.secureContext) !== true) return null;
      const geolocation = safeRead(() => environment.navigator?.geolocation);
      if (typeof safeRead(() => geolocation?.getCurrentPosition) !== "function") return null;

      return new Promise((resolve) => {
        let settled = false;
        const duration = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 4000;
        const finish = (sample: LocationPosition | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(sample);
        };
        const timer = setTimeout(() => finish(null), duration);
        try {
          geolocation!.getCurrentPosition(
            (position) => finish(safeRead(() => normalizePosition(position)) ?? null),
            () => finish(null),
            { timeout: duration, maximumAge: 60000 },
          );
        } catch {
          finish(null);
        }
      });
    },
  };
}

export const browserLocationProvider = createBrowserLocationProvider();
