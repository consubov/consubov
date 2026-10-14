import { readdirSync, lstatSync, realpathSync, openSync, fstatSync, readSync, closeSync, constants } from "node:fs";
import { join, resolve, relative, isAbsolute, sep } from "node:path";

export type SourceFile = {
  path: string;
  content: string;
};

export type Violation = {
  file: string;
  rule: string;
  detail: string;
};

const IMPORT_SPECIFIER =
  /(?:import|export)[\s\S]*?from\s*["']([^"']+)["']|(?:import|require)\s*\(?\s*["']([^"']+)["']/g;

export function extractImportSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  for (const match of content.matchAll(IMPORT_SPECIFIER)) {
    specifiers.push(match[1] ?? match[2]);
  }
  return specifiers;
}

const FORBIDDEN_DOMAIN_TOKENS = [
  "supabase",
  "@supabase",
  "react",
  "vite",
  "localStorage",
  "indexedDB",
  "aws-sdk",
  "firebase",
] as const;

const FORBIDDEN_DOMAIN_IMPORT_PATTERNS = [
  /(^|\/)(interfaces|platform|adapters|infrastructure)(\/|$)/,
  /supabase/i,
  /(^|\/)apps\/web(\/|$)/,
  /\breact(-dom)?\b/,
  /vite/i,
  /@radix-ui/,
  /@vitejs/,
  /aws-sdk/i,
  /firebase/i,
] as const;

// `integrations` is a layer that domain code must never reach, but the ADR also
// names a module after it. The rule therefore only applies when the file belongs
// to a different module, so `modules/integrations/**` keeps its own domain able
// to import its own adapters path without weakening the boundary for others.
const FORBIDDEN_CROSS_MODULE_PATTERN = /(^|\/)integrations(\/|$)/;

function isInLayer(path: string, layer: string): boolean {
  return path.includes(`/${layer}/`) || path.includes(`\\${layer}\\`);
}

export function moduleNameOf(path: string): string | null {
  const normalized = path.replace(/\\/g, "/");
  const match = normalized.match(/(?:^|\/)modules\/([^/]+)\//);

  return match?.[1] ?? null;
}

export function findForbiddenImports(files: SourceFile[]): Violation[] {
  const violations: Violation[] = [];

  for (const file of files) {
    const specifiers = extractImportSpecifiers(file.content);

    if (isInLayer(file.path, "domain")) {
      const ownModule = moduleNameOf(file.path);
      const patterns = [
        ...FORBIDDEN_DOMAIN_IMPORT_PATTERNS,
        ...(ownModule === "integrations"
          ? []
          : [FORBIDDEN_CROSS_MODULE_PATTERN]),
      ];

      for (const specifier of specifiers) {
        for (const pattern of patterns) {
          if (pattern.test(specifier)) {
            violations.push({
              file: file.path,
              rule: "domain-forbidden-import",
              detail: `domain importa "${specifier}"`,
            });
          }
        }
      }

      const codeOnly = file.content
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|\s)\/\/.*$/gm, "");

      for (const token of FORBIDDEN_DOMAIN_TOKENS) {
        if (codeOnly.toLowerCase().includes(token.toLowerCase())) {
          violations.push({
            file: file.path,
            rule: "domain-forbidden-token",
            detail: `domain referencia "${token}"`,
          });
        }
      }
    }

    if (isInLayer(file.path, "application") || isInLayer(file.path, "contracts")) {
      const patterns = [
        /(^|\/)interfaces(\/|$)/,
        /supabase/i,
        /(^|\/)apps\/web(\/|$)/,
        /\breact(-dom)?\b/,
        /vite/i,
        /@radix-ui/,
        /@vitejs/,
        /aws-sdk/i,
        /firebase/i,
      ];

      for (const specifier of specifiers) {
        for (const pattern of patterns) {
          if (pattern.test(specifier)) {
            violations.push({
              file: file.path,
              rule: "application-forbidden-import",
              detail: `application importa "${specifier}"`,
            });
          }
        }
      }

      const codeOnly = file.content
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|\s)\/\/.*$/gm, "");

      for (const token of FORBIDDEN_DOMAIN_TOKENS) {
        if (codeOnly.toLowerCase().includes(token.toLowerCase())) {
          violations.push({
            file: file.path,
            rule: "application-forbidden-token",
            detail: `application referencia "${token}"`,
          });
        }
      }
    }
  }

  return violations;
}

export function collectSourceFiles(root: string): SourceFile[] {
  const files: SourceFile[] = [];
  const base = resolve(root), maxBytes = 1024 * 1024;
  const within = (value: string): boolean => {
    const part = relative(base, value);
    return !isAbsolute(part) && part !== ".." && !part.startsWith(".." + sep);
  };
  try {
    const rootInfo = lstatSync(base);
    if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory() || relative(base, realpathSync(base)) !== "") throw new Error();
    function plain(full: string) {
      const info = lstatSync(full);
      if (!within(full) || info.isSymbolicLink() || !within(realpathSync(full)) || (!info.isDirectory() && !info.isFile())) throw new Error();
      return info;
    }
    function walk(dir: string): void {
      if (!plain(dir).isDirectory()) throw new Error();
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isSymbolicLink()) throw new Error();
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
          const before = plain(full);
          if (!before.isFile() || before.size > maxBytes) throw new Error();
          const fd = openSync(full, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
          try {
            const opened = fstatSync(fd), current = plain(full);
            if (!opened.isFile() || opened.size > maxBytes || opened.dev !== before.dev || opened.ino !== before.ino || current.dev !== opened.dev || current.ino !== opened.ino) throw new Error();
            // Read at most limit+1 even if another local process grows the file.
            const buffer = Buffer.alloc(maxBytes + 1); let used = 0;
            while (used < buffer.length) {
              const count = readSync(fd, buffer, used, buffer.length - used, null);
              if (!count) break;
              used += count;
            }
            if (used > maxBytes) throw new Error();
            files.push({ path: full, content: buffer.subarray(0, used).toString("utf8") });
          } finally { closeSync(fd); }
        }
      }
    }
    walk(base);
  } catch {
    throw new Error("Source collection requires a bounded plain local source tree");
  }
  return files;
}
