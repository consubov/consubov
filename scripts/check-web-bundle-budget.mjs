import { readFile } from "node:fs/promises";
import path from "node:path";

const webRoot = process.cwd();
const repoRoot = path.resolve(webRoot, "../..");
const reportPath = path.join(webRoot, "dist", "bundle-report.json");
const budgetPath = path.join(repoRoot, "scripts", "web-bundle-budget.json");

function object(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) throw new Error(`${label} must be an object`);
}

function byteCount(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive safe integer`);
}

let report;
let budget;
let largestAssetBytes = 0;
try {
  [report, budget] = await Promise.all([
    readFile(reportPath, "utf8").then(JSON.parse),
    readFile(budgetPath, "utf8").then(JSON.parse),
  ]);
  object(budget, "budget");
  for (const key of ["maxTotalBytes", "maxTotalGzipBytes", "maxLargestAssetBytes"]) byteCount(budget[key], `budget.${key}`);
  object(report, "report");
  object(report.totals, "report.totals");
  for (const key of ["files", "bytes", "gzipBytes"]) byteCount(report.totals[key], `report.totals.${key}`);
  if (!Array.isArray(report.largest) || report.largest.length !== Math.min(report.totals.files, 20)) {
    throw new Error("report.largest must contain every asset or the producer's top20");
  }
  const filenames = new Set();
  let listedBytes = 0;
  let listedGzipBytes = 0;
  for (const asset of report.largest) {
    object(asset, "asset");
    if (typeof asset.file !== "string" || asset.file.trim().length === 0 || filenames.has(asset.file)) {
      throw new Error("asset.file must be a usable unique filename");
    }
    filenames.add(asset.file);
    byteCount(asset.bytes, "asset.bytes");
    byteCount(asset.gzipBytes, "asset.gzipBytes");
    listedBytes += asset.bytes;
    listedGzipBytes += asset.gzipBytes;
    largestAssetBytes = Math.max(largestAssetBytes, asset.bytes);
  }
  // The full list must match totals; omitted assets each contribute positive bytes.
  // Gzip may exceed raw bytes for tiny assets, so there is no compression-ratio rule.
  const omittedFiles = report.totals.files - report.largest.length;
  if ((omittedFiles === 0 && (listedBytes !== report.totals.bytes || listedGzipBytes !== report.totals.gzipBytes)) ||
      listedBytes + omittedFiles > report.totals.bytes || listedGzipBytes + omittedFiles > report.totals.gzipBytes) {
    throw new Error("report totals are inconsistent with asset measurements or file count");
  }
} catch (error) {
  console.error("[bundle:budget] invalid input:", error.message);
  process.exit(1);
}

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
