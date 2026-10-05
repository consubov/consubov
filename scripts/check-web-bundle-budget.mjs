import { readFile } from "node:fs/promises";
import path from "node:path";

const webRoot = process.cwd();
const repoRoot = path.resolve(webRoot, "../..");
const reportPath = path.join(webRoot, "dist", "bundle-report.json");
const budgetPath = path.join(repoRoot, "scripts", "web-bundle-budget.json");

const [report, budget] = await Promise.all([
  readFile(reportPath, "utf8").then(JSON.parse),
  readFile(budgetPath, "utf8").then(JSON.parse),
]);

const failures = [];
if (report.totals.bytes > budget.maxTotalBytes) {
  failures.push(`raw total ${report.totals.bytes} > budget ${budget.maxTotalBytes}`);
}
if (report.totals.gzipBytes > budget.maxTotalGzipBytes) {
  failures.push(`gzip total ${report.totals.gzipBytes} > budget ${budget.maxTotalGzipBytes}`);
}

console.log(
  "[bundle:budget]",
  JSON.stringify({
    actual: report.totals,
    budget: {
      maxTotalBytes: budget.maxTotalBytes,
      maxTotalGzipBytes: budget.maxTotalGzipBytes,
    },
  }),
);

if (failures.length > 0) {
  console.error("[bundle:budget] regressão detectada:");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("[bundle:budget] atualize o baseline somente após revisão explícita da regressão.");
  process.exit(1);
}
