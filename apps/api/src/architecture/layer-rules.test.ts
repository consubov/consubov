import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import {
  collectSourceFiles,
  extractImportSpecifiers,
  findForbiddenImports,
  moduleNameOf,
} from "./layer-rules";

const SRC_ROOT = fileURLToPath(new URL("..", import.meta.url));

describe("layer dependency rules (fixtures)", () => {
  test("accepts a valid domain layer with pure imports", () => {
    const violations = findForbiddenImports([
      {
        path: "src/modules/security/domain/identity.ts",
        content: 'import { Err } from "./errors";\nexport type TenantId = string;',
      },
    ]);

    expect(violations).toEqual([]);
  });

  test("flags domain importing interfaces, platform, integrations and supabase", () => {
    const violations = findForbiddenImports([
      {
        path: "src/modules/x/domain/a.ts",
        content:
          'import { h } from "../interfaces/http/handler";\nimport { c } from "@supabase/supabase-js";\nimport { p } from "../platform/clock";\nimport { i } from "../integrations/syncvet";',
      },
    ]);

    const rules = violations.map((v) => v.rule);
    expect(rules).toContain("domain-forbidden-import");
    expect(violations.length).toBeGreaterThanOrEqual(3);
  });

  test("flags domain referencing react, vite, storage globals", () => {
    const violations = findForbiddenImports([
      {
        path: "src/modules/x/domain/a.ts",
        content: "const el = document.createElement('div'); localStorage.setItem('k','v'); indexedDB.open('db');",
      },
    ]);

    expect(violations.map((v) => v.rule)).toContain("domain-forbidden-token");
  });

  test("flags application importing interfaces/http", () => {
    const violations = findForbiddenImports([
      {
        path: "src/modules/x/application/use-case.ts",
        content: 'import { handler } from "../interfaces/http/handler";',
      },
    ]);

    expect(violations.map((v) => v.rule)).toContain(
      "application-forbidden-import",
    );
  });

  test("accepts application importing domain and ports", () => {
    const violations = findForbiddenImports([
      {
        path: "src/modules/x/application/use-case.ts",
        content:
          'import { TenantId } from "../domain/identity";\nimport type { Port } from "../domain/ports";',
      },
    ]);

    expect(violations).toEqual([]);
  });

  test("extracts import and re-export specifiers", () => {
    const specifiers = extractImportSpecifiers(
      'import a from "x";\nexport * from "./y";\nconst b = require("z");',
    );

    expect(specifiers).toEqual(["x", "./y", "z"]);
  });

  test("resolves the owning module from the file path", () => {
    expect(moduleNameOf("src/modules/identity-tenancy/domain/identity.ts")).toBe(
      "identity-tenancy",
    );
    expect(
      moduleNameOf("src\\modules\\integrations\\domain\\ports.ts"),
    ).toBe("integrations");
    expect(moduleNameOf("src/app.ts")).toBeNull();
  });

  test("accepts the integrations module importing its own integrations path", () => {
    const violations = findForbiddenImports([
      {
        path: "src/modules/integrations/domain/ports.ts",
        content: 'import { adapter } from "../integrations/adapter";',
      },
    ]);

    expect(violations).toEqual([]);
  });

  test("still flags the integrations module domain for provider imports", () => {
    const violations = findForbiddenImports([
      {
        path: "src/modules/integrations/domain/ports.ts",
        content:
          'import { client } from "@supabase/supabase-js";\nimport { view } from "react";',
      },
    ]);

    expect(violations.length).toBeGreaterThanOrEqual(2);
  });

  test("flags domain importing adapter and infrastructure layers", () => {
    const violations = findForbiddenImports([
      {
        path: "src/modules/x/domain/a.ts",
        content:
          'import { fake } from "../adapters/fakes";\nimport { repo } from "../infrastructure/repo";',
      },
    ]);

    const details = violations.map((v) => v.detail);

    expect(violations.every((v) => v.rule === "domain-forbidden-import")).toBe(
      true,
    );
    expect(details.join(" ")).toContain("../adapters/fakes");
    expect(details.join(" ")).toContain("../infrastructure/repo");
  });
});

describe("layer dependency rules (repository)", () => {
  test("no forbidden imports in any domain/application file", () => {
    const files = collectSourceFiles(SRC_ROOT);
    const violations = findForbiddenImports(files);

    expect(violations).toEqual([]);
  });
});
