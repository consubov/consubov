import { describe, expect, it, vi } from "vitest";
import { cleanupSiteServiceWorker } from "./siteUpdatePolicy";

describe("site update policy", () => {
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
