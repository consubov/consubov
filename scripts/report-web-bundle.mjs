import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const webRoot = process.cwd();
const distDir = path.join(webRoot, "dist");
const assetsDir = path.join(distDir, "assets");

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

try {
  await stat(assetsDir);
} catch {
  console.error("[bundle] dist/assets não existe. Execute o build antes do relatório.");
  process.exit(1);
}

const files = (await walk(assetsDir)).filter((file) => /\.(?:js|css)$/.test(file));
const rows = [];

for (const file of files) {
  const content = await readFile(file);
  rows.push({
    file: path.relative(distDir, file),
    bytes: content.byteLength,
    gzipBytes: gzipSync(content).byteLength,
  });
}

rows.sort((a, b) => b.bytes - a.bytes);

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    files: rows.length,
    bytes: rows.reduce((sum, row) => sum + row.bytes, 0),
    gzipBytes: rows.reduce((sum, row) => sum + row.gzipBytes, 0),
  },
  largest: rows.slice(0, 20),
};

await writeFile(path.join(distDir, "bundle-report.json"), JSON.stringify(report, null, 2) + "\n");

console.log("[bundle:baseline]", JSON.stringify(report.totals));
for (const row of report.largest.slice(0, 10)) {
  console.log(`[bundle] ${row.file} raw=${row.bytes} gzip=${row.gzipBytes}`);
}
