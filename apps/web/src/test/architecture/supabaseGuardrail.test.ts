import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Commit da main que congelou o baseline funcional antes das mudanças da FASE 3.
// O CI usa histórico completo para comparar qualquer alteração posterior com ele.
const PHASE_3_SUPABASE_BASELINE = "c5196bf732af7420c2022e12016aa89c1ab67f06";
const REPO_ROOT = resolve(process.cwd(), "../..");
const GUARDRAIL_FILE =
  "apps/web/src/test/architecture/supabaseGuardrail.test.ts";

const directClientImport =
  /(?:from\s+["'][^"']*integrations\/supabase\/client["']|import\s*["'][^"']*integrations\/supabase\/client["']|import\s*\(\s*["'][^"']*integrations\/supabase\/client["']\s*\))/;
const directSdkImport =
  /(?:from\s+["']@supabase\/supabase-js["']|import\s*["']@supabase\/supabase-js["']|import\s*\(\s*["']@supabase\/supabase-js["']\s*\))/;

export type DirectSupabaseAddition = {
  file: string;
  line: string;
};

export function findDirectSupabaseImportAdditions(
  diff: string,
): DirectSupabaseAddition[] {
  const additions: DirectSupabaseAddition[] = [];
  let currentFile = "";

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice("+++ b/".length);
      continue;
    }

    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    if (currentFile === GUARDRAIL_FILE) continue;

    const sourceLine = line.slice(1);
    const repositoryBoundary =
      /^apps\/web\/src\/features\/[^/]+\/repositories\/[^/]+\.(ts|tsx)$/.test(currentFile);
    const importsLegacyClient =
      directClientImport.test(sourceLine) && !repositoryBoundary;
    const importsSdkOutsideAdapter =
      directSdkImport.test(sourceLine) &&
      currentFile !== "apps/web/src/integrations/supabase/client.ts" &&
      !repositoryBoundary;

    if (importsLegacyClient || importsSdkOutsideAdapter) {
      additions.push({ file: currentFile || "[unknown]", line: sourceLine.trim() });
    }
  }

  return additions;
}

function gitDiff(args: string[]): string {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function collectRelevantDiff(): string {
  try {
    gitDiff(["cat-file", "-e", `${PHASE_3_SUPABASE_BASELINE}^{commit}`]);
  } catch {
    throw new Error(
      "Phase 3 Supabase guardrail requires full git history. Configure checkout with fetch-depth: 0.",
    );
  }

  return [
    gitDiff([
      "diff",
      "--unified=0",
      `${PHASE_3_SUPABASE_BASELINE}...HEAD`,
      "--",
      "apps/web/src",
    ]),
    gitDiff(["diff", "--cached", "--unified=0", "--", "apps/web/src"]),
    gitDiff(["diff", "--unified=0", "--", "apps/web/src"]),
  ].join("\n");
}

describe("Supabase direct import guardrail", () => {
  it("detects direct client and SDK imports in added lines", () => {
    const syntheticDiff = [
      "diff --git a/apps/web/src/pages/Test.tsx b/apps/web/src/pages/Test.tsx",
      "+++ b/apps/web/src/pages/Test.tsx",
      '+import { supabase } from "@/integrations/supabase/client";',
      '+import { createClient } from "@supabase/supabase-js";',
      '+const sdk = await import("@supabase/supabase-js");',
      '+import "@supabase/supabase-js";',
      "-import { supabase } from \"@/integrations/supabase/client\";",
    ].join("\n");

    expect(findDirectSupabaseImportAdditions(syntheticDiff)).toEqual([
      {
        file: "apps/web/src/pages/Test.tsx",
        line: 'import { supabase } from "@/integrations/supabase/client";',
      },
      {
        file: "apps/web/src/pages/Test.tsx",
        line: 'import { createClient } from "@supabase/supabase-js";',
      },
      {
        file: "apps/web/src/pages/Test.tsx",
        line: 'const sdk = await import("@supabase/supabase-js");',
      },
      {
        file: "apps/web/src/pages/Test.tsx",
        line: 'import "@supabase/supabase-js";',
      },
    ]);
  });

  it("allows direct provider access only behind a feature repository boundary", () => {
    const repositoryDiff = [
      "+++ b/apps/web/src/features/auth/repositories/authRecoveryRepository.ts",
      '+import { supabase } from "@/integrations/supabase/client";',
    ].join("\n");

    expect(findDirectSupabaseImportAdditions(repositoryDiff)).toEqual([]);
  });

  it("ignores its own synthetic fixture strings in the repository diff", () => {
    const selfDiff = [
      `+++ b/${GUARDRAIL_FILE}`,
      '+import { supabase } from "@/integrations/supabase/client";',
    ].join("\n");

    expect(findDirectSupabaseImportAdditions(selfDiff)).toEqual([]);
  });

  it("rejects new direct Supabase imports after the frozen Phase 3 baseline", () => {
    const violations = findDirectSupabaseImportAdditions(collectRelevantDiff());

    expect(
      violations,
      `New direct Supabase imports detected:\n${violations
        .map(({ file, line }) => `${file}: ${line}`)
        .join("\n")}\nMove the access behind the existing repository/service boundary instead.`,
    ).toEqual([]);
  });
});
