import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import english from "@/lib/staticUiEnglish.json";
import { translateStaticUiText } from "@/components/i18n/LocalizedText";

const pages = [
  "MateriasPrimasPage",
  "EntradaMateriasPrimasPage",
  "FabricasPage",
  "FormulasSistemaPage",
  "ConsultorConfiguracoesPage",
  "CiclosPage",
  "AuditoriaConfigPage",
] as const;

const source = (name: string) =>
  readFileSync(resolve(process.cwd(), "src/pages", name + ".tsx"), "utf8");

describe("I18N-018 — matérias-primas, fábricas, ciclos e configurações", () => {
  it("has reviewed bilingual messages and preserves data coming from users", () => {
    const pairs = [
      ["Unidade é obrigatória", "Unit is required"],
      ["Matéria-prima atualizada!", "Raw material updated!"],
      ["Selecione a fábrica", "Select a feed mill"],
      ["Fábrica criada: ", "Feed mill created: "],
      ["Fábrica e operadores removidos.", "Feed mill and operators removed."],
      ["Erro ao carregar fórmulas", "Failed to load formulas"],
      ["Fórmula atualizada", "Formula updated"],
      ["Não foi possível criar a categoria.", "Could not create the category."],
      ["Categoria excluída", "Category deleted"],
      ["Nova categoria de dieta", "New diet category"],
      ["Ciclo reaberto com sucesso", "Cycle reopened successfully"],
      ["Erro ao excluir ciclo", "Failed to delete cycle"],
      ["Deseja reabrir este ciclo? Ele voltará para edição.", "Reopen this cycle? It will become editable again."],
      ["Erro ao salvar configuração", "Failed to save settings"],
      ["Configuração salva com sucesso", "Settings saved successfully"],
      ["Trocar foto", "Change photo"],
    ] as const;
    for (const [pt, en] of pairs) {
      expect(translateStaticUiText("en-US", pt), pt).toBe(en);
      expect(translateStaticUiText("pt-BR", pt), pt).toBe(pt);
    }
    expect(translateStaticUiText("en-US", "Fazenda Horizonte 04")).toBe("Fazenda Horizonte 04");
  });

  it("maps all static uiText arguments and leaves no direct toast or confirm literals", () => {
    let reviewed = 0;
    for (const name of pages) {
      const content = source(name);
      const ast = ts.createSourceFile(name, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      expect(content, name).toContain("useStaticUiText");
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
          const fn = node.expression.getText(ast);
          const first = node.arguments[0];
          if (/^(?:toast\.(?:error|success|warning|info|loading)|confirm)$/.test(fn)) {
            expect(first && !ts.isStringLiteral(first), name + " direct " + fn).toBeTruthy();
          }
          if (fn === "uiText" && first) {
            const literals: string[] = [];
            const collect = (expr: ts.Expression) => {
              if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
                literals.push(expr.text);
              } else if (ts.isConditionalExpression(expr)) {
                collect(expr.whenTrue);
                collect(expr.whenFalse);
              }
            };
            collect(first);
            for (const label of literals) {
              expect(Object.prototype.hasOwnProperty.call(english, label), name + ": " + label).toBe(true);
              reviewed++;
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
    expect(reviewed).toBeGreaterThan(35);
  });

  it("formats display-only dates, months and durations in the selected language", () => {
    const entry = source("EntradaMateriasPrimasPage");
    const cycles = source("CiclosPage");
    expect(entry).toContain("new Date(e.data_entrada).toLocaleDateString(language)");
    expect(cycles).toContain("new Date(c.data_inicio).toLocaleDateString(language)");
    expect(cycles).toContain("new Date(c.fechado_em).toLocaleDateString(language)");
    expect(cycles).toContain('language === "en-US" ? monthsEn : meses');
    expect(cycles).toContain('uiText(c.duracao_dias === 1 ? "dia" : "dias")');
    expect(entry).toContain('setDataEntrada(new Date().toISOString().slice(0, 10))');
  });

  it("does not translate operational identifiers or user-provided names", () => {
    const factory = source("FabricasPage");
    const entry = source("EntradaMateriasPrimasPage");
    const material = source("MateriasPrimasPage");
    expect(factory).toContain("data?.codigo");
    expect(factory).toContain('supabase.from("fabricas")');
    expect(material).toContain("{m.nome}");
    expect(material).toContain("{m.unidade}");
    expect(entry).toContain("{mpMap[e.materia_prima_id]");
    expect(entry).toContain("{fbMap[e.fabrica_id]");
  });
});
