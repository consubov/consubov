import { describe, expect, it } from "vitest";
import { APP_VERSION } from "./appVersion";
import { profileForPath } from "./pwaManifest";
import v2Manifest from "../../public/manifest-consubov-v2.json";
import oldManifest from "../../public/manifest.json";

describe("Consubov 2.0 identity", () => {
  it("uses an independent installed-app ID without changing the old manifest", () => {
    expect(v2Manifest.name).toBe("Consubov 2.0");
    expect(v2Manifest.id).toBe("/consubov-v2");
    expect(v2Manifest.id).not.toBe(oldManifest.id);
    expect(v2Manifest.start_url).toBe("/");
  });

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
