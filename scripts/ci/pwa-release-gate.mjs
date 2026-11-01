import { readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

const dist = resolve(process.argv[2] || "apps/web/dist");
const previous = process.argv.find(x => x.startsWith("--previous="))?.slice(11);
const smoke = process.argv.find(x => x.startsWith("--smoke-url="))?.slice(12);
const fail = message => { throw new Error("[PWA GATE] " + message); };
const ok = (test, message) => { if (!test) fail(message); };
const asset = name => {
  ok(typeof name === "string" && name.startsWith("/") && !name.startsWith("//"), "invalid asset URL");
  const pathname = name.split(/[?#]/, 1)[0];
  ok(!pathname.includes("\\") && !pathname.split("/").includes("..") && !/%(?:2e|2f|5c)/i.test(pathname), "asset traversal");
  const path = resolve(dist, "." + pathname);
  ok(path.startsWith(dist + sep), "asset outside dist");
  try { ok(statSync(path).isFile(), "not a file: " + pathname); }
  catch { fail("missing asset / rewrite target: " + pathname); }
  return readFileSync(path, "utf8");
};
const json = name => {
  try { return JSON.parse(asset(name)); }
  catch (error) { fail("invalid JSON in " + name + ": " + error.message); }
};
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const build = /^\d{12,15}$/;
const compareVersion = (a, b) => {
  ok(semver.test(a) && semver.test(b), "invalid appVersion");
  const aa = a.split(".").map(Number), bb = b.split(".").map(Number);
  ok([...aa,...bb].every(Number.isSafeInteger), "unsafe SemVer number");
  for (let i=0;i<3;i++) if (aa[i]!==bb[i]) return aa[i]>bb[i]?1:-1;
  return 0;
};
const index = asset("/index.html");
const worker = asset("/sw.js");
const version = json("/version.json");
const initial = json("/manifest.json");
const v2 = json("/manifest-consubov-v2.json");
const installer = asset("/instalar-consubov-v2.html");
ok(typeof version.version === "string" && build.test(version.version) && Number.isSafeInteger(Number(version.version)), "invalid build timestamp");
ok(compareVersion(version.appVersion, "2.0.0") >= 0, "PWA product downgrade");
if (previous) {
  const prev = JSON.parse(readFileSync(resolve(previous), "utf8"));
  ok(compareVersion(version.appVersion, prev.appVersion) >= 0, "product downgrade vs production");
  ok(build.test(prev.version) && Number(version.version) > Number(prev.version), "non-monotonic build vs production");
}
ok(initial.id === "/" && initial.start_url === "/", "existing PWA identity changed");
ok(v2.id === "/" && v2.start_url === "/" && v2.name === "Consubov 2.0", "V2 PWA identity invalid");
ok(Array.isArray(v2.icons) && v2.icons.length > 0, "manifest missing icons");
v2.icons.forEach(icon => asset(icon.src));
ok(index.includes('href="/manifest.json"'), "index no longer references manifest");
ok(installer.includes('href="/manifest-consubov-v2.json"'), "Vercel /baixar target has wrong manifest");
const entry = [...index.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/g)].map(x => x[1]);
ok(entry.some(x => x.endsWith(".js")) && entry.some(x => x.endsWith(".css")), "HTML entry JS/CSS missing");
entry.forEach(asset);
ok(!worker.includes("__PRECACHE_ASSETS__") && !worker.includes("__BUILD_TIMESTAMP__"), "SW placeholders not injected");
const workerVersion = worker.match(/const BUILD_VERSION\s*=\s*['"](\d{12,15})['"]/);
ok(workerVersion && workerVersion[1] === version.version, "SW and version.json builds mismatch");
const precacheMatch = worker.match(/const PRECACHE_ASSETS\s*=\s*(\[[^\n]*\]);/);
ok(precacheMatch, "SW precache missing");
let precache;
try { precache = JSON.parse(precacheMatch[1]); } catch { fail("SW precache invalid JSON"); }
ok(Array.isArray(precache) && precache.length > 0, "SW precache empty");
precache.forEach(asset);
entry.forEach(path => ok(precache.includes(path), "entry missing from SW cache: " + path));
console.log("[PWA GATE] build PASS", JSON.stringify({ version: version.appVersion, build: version.version, entry: entry.length, precache: precache.length }));

if (smoke) {
  const base = new URL(smoke);
  ok(["https:","http:"].includes(base.protocol), "HTTP(S) origin required");
  const get = async path => {
    const res = await fetch(new URL(path, base), { cache: "no-store", signal: AbortSignal.timeout(12000) });
    ok(res.status === 200, "HTTP " + res.status + " on " + path);
    return { body: await res.text(), type: res.headers.get("content-type") || "" };
  };
  const page = (await get("/app")).body;
  const chunks = [...page.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/g)].map(x => x[1]);
  ok(chunks.some(x => x.endsWith(".js")), "HTTP HTML without JS");
  for (const chunk of chunks) {
    const data = await get(chunk);
    ok(!data.type.includes("text/html"), "HTML served instead of asset: " + chunk);
  }
  for (const path of ["/sw.js", "/version.json", "/manifest-consubov-v2.json", "/instalar-consubov-v2.html"]) await get(path);
  const publicVersion = JSON.parse((await get("/version.json")).body);
  ok(semver.test(publicVersion.appVersion) && build.test(publicVersion.version), "invalid HTTP release version");
  if (process.argv.includes("--check-host-rewrites")) {
    const manifest = JSON.parse((await get("/manifest.json")).body);
    ok(manifest.id === "/" && manifest.name === "Consubov 2.0", "Vercel host manifest rewrite wrong");
    ok((await get("/baixar")).body.includes("/manifest-consubov-v2.json"), "Vercel /baixar rewrite wrong");
  }
  console.log("[PWA GATE] HTTP PASS", base.origin);
}
