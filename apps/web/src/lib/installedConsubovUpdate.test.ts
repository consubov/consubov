import { describe, expect, it } from "vitest";
import { getSurfaceMode, resolveSurfaceRedirect } from "@/lib/appSurface";
import { shouldShowInstalledConsubovUpdate } from "@/lib/installedConsubovUpdate";
import manifest from "../../public/manifest.json";

describe("CONSUBOV in-place upgrade on the legacy origin", () => {
  it("retains the pre-installed PWA identity and root scope", () => {
    expect(manifest).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone" });
  });
  it("serves the installed App on the original host without a second installation", () => {
    expect(getSurfaceMode({ hostname: "consubov.com.br", search: "", envMode: "app" })).toBe("app");
    expect(resolveSurfaceRedirect("/", "", { surfaceMode: "app", standalone: true, relattoProfile: false })).toBe("/app");
    expect(resolveSurfaceRedirect("/capataz", "", { surfaceMode: "app", standalone: true, relattoProfile: false })).toBeNull();
    expect(resolveSurfaceRedirect("/login", "", { surfaceMode: "app", standalone: true, relattoProfile: false })).toBeNull();
  });
  it("keeps regular non-installed browser tabs on the install surface", () => {
    expect(resolveSurfaceRedirect("/app", "", { surfaceMode: "app", standalone: false, relattoProfile: false })).toBe("/baixar");
  });
  it.each(["/admin", "/gerente", "/capataz", "/escritorio", "/fabrica", "/pesador", "/pecuarista", "/login", "/app"])(
    "offers update to installed Consubov on %s", (route) => {
      expect(shouldShowInstalledConsubovUpdate(route, true)).toBe(true);
      expect(shouldShowInstalledConsubovUpdate(route, false)).toBe(false);
    },
  );
  it.each(["/", "/baixar", "/landing", "/relatto", "/consultor", "/consultor/fazendas", "/syncvet", "/syncvet/fazendas"])(
    "does not change unrelated/public surface %s", (route) => {
      expect(shouldShowInstalledConsubovUpdate(route, true)).toBe(false);
    },
  );
  it("does not show the shared login/app banner for the active Relatto profile", () => {
    expect(shouldShowInstalledConsubovUpdate("/app", true, true)).toBe(false);
    expect(shouldShowInstalledConsubovUpdate("/login", true, true)).toBe(false);
  });
  it("does not confuse a future cross-origin move with an in-place upgrade", () => {
    expect(new URL("https://consubov.com.br/").origin)
      .not.toBe(new URL("https://app.consubov.com.br/").origin);
  });
});
