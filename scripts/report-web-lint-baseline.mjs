import { spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(repoRoot, "apps", "web");
const result = spawnSync("bunx", ["eslint", ".", "--format", "json"], {
  cwd: webRoot, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024,
});
if (result.error) throw result.error;

let reports;
try { reports = JSON.parse(result.stdout || "[]"); }
catch {
  console.error("[lint:baseline] saída do ESLint não pôde ser interpretada.");
  process.stderr.write(result.stderr || "");
  process.exit(1);
}

const baseline = reports.reduce((acc, report) => {
  acc.files += 1;
  acc.errors += report.errorCount || 0;
  acc.warnings += report.warningCount || 0;
  if ((report.errorCount || 0) + (report.warningCount || 0) > 0) acc.filesWithFindings += 1;
  return acc;
}, { files: 0, filesWithFindings: 0, errors: 0, warnings: 0 });

console.log("[lint:baseline]", JSON.stringify(baseline));
if (result.status && result.status !== 0) {
  console.log("[lint:baseline] dívida existente medida; este comando é informativo e não mascara o gate lint:changed.");
}
