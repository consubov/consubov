import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(repoRoot, "apps", "web");

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function existingRef(ref) {
  try { git(["rev-parse", "--verify", ref]); return true; }
  catch { return false; }
}

const baseBranch = process.env.GITHUB_BASE_REF || "main";
const baseRef = existingRef(`origin/${baseBranch}`) ? `origin/${baseBranch}` : baseBranch;
if (!existingRef(baseRef)) throw new Error(`missing base ref: ${baseRef}`);

const changed = new Set();
for (const args of [
  ["diff", "--name-only", "--diff-filter=ACMRT", `${baseRef}...HEAD`],
  ["diff", "--name-only", "--diff-filter=ACMRT", "HEAD"],
  ["ls-files", "--others", "--exclude-standard", "--", "apps/web"],
]) {
  for (const file of git(args).split("\n").filter(Boolean)) changed.add(file);
}
const files = [...changed]
  .filter((file) => file.startsWith("apps/web/"))
  .filter((file) => /\.(?:js|jsx|ts|tsx)$/.test(file))
  .map((file) => path.join(repoRoot, file))
  .filter((file) => existsSync(file) && statSync(file).isFile())
  .map((file) => path.relative(webRoot, file));

if (files.length === 0) {
  console.log("[lint:changed] nenhum arquivo JS/TS alterado em apps/web.");
  process.exit(0);
}

console.log(`[lint:changed] validando ${files.length} arquivo(s):`);
for (const file of files) console.log(`- ${file}`);

// Use the frozen install's CLI directly: no shell shim or package download fallback.
const eslintPackage = createRequire(path.join(webRoot, "package.json")).resolve("eslint/package.json");
const eslintBin = path.join(path.dirname(eslintPackage), "bin", "eslint.js");
const result = spawnSync(process.execPath, [eslintBin, ...files], { cwd: webRoot, stdio: "inherit", env: process.env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
