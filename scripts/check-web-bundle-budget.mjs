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

const largestAssetBytes = report.largest?.[0]?.bytes ?? 0;
const failures = [];

if (report.totals.bytes > budget.maxTotalBytes) {
  failures.push(`raw total ${report.totals.bytes} > ${budget.maxTotalBytes}`);
}
if (report.totals.gzipBytes > budget.maxTotalGzipBytes) {
  failures.push(`gzip total ${report.totals.gzipBytes} > ${budget.maxTotalGzipBytes}`);
}
if (largestAssetBytes > budget.maxLargestAssetBytes) {
  failures.push(`largest asset ${largestAssetBytes} > ${budget.maxLargestAssetBytes}`);
}

console.log("[bundle:budget]", JSON.stringify({
  actual: {
    totalBytes: report.totals.bytes,
    totalGzipBytes: report.totals.gzipBytes,
    largestAssetBytes,
  },
  budget,
}));

if (failures.length > 0) {
  console.error("[bundle:budget] regressão detectada:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
