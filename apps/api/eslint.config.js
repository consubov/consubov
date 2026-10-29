import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";
import { lstatSync, realpathSync, openSync, fstatSync, readSync, closeSync, constants } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { relative } from "node:path";

function auditedArchitectureFile(file, expectedHash) {
  const source = fileURLToPath(new URL(file, import.meta.url));
  try {
    const info = lstatSync(source);
    if (!info.isFile() || info.isSymbolicLink() || relative(source, realpathSync(source)) !== "" || info.size > 64 * 1024) return false;
    const fd = openSync(source, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const opened = fstatSync(fd);
      if (!opened.isFile() || opened.dev !== info.dev || opened.ino !== info.ino || opened.size > 64 * 1024) return false;
      const bytes = Buffer.alloc(64 * 1024 + 1); let used = 0;
      while (used < bytes.length) { const count = readSync(fd, bytes, used, bytes.length - used, null); if (!count) break; used += count; }
      return used <= 64 * 1024 && createHash("sha256").update(bytes.subarray(0, used)).digest("hex") === expectedHash;
    } finally { closeSync(fd); }
  } catch { return false; }
}

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
    plugins: {
      security,
    },
    rules: {
      "security/detect-eval-with-expression": "warn",
      "security/detect-non-literal-fs-filename": "warn",
      "security/detect-object-injection": "off",
      "security/detect-possible-timing-attacks": "warn",
    },
  },
  // Revalidated 2026-10-24: this test-only source collector is a reviewed dynamic-FS hotspot. Its plain
  // root, links, containment and read bounds are audited in the sealed bytes.
  // Any source change or missing/linked file restores the normal warning.
  ...(auditedArchitectureFile("./src/architecture/layer-rules.ts", "51c32d28a954ba816852842c5029fcab0196720d4f3a18cb3f562f91b544cfdc") ? [{
    files: ["src/architecture/layer-rules.ts"],
    rules: { "security/detect-non-literal-fs-filename": "off" },
  }] : []),
  // Revalidated 2026-10-24: only the exact audited owned-fixture setup/cleanup receives this exception;
  // changed test bytes restore warnings, and all other tests keep the rule.
  ...(auditedArchitectureFile("./src/architecture/layer-rules.test.ts", "37e742b60f4adb1e7ee7e822c9a8a96bd668f517fc60416fbd5390485c254caa") ? [{
    files: ["src/architecture/layer-rules.test.ts"],
    rules: { "security/detect-non-literal-fs-filename": "off" },
  }] : []),
);
