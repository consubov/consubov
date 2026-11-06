import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import EN from "@/lib/staticUiEnglish.json";
import { translateStaticUiText } from "@/components/i18n/LocalizedText";
import { MSG_CATEGORIA_OBRIGATORIA } from "@/lib/categoriaPasto";

const paths = [
  "pages/FabricaDetailPage.tsx",
  "pages/RetiroDetailPage.tsx",
  "pages/AdminSyncVetOnboardingPage.tsx",
];
function source(file: string): string {
  return readFileSync(resolve(process.cwd(), "src", file), "utf8");
}

describe("I18N-014 — factory, ranch unit and veterinarian onboarding", () => {
  it("retains existing Portuguese copy and supplies reviewed EN messages", () => {
    const examples = [
      ["Excluir esta fábrica?", "Delete this feed mill?"],
      ["Entrada removida. Estoque ajustado.", "Entry removed. Inventory adjusted."],
      ["Editar Pasto", "Edit Pasture"],
      ["Nova Matéria-Prima", "New Raw Material"],
      ["Pasto criado!", "Pasture created!"],
      ["Informe o nome da empresa", "Enter the company name"],
      ["As senhas não coincidem", "Passwords do not match"],
      ["Empresa SyncVet criada com sucesso!", "SyncVet company created successfully!"],
    ] as const;
    for (const [pt, en] of examples) {
      expect(translateStaticUiText("pt-BR", pt)).toBe(pt);
      expect(translateStaticUiText("en-US", pt)).toBe(en);
    }
    expect(translateStaticUiText("en-US", MSG_CATEGORIA_OBRIGATORIA)).toContain("pasture category");
  });

  it("covers all literal UI toasts and browser confirmations in the three screens", () => {
    let count = 0;
    for (const file of paths) {
      const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const unlocalized: string[] = [];
      const scan = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
          const callee = node.expression.getText(ast);
          const target = /^(?:toast\.(?:error|success|info|warning)|confirm)$/.test(callee);
          if (target && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
            unlocalized.push(`${callee}: ${node.arguments[0].text}`);
          }
          if (callee === "uiText" && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
            const phrase = node.arguments[0].text;
            expect(Object.prototype.hasOwnProperty.call(EN, phrase), `${file}: ${phrase}`).toBe(true);
            count++;
          }
        }
        ts.forEachChild(node, scan);
      };
      scan(ast);
      expect(unlocalized, file).toEqual([]);
    }
    expect(count).toBeGreaterThan(30);
  });

  it("maintains raw persisted fields, enum values and stored names", () => {
    const factory = source(paths[0]);
    const ranch = source(paths[1]);
    const admin = source(paths[2]);
    expect(factory).toContain("materia_prima_id: materiaId");
    expect(factory).toContain("quantidade: qtd");
    expect(factory).toContain("role: \"usuario\"");
    expect(factory).toContain("fabrica_id: fabricaId");
    expect(ranch).toContain("categoria: form.categoria || null");
    expect(ranch).toContain("sexo: form.sexo || null");
    expect(ranch).toContain('if (sexo === "Fêmea")');
    expect(admin).toContain("const newUserId = await provisionProfileUser({");
    expect(admin).toContain("email: emailVet,");
    expect(admin).toContain("user_id: newUserId");
    expect(source("lib/profileProvisioning.ts")).toContain("const email = input.email.trim().toLowerCase()");
    expect(admin).toContain('perfil: "administrador"');
    expect(admin).toContain("toast.error(PARTIAL_PROFILE_MESSAGE)");
  });

  it("translates only fixed error prefixes, leaving backend error details intact", () => {
    const factory = source(paths[0]);
    const ranch = source(paths[1]);
    const admin = source(paths[2]);
    expect(factory).toContain('uiText("Erro: ") + err.message');
    expect(ranch).toContain('`${uiText("Erro: ")}${err?.message || uiText("Erro desconhecido")}`');
    expect(admin).toContain("toast.error(PARTIAL_PROFILE_MESSAGE)");
    expect(admin).toContain("err instanceof ProfileProvisioningError ? err.message");
    expect(admin).toContain("accountCreated ? PARTIAL_PROFILE_MESSAGE");
    expect(translateStaticUiText("en-US", "Pasto fazenda Delta-19")).toBe("Pasto fazenda Delta-19");
  });

  it("propagates locale to edit dialogs, accessibility labels and export PDF headings", () => {
    const factory = source(paths[0]);
    const ranch = source(paths[1]);
    expect(factory).toContain('uiText(editingId ? "Editar Operador" : "Novo Operador")');
    expect(factory).toContain('title={uiText("Editar quantidade")}');
    expect(factory).toContain('`${uiText("Fábrica — ")}${fabrica.nome}`');
    expect(ranch).toContain('uiText(editingId ? "Editar Pasto" : "Novo Pasto")');
    expect(ranch).toContain('placeholder={uiText("Automática")}');
    expect(ranch).toContain('configSummary.replace(/^Produto: /, uiText("Produto: "))');
  });
});
