import { describe, expect, it } from "vitest";
import { isRelattoHostname } from "./appSurface";
import { profileForPath } from "./pwaManifest";

describe("Brand isolation across Site, App and Preview hosts", () => {
  const hosts: Array<[string, boolean]> = [
    ["relatto-app.vercel.app", true],
    ["relatto-site.vercel.app", true],
    ["relatto-p37p3br1g-suporteagrodigital.vercel.app", true],
    ["app.relatto.com.br", true],
    ["consubov-app.vercel.app", false],
    ["consubov.com.br", false],
    ["falso-relattoteste.example", false],
  ];

  it.each(hosts)("identifies %s as Relatto: %s", (hostname, expected) => {
    expect(isRelattoHostname(hostname)).toBe(expected);
  });

  it("preserves the Relatto manifest identity across a login redirect", () => {
    expect(profileForPath("/login", "relatto-app.vercel.app").id).toBe("relatto");
    expect(profileForPath("/login", "consubov-app.vercel.app").id).toBe("consubov");
  });
});
