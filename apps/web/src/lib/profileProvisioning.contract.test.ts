import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const sourceRoot = join(process.cwd(), "src");

function sourceFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = join(path, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")
      ? [full] : [];
  });
}

describe("all profile creation paths use one provisioner", () => {
  it("forbids direct create-user calls outside the shared safe boundary", () => {
    const files = sourceFiles(sourceRoot).filter((file) =>
      readFileSync(file, "utf8").includes('functions.invoke("create-user"'),
    );
    expect(files.map((f) => f.slice(sourceRoot.length + 1).replace(/\\/g, "/")))
      .toEqual(["lib/profileProvisioning.ts"]);
  });

  it("routes all existing role creators through the shared provisioner", () => {
    const creators = [
      "pages/CapatazesPage.tsx", "pages/GerentesPage.tsx",
      "pages/ConsultoresPage.tsx", "pages/PesadoresPage.tsx",
      "pages/OperadoresFabricaPage.tsx", "pages/FabricaDetailPage.tsx",
      "pages/SyncVetEquipePage.tsx", "pages/AdminSyncVetOnboardingPage.tsx",
      "components/admin/CriarEscritorioModal.tsx",
      "components/admin/CriarAdminModal.tsx",
    ];
    expect(creators).toHaveLength(10);
    for (const file of creators) {
      const code = readFileSync(join(sourceRoot, file), "utf8");
      expect(code, file).toContain("provisionProfileUser(");
    }
  });

  it("does not distribute the former shared default credential in active profile code", () => {
    const files = sourceFiles(sourceRoot);
    const unsafeFiles = files.filter((file) =>
      readFileSync(file, "utf8").includes("Consubov@2025"),
    );
    expect(unsafeFiles).toEqual([]);
  });

  it("requires a unique access password on capataz and office creation", () => {
    for (const file of [
      "pages/CapatazesPage.tsx",
      "components/admin/CriarEscritorioModal.tsx",
    ]) {
      const code = readFileSync(join(sourceRoot, file), "utf8");
      expect(code).toContain("PasswordInput");
      expect(code).toContain("confirmarSenha");
    }
  });
});
