import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import * as ts from "typescript";
import { translateStaticUiText } from "@/components/i18n/LocalizedText";

const root = resolve(process.cwd(), "src");
const sources = (folder: string): string[] =>
  readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return entry.name === "ui" || entry.name === "test"
      ? [] : sources(join(folder, entry.name));
    return entry.name.endsWith(".tsx") ? [join(folder, entry.name)] : [];
  });
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("I18N-025 — direct operational notifications", () => {
  it("translates every reviewed notification while retaining Portuguese originals", () => {
    const pairs = [
      ["Removido", "Removed"],
      ["Marcado como pago", "Marked as paid"],
      ["Empresa atualizada", "Company updated"],
      ["Empresa criada", "Company created"],
      ["App pronto para uso offline", "App ready for offline use"],
      ["Tudo sincronizado. Modo Offline desativado.", "Everything synced. Offline mode deactivated."],
      ["PDF baixado — envie manualmente pelo seu app preferido.", "PDF downloaded — share it manually using your preferred app."],
    ] as const;
    for (const [pt, en] of pairs) {
      expect(translateStaticUiText("en-US", pt), pt).toBe(en);
      expect(translateStaticUiText("pt-BR", pt), pt).toBe(pt);
    }
  });

  it("does not leave static toast or confirm texts except the isolated credential warning", () => {
    const unlocalized: string[] = [];
    for (const file of [ ...sources(resolve(root, "pages")), ...sources(resolve(root, "components")) ]) {
      const code = readFileSync(file, "utf8");
      const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const walk = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && node.arguments[0]) {
          const target = node.expression.getText(ast);
          const first = node.arguments[0];
          if (/^(toast\.[a-z]+|confirm|alert|window\.confirm|window\.alert)$/.test(target)
            && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) {
            const knownSensitive = file.endsWith("/pages/CapatazesPage.tsx")
              && first.text.startsWith("Capataz criado! Senha padrão:");
            if (!knownSensitive) unlocalized.push(file + ": " + first.text);
          }
        }
        ts.forEachChild(node, walk);
      };
      walk(ast);
    }
    expect(unlocalized).toEqual([]);
  });

  it("preserves SyncVet payment and company operations", () => {
    const accounts = read("pages/SyncVetContasPage.tsx");
    const company = read("pages/SyncVetEmpresaPage.tsx");
    expect(accounts).toContain('toast.success(uiText("Marcado como pago"))');
    expect(accounts).toContain('currency: "BRL"');
    expect(company).toContain('toast.success(uiText("Empresa atualizada"))');
    expect(company).toContain('toast.success(uiText("Empresa criada"))');
    expect(company).toContain('supabase.from("syncvet_empresas")');
  });

  it("keeps offline syncing behavior and downloaded PDF handling untouched", () => {
    const offline = read("components/maisarrobas/ModoOfflinePanel.tsx");
    const viewer = read("components/consultor/PdfViewerDialog.tsx");
    expect(offline).toContain('toast.success(uiText("App pronto para uso offline"))');
    expect(offline).toContain('toast.success(uiText("Tudo sincronizado. Modo Offline desativado."))');
    expect(viewer).toContain('toast.success(uiText("PDF baixado — envie manualmente pelo seu app preferido."))');
  });
});

describe("I18N-025 — dynamic notices", () => {
  it("localizes SyncVet team deletion without changing the member name", () => {
    const page = read("pages/SyncVetEquipePage.tsx");
    expect(page).toContain('confirm(');
    expect(page).toContain('uiText("Remover ")');
    expect(page).toContain("m.nome");
    expect(page).toContain("equipe_id: m.id");
  });

  it("has no untranslated Portuguese template-literal toast or confirm notice", () => {
    const untranslated: string[] = [];
    const portugueseCopy = /[ãõáéíóúâêôç]|(?:^|\b)(?:Erro|Falha|Selecione|Remover|Atualizado|Criado|Informe|Nenhum|Dados|Pasto|Fazenda|Animal|Visita|Lote|Deseja|Solicitação)(?:\b|$)/i;
    for (const file of [...sources(resolve(root, "pages")), ...sources(resolve(root, "components"))]) {
      const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && node.arguments.length > 0) {
          const name = node.expression.getText(ast);
          const message = node.arguments[0];
          if (/^(toast\.[a-z]+|confirm|alert)$/.test(name) && ts.isTemplateExpression(message)
            && !message.getText(ast).includes("uiText(")) {
            const fixedParts = [message.head.text, ...message.templateSpans.map((span) => span.literal.text)];
            if (fixedParts.some((part) => portugueseCopy.test(part))) {
              untranslated.push(file.replace(root, "") + ": " + name);
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
    expect(untranslated).toEqual([]);
  });
});
