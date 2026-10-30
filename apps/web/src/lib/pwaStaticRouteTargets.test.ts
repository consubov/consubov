import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

function publicAsset(name: string): string {
  return new URL(`../../public/${name}`, import.meta.url).pathname;
}
function readPublic(name: string): string {
  return readFileSync(publicAsset(name), "utf8");
}

describe("published Vercel PWA project-route static targets", () => {
  it("ships the Consubov 2.0 manifest required by the /manifest.json rewrite", () => {
    const existing = JSON.parse(readPublic("manifest.json")) as { id: string; start_url: string };
    const upgraded = JSON.parse(readPublic("manifest-consubov-v2.json")) as {
      id: string; name: string; start_url: string; icons: { src: string }[];
    };
    // Keep the previously published identity on the same origin; don't
    // silently create a second app or reset installed PWA storage.
    expect(upgraded.id).toBe(existing.id);
    expect(upgraded.start_url).toBe("/");
    expect(upgraded.name).toBe("Consubov 2.0");
    for (const icon of upgraded.icons) {
      expect(existsSync(publicAsset(icon.src.replace(/^\//, "")))).toBe(true);
    }
  });

  it("ships the /baixar rewrite target and references the real manifest", () => {
    const html = readPublic("instalar-consubov-v2.html");
    expect(html).toContain('href="/manifest-consubov-v2.json"');
    expect(html).toContain("CONSUBOV 2.0");
    expect(html).toContain("app.consubov.com.br");
  });

  it("keeps the root HTML and public routes compatible with the published rewrite", () => {
    expect(readPublic("../index.html")).toContain('href="/manifest.json"');
    expect(existsSync(publicAsset("sw.js"))).toBe(true);
  });
});
