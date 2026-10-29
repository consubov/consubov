import { describe, expect, it } from "vitest";
import {
  CONSUBOV_INSTALL_ID,
  CONSUBOV_INSTALL_MANIFEST,
  requestConsubovCrossOriginInstall,
} from "../../lib/crossOriginInstall";

describe("site institutional cross-origin PWA installation", () => {
  it("installs only the canonical app-origin manifest", async () => {
    const requests: unknown[] = [];
    expect(await requestConsubovCrossOriginInstall({
      install: async (options) => { requests.push(options); },
    })).toBe("installed");
    expect(requests).toEqual([{manifest: CONSUBOV_INSTALL_MANIFEST, manifestId: CONSUBOV_INSTALL_ID}]);
  });

  it("does not redirect or install the institutional site without browser support", async () => {
    expect(await requestConsubovCrossOriginInstall({})).toBe("unsupported");
  });

  it("treats browser cancellation as non-error", async () => {
    expect(await requestConsubovCrossOriginInstall({
      install: async () => { throw new DOMException("User dismissed", "AbortError"); },
    })).toBe("dismissed");
  });

  it("does not claim a successful install on unexpected browser errors", async () => {
    expect(await requestConsubovCrossOriginInstall({
      install: async () => { throw new TypeError("install not enabled"); },
    })).toBe("failed");
  });
});
