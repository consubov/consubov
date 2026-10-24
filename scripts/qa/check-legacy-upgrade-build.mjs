/**
 * Checks only the isolated legacy-origin App release artifact.
 * NEVER publishes, redirects, accesses IndexedDB or contacts external services.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = process.env.PWA_BUILD_DIR || path.join(repo, "apps/web/dist");
const errors = [];
const read = (name) => {
  try { return fs.readFileSync(path.join(dir, name), "utf8"); }
  catch { errors.push("missing " + name); return ""; }
};
const parse = (name) => {
  try { return JSON.parse(read(name)); }
  catch { errors.push("invalid JSON " + name); return {}; }
};
const manifest = parse("manifest.json");
const build = parse("version.json");
const sw = read("sw.js");
const html = read("index.html");

if (build.releaseChannel !== "legacy-inplace") errors.push("not a legacy-inplace App build: run build:legacy-upgrade");
if (!build.version || typeof build.version !== "string") errors.push("missing build version");
if (manifest.id !== "/" || manifest.start_url !== "/" || manifest.scope !== "/" || manifest.display !== "standalone") {
  errors.push("installed PWA identity/scope changed");
}
if (!html.includes('rel="manifest"') || !html.includes('href="/manifest.json"')) {
  errors.push("root HTML missing original app manifest");
}
if (!sw.includes("SKIP_WAITING") || sw.includes("__PRECACHE_ASSETS__") || sw.includes("__BUILD_TIMESTAMP__")) {
  errors.push("new service worker unavailable or not built");
}
if (!sw.includes("consubov-")) errors.push("unexpected service worker cache namespace");
const hasJs = fs.existsSync(path.join(dir, "assets")) &&
  fs.readdirSync(path.join(dir, "assets"), { recursive: true }).some((name) => typeof name === "string" && name.endsWith(".js"));
if (!hasJs) errors.push("App assets missing: site-only artifact?");
if (errors.length) {
  errors.forEach(error => console.error("[legacy:upgrade] FAIL", error));
  process.exitCode = 1;
} else {
  console.log("[legacy:upgrade] PASS: App build for existing installed origin; no migration/physical QA implied");
}
