import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import english from "@/lib/staticUiEnglish.json";
import { translateStaticUiText } from "@/components/i18n/LocalizedText";

const files = [
  "pages/ConsultorDespesasPage.tsx",
  "pages/RelatorioSalgaPage.tsx",
  "components/sync/SyncCapatazPanel.tsx",
  "components/capataz/EditarQuantidadeCapatazModal.tsx",
  "pages/GerenteGmdPage.tsx",
] as const;
const src = (f: string) => readFileSync(resolve(process.cwd(), "src", f), "utf8");

describe("I18N-021 — fuel expenses, salt reports, sync and GMD", () => {
  it("has reviewed EN-US equivalents and falls back to the original PT-BR", () => {
    const pairs = [
      ["Preencha valor e foto", "Enter an amount and add a photo"],
      ["Cupom já vinculado a um relatório", "This receipt is already linked to a report"],
      ["Sem cupons pendentes no período", "No pending receipts in this period"],
      ["Relatório gerado", "Report generated"],
      ["PDF gerado localmente; cópia no servidor não confirmada.", "PDF generated locally; server copy not confirmed."],
      ["Última salga: ", "Last salt supplementation: "],
      ["Erro ao carregar dados: ", "Could not load data: "],
      ["Nenhum capataz com conta vinculada na seleção atual", "No ranch supervisors with linked accounts in the current selection"],
      ["Sinal enviado para ", "Sync signal sent to "],
      ["capataz", "ranch supervisor"],
      ["capatazes", "ranch supervisors"],
      ["Pasto zerado com sucesso!", "Pasture reset successfully!"],
      ["Erro ao zerar pasto: ", "Failed to clear pasture: "],
      ["Escolha como o GMD será definido nesta fazenda.", "Choose how average daily gain will be defined for this ranch."],
      ["Configuração de GMD salva", "Average daily gain settings saved"],
    ] as const;
    for (const [pt, en] of pairs) {
      expect(translateStaticUiText("en-US", pt), pt).toBe(en);
      expect(translateStaticUiText("pt-BR", pt), pt).toBe(pt);
    }
    expect(translateStaticUiText("en-US", "Fazenda do Cerrado")).toBe("Fazenda do Cerrado");
  });

  it("catalogs reviewed UI messages and never leaves a fixed toast string", () => {
    let checked = 0;
    for (const file of files) {
      const code = src(file);
      expect(code).toContain("useStaticUiText");
      const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          const name = node.expression.getText(ast);
          const arg = node.arguments[0];
          if (/^toast\.(error|success|info|warning)$/.test(name)) {
            expect(arg && !ts.isStringLiteral(arg), file + ": " + name).toBeTruthy();
            expect(arg && !ts.isNoSubstitutionTemplateLiteral(arg), file + ": " + name).toBeTruthy();
          }
          if (name === "uiText" && arg) {
            const check = (value: ts.Expression): void => {
              if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
                expect(Object.prototype.hasOwnProperty.call(english, value.text), file + ": " + value.text).toBe(true);
                checked++;
              } else if (ts.isConditionalExpression(value)) {
                check(value.whenTrue);
                check(value.whenFalse);
              }
            };
            check(arg);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
    expect(checked).toBeGreaterThan(25);
  });

  it("renders BRL values in the selected locale without changing currency or PDF fields", () => {
    const expenses = src(files[0]);
    const localized = expenses.match(/toLocaleString\(language, \{ style: "currency", currency: "BRL" \}\)/g);
    expect(localized).toHaveLength(6);
    expect(expenses).not.toContain('toLocaleString("pt-BR", { style: "currency", currency: "BRL" })');
    expect(expenses).toContain("gerarDespesasPdf({");
    expect(expenses).toContain("language,");
    expect(expenses).toContain("valor_total,");
    expect(expenses).toContain("tipo_periodo: genTipo");
  });

  it("localizes salt report UI while preserving its stored period/PDF contract", () => {
    const report = src(files[1]);
    expect(report).toContain("new Date(ultimaSalgaDate).toLocaleDateString(language)");
    expect(report).toContain('new Date(2020, i, 1).toLocaleString(language, { month: "long" })');
    expect(report).toContain('uiText("Última salga: ")');
    expect(report).toContain("periodoLabel: getPeriodoDisplay()");
    expect(report).toContain("gerarPdfSalga");
  });

  it("keeps sync commands and pasture/GMD persisted values unchanged", () => {
    const sync = src(files[2]);
    const pasture = src(files[3]);
    const gmd = src(files[4]);
    expect(sync).toContain('command: "sync"');
    expect(sync).toContain('supabase.from("sync_commands").insert(rows)');
    expect(sync).toContain("formatTime(lastSync, language)");
    expect(sync).toContain('uiText(pending === 1 ? "pendente" : "pendentes")');
    expect(pasture).toContain("faltaCategoria(qtdNum, form.categoria)");
    expect(pasture).toContain("num_animais: qtdNum");
    expect(pasture).toContain("categoria: form.categoria || null");
    expect(gmd).toContain('parseGmd(v) === "invalid"');
    expect(gmd).toContain('gmd_kg: parseGmd(draftCat[item.key][category]) as number | null');
    expect(gmd).toContain('uiText("Configuração de GMD salva")');
  });
});
