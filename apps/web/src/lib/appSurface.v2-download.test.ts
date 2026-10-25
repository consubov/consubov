import { describe, expect, it } from "vitest";
import {
  isConsubovV2DownloadRoute,
  resolveSurfaceRedirect,
} from "./appSurface";

describe("CONSUBOV 2.0 explicit installation entry", () => {
  const appContext = {
    standalone: true,
    surfaceMode: "app" as const,
    relattoProfile: false,
  };

  it("keeps /baixar visible on the new app when standalone is already detected", () => {
    expect(isConsubovV2DownloadRoute("/baixar", "", "app")).toBe(true);
    expect(resolveSurfaceRedirect("/baixar", "", appContext)).toBeNull();
  });

  it("does not redirect the v2 installer because of a persisted session", () => {
    expect(resolveSurfaceRedirect("/baixar", "?standalone=1", appContext)).toBeNull();
  });

  it("preserves the regular installed app launch for / and other apps", () => {
    expect(resolveSurfaceRedirect("/", "", appContext)).toBe("/app");
    expect(resolveSurfaceRedirect("/baixar", "?app=relatto", {
      ...appContext, relattoProfile: true,
    })).toBe("/consultor");
    expect(resolveSurfaceRedirect("/baixar", "", {
      ...appContext, surfaceMode: "site",
    })).toBe("/app");
  });

  it("preserves the install-only guard in a regular browser tab", () => {
    expect(resolveSurfaceRedirect("/login", "", {
      ...appContext, standalone: false,
    })).toBe("/baixar");
    expect(isConsubovV2DownloadRoute("/baixar", "", "site")).toBe(false);
    expect(isConsubovV2DownloadRoute("/baixar", "?pwa=relatto", "app")).toBe(false);
  });
});
