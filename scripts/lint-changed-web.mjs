import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(repoRoot, "apps", "web");

function git(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const baseBranch = process.env.GITHUB_BASE_REF || "main";
let baseRef = `origin/${baseBranch}`;

try {
  git(["rev-parse", "--verify", baseRef]);
} catch {
  baseRef = baseBranch;
}

let changed = "";
try {
  changed = git(["diff", "--name-only", `${baseRef}...HEAD`]);
} catch (error) {
  console.error("[lint:changed] não foi possível calcular o diff contra", baseRef);
  throw error;
}

const files = changed
  .split("\n")
  .filter(Boolean)
  .filter((file) => file.startsWith("apps/web/"))
  .filter((file) => /\.(?:js|jsx|ts|tsx)$/.test(file))
  .map((file) => path.relative(webRoot, path.join(repoRoot, file)));

if (files.length === 0) {
  console.log("[lint:changed] nenhum arquivo JS/TS alterado em apps/web.");
  process.exit(0);
}

console.log(`[lint:changed] validando ${files.length} arquivo(s):`);
for (const file of files) console.log(`- ${file}`);

const result = spawnSync("bunx", ["eslint", ...files], {
  cwd: webRoot,
  stdio: "inherit",
  env: process.env,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
