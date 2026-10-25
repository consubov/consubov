import { describe, expect, it } from "vitest";
import { APP_VERSION } from "./appVersion";
import { profileForPath } from "./pwaManifest";

describe("Consubov 2.0 identity", () => {
  it("labels the new app as release 2.0.0", () => {
    expect(APP_VERSION).toBe("2.0.0");
  });

  it("selects the new PWA manifest on the new app domain", () => {
    const profile = profileForPath("/baixar", "app.consubov.com.br");
    expect(profile.manifest).toBe("/manifest-consubov-v2.json");
    expect(profile.appleTitle).toBe("Consubov 2.0");
  });

  it("preserves other app identities", () => {
    expect(profileForPath("/relatto", "app.consubov.com.br").manifest)
      .toBe("/manifest-relatto.json");
    expect(profileForPath("/syncvet", "app.consubov.com.br").manifest)
      .toBe("/manifest-syncvet.json");
  });
});
