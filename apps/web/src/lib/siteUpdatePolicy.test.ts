import { describe, expect, it, vi } from "vitest";
import { cleanupSiteServiceWorker, isSiteBrowserSurface } from "./siteUpdatePolicy";

describe("site update policy", () => {
  it("follows build mode and preserves installed App behavior", () => {
    expect(isSiteBrowserSurface("site", false)).toBe(true);
    expect(isSiteBrowserSurface("site", true)).toBe(false);
    expect(isSiteBrowserSurface("app", false)).toBe(false);
    expect(isSiteBrowserSurface(undefined, false)).toBe(false);
  });

  it("only unregisters the legacy root /sw.js on the current origin", async () => {
    // The site may be hosted on the production domain, a preview URL, or localhost.
    const origin = window.location.origin;
    const unregisterLegacy = vi.fn().mockResolvedValue(true);
    const unregisterOther = vi.fn().mockResolvedValue(true);
    const unregisterForeign = vi.fn().mockResolvedValue(true);
    const registrations = [
      { scope: origin + "/", active: { scriptURL: origin + "/sw.js?v=1" }, unregister: unregisterLegacy },
      { scope: origin + "/other/", active: { scriptURL: origin + "/other/sw.js" }, unregister: unregisterOther },
      { scope: "https://other.example/", active: { scriptURL: "https://other.example/sw.js" }, unregister: unregisterForeign },
    ];
    const originalSW = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistrations: vi.fn().mockResolvedValue(registrations) } });
    try {
      await cleanupSiteServiceWorker();
      expect(unregisterLegacy).toHaveBeenCalledTimes(1);
      expect(unregisterOther).not.toHaveBeenCalled();
      expect(unregisterForeign).not.toHaveBeenCalled();
    } finally {
      if (originalSW) Object.defineProperty(navigator, "serviceWorker", originalSW);
      else Reflect.deleteProperty(navigator, "serviceWorker");
    }
  });
});
