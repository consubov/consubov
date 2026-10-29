import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

// Evaluate the actual Vite hooks against an isolated dist/ tree.
// Never touch the real dist/, offline data, or a production service worker.
const configSource = fs.readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
let root = "";
let versionFile = "";
let swFile = "";

function hooks() {
  const module = { exports: {} as { default?: () => { plugins: Array<{ name: string; buildStart?: () => void; closeBundle?: () => void }> } } };
  const js = ts.transpileModule(configSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const requireMock = (id: string): unknown => {
    if (id === "vite") return { defineConfig: (x: unknown) => x };
    if (id === "@vitejs/plugin-react-swc") return () => ({ name: "react" });
    if (id === "fs") return fs;
    if (id === "path") return path;
    throw new Error("Unexpected config import " + id);
  };
  vm.runInNewContext(js, {
    module, exports: module.exports, require: requireMock,
    __dirname: root, process, Date, console, setTimeout,
  }, { timeout: 5000 });
  const plugins = module.exports.default?.().plugins;
  const floor = plugins?.find((p) => p.name === "consubov-fazendas-release-floor")?.buildStart;
  const bundle = plugins?.find((p) => p.name === "inject-sw-build-timestamp")?.closeBundle;
  if (!floor || !bundle) throw new Error("PWA release gate missing");
  return { floor, bundle };
}

function version(v: string) {
  fs.writeFileSync(versionFile, 'export const APP_VERSION = "' + v + '";');
}
function sw(content = "const BUILD_VERSION = '__BUILD_TIMESTAMP__'; const PRECACHE_ASSETS = '__PRECACHE_ASSETS__';") {
  fs.writeFileSync(swFile, content);
}
function jsAsset() {
  fs.writeFileSync(path.join(root, "dist/assets/main.hash1234.js"), "export default 1");
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "consubov-vite-qa-"));
  fs.mkdirSync(path.join(root, "src/lib"), { recursive: true });
  fs.mkdirSync(path.join(root, "dist/assets"), { recursive: true });
  versionFile = path.join(root, "src/lib/appVersion.ts");
  swFile = path.join(root, "dist/sw.js");
  version("2.0.0");
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("CONSUBOV Fazendas release gates: minimum 2.0.0 and offline integrity", () => {
  it("accepts the approved 2.0.0", () => expect(() => hooks().floor()).not.toThrow());
  it("rejects a legacy 1.155.0 build", () => {
    version("1.155.0");
    expect(() => hooks().floor()).toThrow(/regressao de versao/);
  });
  it("rejects a prerelease version", () => {
    version("2.0.0-rc.1");
    expect(() => hooks().floor()).toThrow(/regressao de versao/);
  });
  it("does not build a broken app without a service worker", () => {
    expect(() => hooks().bundle()).toThrow(/service worker.*sw.js/);
  });
  it("produces metadata and versioned offline asset references", () => {
    sw(); jsAsset();
    hooks().bundle();
    const metadata = JSON.parse(fs.readFileSync(path.join(root, "dist/version.json"), "utf8"));
    expect(metadata.appVersion).toBe("2.0.0");
    expect(metadata.version).toMatch(/^\d{12,15}$/);
    const output = fs.readFileSync(swFile, "utf8");
    expect(output).not.toContain("__BUILD_TIMESTAMP__");
    expect(output).toContain("/assets/main.hash1234.js");
  });
  it("rejects missing JavaScript assets", () => {
    sw();
    expect(() => hooks().bundle()).toThrow(/without JavaScript assets/);
  });
  it("rejects a service worker missing its precache marker", () => {
    sw("const BUILD_VERSION = '__BUILD_TIMESTAMP__';"); jsAsset();
    expect(() => hooks().bundle()).toThrow(/precache placeholder/);
  });
  it("rejects a service worker missing its version marker", () => {
    sw("const PRECACHE_ASSETS = '__PRECACHE_ASSETS__';"); jsAsset();
    expect(() => hooks().bundle()).toThrow(/build timestamp placeholder/);
  });
});