import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const previousHead = execFileSync("git", ["rev-parse", "HEAD^"], {
  cwd: repoRoot, encoding: "utf8",
}).trim();
const priorTimestamp = execFileSync("git", ["log", "-1", "--format=%ct", previousHead], {
  cwd: repoRoot, encoding: "utf8",
}).trim();
const currentTimestamp = execFileSync("git", ["log", "-1", "--format=%ct", "HEAD"], {
  cwd: repoRoot, encoding: "utf8",
}).trim();

function importBuildVersion(env) {
  const result = spawnSync("bun", ["-e",
    'import { resolvedBuildTimestamp } from "./apps/web/vite.config.ts"; console.log(JSON.stringify(resolvedBuildTimestamp));',
  ], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 20000,
  });
  assert.ifError(result.error);
  return result;
}

test("PR CI build version uses event head SHA, not synthetic checkout HEAD", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "consubov-ci-event-"));
  try {
    const eventPath = path.join(dir, "event.json");
    writeFileSync(eventPath, JSON.stringify({ pull_request: { head: { sha: previousHead } } }));
    const result = importBuildVersion({
      GITHUB_ACTIONS: "true",
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_EVENT_PATH: eventPath,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout.trim()), priorTimestamp + "000");
    assert.notEqual(priorTimestamp, currentTimestamp,
      "fixture requires distinct commit dates to catch synthetic HEAD");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("push CI build version uses current commit", () => {
  const result = importBuildVersion({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout.trim()), currentTimestamp + "000");
});

test("PR CI fails closed when event head SHA is invalid", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "consubov-ci-event-"));
  try {
    const eventPath = path.join(dir, "event.json");
    writeFileSync(eventPath, JSON.stringify({ pull_request: { head: { sha: "not-a-sha" } } }));
    const result = importBuildVersion({
      GITHUB_ACTIONS: "true",
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_EVENT_PATH: eventPath,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid GitHub pull request head SHA/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("PR CI requires an event file", () => {
  const result = importBuildVersion({
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "pull_request",
    GITHUB_EVENT_PATH: "",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing GitHub pull request event file/);
});

test("PWA workflow includes the reviewed PR head commit", () => {
  const workflow = readFileSync(path.join(repoRoot, ".github/workflows/pwa-release-gate.yml"), "utf8");
  assert.match(workflow, /fetch-depth: 0/);
});

test("CI bundle budget measures the actual build", () => {
  const workflow = readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");
  assert.doesNotMatch(workflow, /CONSUBOV_CI_BUNDLE_BUDGET|Restore real build after budget/);
  assert.match(workflow, /Web bundle baseline\n\s+working-directory: apps\/web\n\s+run: bun run report:bundle/);
  assert.match(workflow, /Web bundle regression budget\n\s+working-directory: apps\/web\n\s+run: bun run check:bundle-budget/);
});

test("dev HTML injects the same runtime version before loading modules", () => {
  const script = "import config from \"./apps/web/vite.config.ts\"; const html = config().plugins.find(p => p.name === \"inject-dev-build-timestamp\").transformIndexHtml(\"<html><!-- CONSUBOV_BOOT_REPAIR_INLINE --><script type=\\\"module\\\"></script></html>\"); console.log(html);";
  const result = spawnSync("bun", ["-e", script], {
    cwd: repoRoot, env: { ...process.env, GITHUB_ACTIONS: "false" }, encoding: "utf8", timeout: 20000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const html = result.stdout.trim();
  assert.match(html, /data-consubov-build-version>globalThis\.__CONSUBOV_RUNTIME_BUILD_VERSION__="\d{13}";<\/script>/);
  assert.ok(html.indexOf("data-consubov-build-version") < html.indexOf("type=\"module\""));
  assert.match(html, /<!-- CONSUBOV_BOOT_REPAIR_INLINE -->/);
});
