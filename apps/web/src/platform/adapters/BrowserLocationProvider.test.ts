import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserLocationProvider, detectBrowserCapabilities, type BrowserLocationEnvironment } from "./BrowserLocationProvider";

const position = (latitude: number, longitude: number, accuracy = 3, timestamp = 123) => ({
  coords: { latitude, longitude, accuracy }, timestamp,
}) as GeolocationPosition;

const environment = (
  getCurrentPosition: Geolocation["getCurrentPosition"],
  secureContext = true,
): BrowserLocationEnvironment => ({
  secureContext,
  navigator: { geolocation: { getCurrentPosition } },
});

afterEach(() => vi.useRealTimers());

describe("BrowserLocationProvider (Conferencia QR)", () => {
  it("preserves valid coordinates, optional metadata and the previous GPS options", async () => {
    let received: PositionOptions | undefined;
    const provider = createBrowserLocationProvider(() => environment((onSuccess, _onError, options) => {
      received = options;
      onSuccess(position(-19.8, -43.9));
    }));
    await expect(provider.getCurrentPosition()).resolves.toEqual({
      latitude: -19.8, longitude: -43.9, accuracy: 3, timestamp: 123,
    });
    expect(received).toEqual({ timeout: 4000, maximumAge: 60000 });
  });

  it("falls back to null when denied", async () => {
    const provider = createBrowserLocationProvider(() => environment((_success, error) => {
      error?.({ code: 1 } as GeolocationPositionError);
    }));
    await expect(provider.getCurrentPosition()).resolves.toBeNull();
  });

  it("does not invoke an insecure or missing geolocation API", async () => {
    const geo = vi.fn();
    await expect(createBrowserLocationProvider(() => environment(geo, false)).getCurrentPosition()).resolves.toBeNull();
    await expect(createBrowserLocationProvider(() => ({ secureContext: true, navigator: {} })).getCurrentPosition()).resolves.toBeNull();
    expect(geo).not.toHaveBeenCalled();
  });

  it("handles blocked getters and synchronous API exceptions", async () => {
    await expect(createBrowserLocationProvider(() => { throw Error("blocked"); }).getCurrentPosition()).resolves.toBeNull();
    await expect(createBrowserLocationProvider(() => ({
      secureContext: true,
      navigator: { get geolocation(): Pick<Geolocation, "getCurrentPosition"> { throw Error("blocked"); } },
    })).getCurrentPosition()).resolves.toBeNull();
    await expect(createBrowserLocationProvider(() => environment(() => { throw Error("sync"); })).getCurrentPosition()).resolves.toBeNull();
  });

  it.each([[91, 2], [2, -181], [Number.NaN, 2], [2, Infinity]])(
    "drops impossible coordinates (%s, %s)", async (lat, lng) => {
      const provider = createBrowserLocationProvider(() => environment((success) => success(position(lat, lng))));
      await expect(provider.getCurrentPosition()).resolves.toBeNull();
    },
  );

  it("omits invalid optional metadata instead of serializing NaN", async () => {
    const provider = createBrowserLocationProvider(() => environment((success) => success(position(0, 0, -1, NaN))));
    await expect(provider.getCurrentPosition()).resolves.toEqual({ latitude: 0, longitude: 0 });
  });

  it("uses an independent deadline and ignores callbacks arriving later", async () => {
    vi.useFakeTimers();
    let onSuccess: PositionCallback | undefined;
    const provider = createBrowserLocationProvider(() => environment((success) => { onSuccess = success; }), 20);
    const request = provider.getCurrentPosition();
    await vi.advanceTimersByTimeAsync(21);
    await expect(request).resolves.toBeNull();
    onSuccess?.(position(-21, -40));
    await expect(request).resolves.toBeNull();
  });

  it("accepts the first callback only", async () => {
    const provider = createBrowserLocationProvider(() => environment((success) => {
      success(position(-21, -40));
      success(position(-22, -41));
    }));
    await expect(provider.getCurrentPosition()).resolves.toEqual({ latitude: -21, longitude: -40, accuracy: 3, timestamp: 123 });
  });

  it("checks API presence without invoking hardware or permissions", () => {
    const getCurrentPosition = vi.fn();
    const getUserMedia = vi.fn();
    const browser = detectBrowserCapabilities({
      secureContext: true,
      navigator: { geolocation: { getCurrentPosition }, mediaDevices: { getUserMedia } },
      indexedDB: { open: vi.fn() },
    });
    expect(browser).toEqual({ secureContext: true, geolocation: true, camera: true, indexedDB: true, barcodeDetector: false });
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
