import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const webRoot = process.cwd();
const srcRoot = path.join(webRoot, "src");
const summaryPath = path.join(webRoot, "coverage", "coverage-summary.json");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else files.push(absolute);
  }
  return files;
}

const isTestableSource = (file) => {
  const rel = path.relative(srcRoot, file).replaceAll("\\", "/");
  return /\.(?:ts|tsx)$/.test(rel)
    && !rel.endsWith(".d.ts")
    && !rel.includes("/test/")
    && !rel.startsWith("test/")
    && !/(?:^|\/)[^/]+\.(?:test|spec)\.(?:ts|tsx)$/.test(rel);
};

const expectedSources = (await walk(srcRoot)).filter(isTestableSource);
const report = JSON.parse(await readFile(summaryPath, "utf8"));
const reportedFiles = Object.keys(report).filter((key) => key !== "total");

console.log("[coverage:baseline]", JSON.stringify({
  expectedSourceFiles: expectedSources.length,
  reportedSourceFiles: reportedFiles.length,
  total: report.total,
}));

if (reportedFiles.length < expectedSources.length) {
  console.error(
    `[coverage:baseline] relatório incompleto: ${reportedFiles.length}/${expectedSources.length} arquivos-fonte instrumentados.`,
  );
  process.exit(1);
}

for (const metric of ["statements", "branches", "functions", "lines"]) {
  const value = report.total?.[metric]?.pct;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    console.error(`[coverage:baseline] métrica inválida: ${metric}`);
    process.exit(1);
  }
}

// Gate progressivo (ratchet): coverage nao pode regredir abaixo do baseline versionado.
const baselinePath = path.join(webRoot, "..", "..", "scripts", "web-coverage-baseline.json");
const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
for (const metric of ["statements", "branches", "functions", "lines"]) {
  const value = report.total[metric].pct;
  const floor = baseline.floors?.[metric];
  if (typeof floor === "number" && value < floor) {
    console.error(
      `[coverage:baseline] regressão de coverage em ${metric}: ${value}% < piso ${floor}% (baseline ${baseline.measuredAt}).`,
    );
    process.exit(1);
  }
}
console.log("[coverage:baseline] gate progressivo OK (sem regressão contra o baseline).");
