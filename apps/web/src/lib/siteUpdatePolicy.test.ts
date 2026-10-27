import { describe, expect, it, vi } from "vitest";
import { cleanupSiteServiceWorker, isSiteBrowserSurface } from "./siteUpdatePolicy";

describe("site update policy", () => {
  it("follows build mode and preserves installed App behavior", () => {
    expect(isSiteBrowserSurface("site", false)).toBe(true);
    expect(isSiteBrowserSurface("site", true)).toBe(false);
    expect(isSiteBrowserSurface("app", false)).toBe(false);
    expect(isSiteBrowserSurface(undefined, false)).toBe(false);
  });

  it("only unregisters the legacy root /sw.js", async () => {
    const unregisterLegacy = vi.fn().mockResolvedValue(true);
    const unregisterOther = vi.fn().mockResolvedValue(true);
    const registrations = [
      { scope: "https://consubov.com.br/", active: { scriptURL: "https://consubov.com.br/sw.js?v=1" }, unregister: unregisterLegacy },
      { scope: "https://consubov.com.br/other/", active: { scriptURL: "https://consubov.com.br/other/sw.js" }, unregister: unregisterOther },
    ];
    const originalSW = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistrations: vi.fn().mockResolvedValue(registrations) } });
    try {
      await cleanupSiteServiceWorker();
      expect(unregisterLegacy).toHaveBeenCalledTimes(1);
      expect(unregisterOther).not.toHaveBeenCalled();
    } finally {
      if (originalSW) Object.defineProperty(navigator, "serviceWorker", originalSW);
      else Reflect.deleteProperty(navigator, "serviceWorker");
    }
  });
});
