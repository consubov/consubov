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
    expect(browser).toEqual({
      secureContext: true,
      geolocation: true,
      camera: true,
      microphone: true,
      indexedDB: true,
      barcodeDetector: false,
      barcodeFallbackZxing: true,
      share: false,
      badging: false,
      wakeLock: false,
      webrtc: false,
      quota: false,
    });
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("detects full modern browser capabilities with native barcode detector", () => {
    const estimate = vi.fn();
    const share = vi.fn();
    const setAppBadge = vi.fn();
    const getUserMedia = vi.fn();
    const wakeLockRequest = vi.fn();
    const getCurrentPosition = vi.fn();

    const capabilities = detectBrowserCapabilities({
      secureContext: true,
      navigator: {
        geolocation: { getCurrentPosition },
        mediaDevices: { getUserMedia },
        share,
        setAppBadge,
        wakeLock: { request: wakeLockRequest },
        storage: { estimate },
      },
      indexedDB: { open: vi.fn() },
      barcodeDetector: class MockBarcodeDetector {},
      rtcPeerConnection: class MockRTCPeerConnection {},
    });

    expect(capabilities).toEqual({
      secureContext: true,
      geolocation: true,
      camera: true,
      microphone: true,
      indexedDB: true,
      barcodeDetector: true,
      barcodeFallbackZxing: false,
      share: true,
      badging: true,
      wakeLock: true,
      webrtc: true,
      quota: true,
    });

    expect(estimate).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
    expect(setAppBadge).not.toHaveBeenCalled();
    expect(wakeLockRequest).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("flags barcodeFallbackZxing when native BarcodeDetector is unavailable", () => {
    const capabilities = detectBrowserCapabilities({
      secureContext: true,
      navigator: null,
      indexedDB: null,
      barcodeDetector: undefined,
    });

    expect(capabilities.barcodeDetector).toBe(false);
    expect(capabilities.barcodeFallbackZxing).toBe(true);
    expect(capabilities.webrtc).toBe(false);
    expect(capabilities.quota).toBe(false);
    expect(capabilities.share).toBe(false);
    expect(capabilities.badging).toBe(false);
    expect(capabilities.wakeLock).toBe(false);
  });

  it("safely handles throwing getters during capability detection", () => {
    const throwingNavigator = {
      get mediaDevices(): never { throw new Error("mediaDevices blocked"); },
      get share(): never { throw new Error("share blocked"); },
      get storage(): never { throw new Error("storage blocked"); },
    };

    const capabilities = detectBrowserCapabilities({
      secureContext: true,
      navigator: throwingNavigator,
      indexedDB: null,
    });

    expect(capabilities.camera).toBe(false);
    expect(capabilities.microphone).toBe(false);
    expect(capabilities.share).toBe(false);
    expect(capabilities.quota).toBe(false);
    expect(capabilities.barcodeFallbackZxing).toBe(true);
  });

  it.each([
    ["null", null],
    ["false", false],
    ["true", true],
    ["empty string", ""],
    ["arbitrary string", "not a function"],
    ["number zero", 0],
    ["positive number", 42],
    ["empty object", {}],
    ["empty array", []],
  ])("returns false for share, badging, wakeLock and webrtc when value is %s", (_label, invalidValue) => {
    const capabilities = detectBrowserCapabilities({
      secureContext: true,
      navigator: {
        share: invalidValue,
        setAppBadge: invalidValue,
        wakeLock: invalidValue,
      },
      rtcPeerConnection: invalidValue,
    });

    expect(capabilities.share).toBe(false);
    expect(capabilities.badging).toBe(false);
    expect(capabilities.wakeLock).toBe(false);
    expect(capabilities.webrtc).toBe(false);
  });

  it.each([
    ["empty object without request", {}],
    ["request is null", { request: null }],
    ["request is false", { request: false }],
    ["request is string", { request: "not a function" }],
    ["request is number", { request: 123 }],
    ["request is nested object", { request: {} }],
  ])("returns false for wakeLock when %s", (_label, wakeLockMock) => {
    const capabilities = detectBrowserCapabilities({
      secureContext: true,
      navigator: { wakeLock: wakeLockMock },
    });

    expect(capabilities.wakeLock).toBe(false);
  });

  it("guarantees detected capabilities can be invoked downstream without TypeError", () => {
    const mockShare = vi.fn();
    const mockSetAppBadge = vi.fn();
    const mockWakeLockRequest = vi.fn();
    class MockRTCPeerConnection {}

    const env: BrowserLocationEnvironment = {
      secureContext: true,
      navigator: {
        share: mockShare,
        setAppBadge: mockSetAppBadge,
        wakeLock: { request: mockWakeLockRequest },
      },
      rtcPeerConnection: MockRTCPeerConnection,
    };

    const caps = detectBrowserCapabilities(env);
    expect(caps.share).toBe(true);
    expect(caps.badging).toBe(true);
    expect(caps.wakeLock).toBe(true);
    expect(caps.webrtc).toBe(true);

    expect(() => {
      const share = env.navigator?.share;
      if (caps.share && typeof share === "function") share({ title: "Boletim" });
      const setAppBadge = env.navigator?.setAppBadge;
      if (caps.badging && typeof setAppBadge === "function") setAppBadge(5);
      const wakeLock = env.navigator?.wakeLock;
      if (caps.wakeLock && typeof wakeLock === "object" && wakeLock && "request" in wakeLock
        && typeof wakeLock.request === "function") wakeLock.request("screen");
      const rtcPeerConnection = env.rtcPeerConnection;
      if (caps.webrtc && typeof rtcPeerConnection === "function") {
        new (rtcPeerConnection as new () => object)();
      }
    }).not.toThrow();

    expect(mockShare).toHaveBeenCalledWith({ title: "Boletim" });
    expect(mockSetAppBadge).toHaveBeenCalledWith(5);
    expect(mockWakeLockRequest).toHaveBeenCalledWith("screen");
  });

  it("safely isolates throwing getters for badging, wakeLock and webrtc", () => {
    const throwingNavigator = {
      get setAppBadge(): never { throw new DOMException("Permission Denied", "SecurityError"); },
      get wakeLock(): never { throw new TypeError("Access restricted"); },
    };

    const capabilities = detectBrowserCapabilities({
      secureContext: true,
      navigator: throwingNavigator,
      get rtcPeerConnection(): never { throw new Error("WebRTC disabled"); },
    });

    expect(capabilities.badging).toBe(false);
    expect(capabilities.wakeLock).toBe(false);
    expect(capabilities.webrtc).toBe(false);
  });
});
