import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const webRoot = process.cwd();
const distRoot = path.join(webRoot, "dist");
const textExtensions = new Set([".js", ".css", ".html", ".json", ".map", ".txt"]);
const patterns = [
  { name: "Supabase service role env name", regex: /SUPABASE_SERVICE_ROLE_KEY/g },
  { name: "generic service role env name", regex: /SERVICE_ROLE_KEY/g },
  { name: "private key marker", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "Stripe live secret", regex: /sk_live_[A-Za-z0-9]{16,}/g },
  { name: "GitHub classic token", regex: /ghp_[A-Za-z0-9]{20,}/g },
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else if (textExtensions.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

const findings = [];
for (const file of await walk(distRoot)) {
  const content = await readFile(file, "utf8");
  for (const { name, regex } of patterns) {
    regex.lastIndex = 0;
    if (regex.test(content)) findings.push({ file: path.relative(webRoot, file), pattern: name });
  }
}

if (findings.length > 0) {
  console.error("[dist-secrets] possível segredo/credencial administrativa no bundle Web:");
  for (const finding of findings) console.error(`- ${finding.file}: ${finding.pattern}`);
  process.exit(1);
}

console.log("[dist-secrets] nenhum padrão proibido encontrado no bundle Web.");
