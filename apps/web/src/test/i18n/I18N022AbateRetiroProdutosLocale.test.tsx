import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import english from "@/lib/staticUiEnglish.json";
import { translateStaticUiText } from "@/components/i18n/LocalizedText";

const files = [
  "pages/GerentePrevisaoAbatePage.tsx",
  "components/retiro/RetiroConfigSection.tsx",
  "components/produtos/OndeUsarGerente.tsx",
] as const;
const source = (file: string) =>
  readFileSync(resolve(process.cwd(), "src", file), "utf8");

describe("I18N-022 — previsão, retiros e uso de produtos", () => {
  it("translates reviewed messages and preserves PT-BR", () => {
    const pairs = [
      ["Erro ao calcular previsão: ", "Could not calculate forecast: "],
      ["Configuração de abate salva", "Slaughter forecast settings saved"],
      ["Preencha peso-alvo e dias juntos.", "Enter target weight and days together."],
      ["Peso-alvo deve estar entre 100 e 1200 kg.", "Target weight must be between 100 and 1200 kg."],
      ["Dias deve ser um número inteiro entre 1 e 365.", "Days must be a whole number between 1 and 365."],
      ["Configurações salvas!", "Settings saved!"],
      ["Alterações salvas!", "Changes saved!"],
      ["Buscar pasto", "Search pasture"],
      ["Aplicar…", "Apply…"],
      ["Seguindo a fazenda", "Following ranch settings"],
    ] as const;
    for (const [pt, en] of pairs) {
      expect(translateStaticUiText("en-US", pt), pt).toBe(en);
      expect(translateStaticUiText("pt-BR", pt), pt).toBe(pt);
    }
    expect(translateStaticUiText("en-US", "Retiro Campo Verde")).toBe("Retiro Campo Verde");
  });

  it("maps every fixed uiText argument in the changed pages", () => {
    let reviewed = 0;
    for (const file of files) {
      const text = source(file);
      expect(text).toContain("useStaticUiText");
      const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const walk = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          const name = node.expression.getText(ast);
          const arg = node.arguments[0];
          if (/^toast\.(error|success|warning|info)$/.test(name)) {
            expect(arg && !ts.isStringLiteral(arg), file).toBeTruthy();
          }
          if (name === "uiText" && arg && ts.isStringLiteral(arg)) {
            expect(Object.prototype.hasOwnProperty.call(english, arg.text), file + ": " + arg.text).toBe(true);
            reviewed++;
          }
        }
        ts.forEachChild(node, walk);
      };
      walk(ast);
    }
    expect(reviewed).toBeGreaterThan(13);
  });

  it("formats prediction values and dates for the chosen language", () => {
    const preview = source(files[0]);
    expect(preview).toContain('Number(n).toLocaleString(locale,');
    expect(preview).toContain('locale === "en-US" ?');
    expect(preview).toContain('fmtData(p.data_prevista, language)');
    expect(preview).toContain('nf(value, digits, language)');
    expect(preview).toContain('uiText(v)');
    expect(preview).toContain('uiText("Seguindo a fazenda")');
  });

  it("does not change business constraints, database writes or IDs", () => {
    const preview = source(files[0]);
    const retiro = source(files[1]);
    const products = source(files[2]);
    expect(preview).toContain('peso < 100 || peso > 1200');
    expect(preview).toContain('dias < 1 || dias > 365');
    expect(preview).toContain('rpc("previsao_abate"');
    expect(preview).toContain('supabase as any).from("abate_config")');
    expect(retiro).toContain('supabase.from("retiros").update({');
    expect(retiro).toContain("camposProdutoParaRetiro(prod, produtoId, prev)");
    expect(products).toContain("retPend[r.id]");
    expect(products).toContain("pastoPend[p.id]");
  });
});
