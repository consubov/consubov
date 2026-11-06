import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import DICTIONARY from "@/lib/staticUiEnglish.json";
import { translateStaticUiText } from "@/components/i18n/LocalizedText";

const files = [
  "components/fabrica/ProducaoTab.tsx",
  "components/fabrica/TransferenciasTab.tsx",
  "components/fabrica/FormulasTab.tsx",
  "pages/TransferenciaRetiroPage.tsx",
] as const;
const source = (file: string) => readFileSync(resolve(process.cwd(), "src", file), "utf8");

const reviewed = [
  ["Fórmula criada!", "Formula created!"],
  ["Estoque insuficiente para: ", "Insufficient stock for: "],
  ["Batida iniciada! Estoque baixado.", "Batch started! Stock deducted."],
  ["Foto do setup inicial", "Initial setup photo"],
  ["Transferência registrada e notificações enviadas", "Transfer recorded and notifications sent"],
  ["Recebimento concluído", "Receipt completed"],
  ["A solicitação será cancelada. Nenhum animal será movimentado.", "The request will be cancelled. No animals will be moved."],
  ["Nenhuma transferência no histórico", "No transfers in history"],
  ["Soma ingredientes:", "Ingredient total:"],
  ["Aceita", "Accepted"],
] as const;

describe("I18N-015 — production, formulas and transfer UI localization", () => {
  it("preserves the Portuguese wording and shows reviewed English translations", () => {
    for (const [pt, en] of reviewed) {
      expect(translateStaticUiText("pt-BR", pt)).toBe(pt);
      expect(translateStaticUiText("en-US", pt)).toBe(en);
    }
    expect(translateStaticUiText("en-US", "Fazenda Inventada X17")).toBe("Fazenda Inventada X17");
  });

  it("ensures every literal uiText and LocalizedText used by the four screens has a dictionary entry", () => {
    let count = 0;
    for (const file of files) {
      const parsed = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const inspect = (node: ts.Node) => {
        if (ts.isCallExpression(node) && node.expression.getText(parsed) === "uiText") {
          const arg = node.arguments[0];
          const values = arg && ts.isStringLiteral(arg) ? [arg.text]
            : arg && ts.isConditionalExpression(arg)
              ? [arg.whenTrue, arg.whenFalse].filter(ts.isStringLiteral).map(x => x.text)
              : [];
          for (const pt of values) {
            expect(Object.prototype.hasOwnProperty.call(DICTIONARY, pt), `${file}: ${pt}`).toBe(true);
            count++;
          }
        }
        if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(parsed) === "LocalizedText") {
          const sourceAttr = node.attributes.properties.find(x => ts.isJsxAttribute(x) && x.name.getText(parsed) === "source");
          if (sourceAttr && ts.isJsxAttribute(sourceAttr) && sourceAttr.initializer && ts.isJsxExpression(sourceAttr.initializer)) {
            const arg = sourceAttr.initializer.expression;
            if (arg && ts.isStringLiteral(arg)) {
              expect(Object.prototype.hasOwnProperty.call(DICTIONARY, arg.text), `${file}: ${arg.text}`).toBe(true);
              count++;
            }
          }
        }
        ts.forEachChild(node, inspect);
      };
      inspect(parsed);
    }
    expect(count).toBeGreaterThan(85);
  });

  it("does not regress to hardcoded Portuguese toast and confirm messages", () => {
    for (const file of files) {
      const parsed = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const raw: string[] = [];
      const scan = (node: ts.Node) => {
        if (ts.isCallExpression(node) && /^(?:confirm|toast\.(?:error|success|info|warning|loading))$/.test(node.expression.getText(parsed))) {
          const arg = node.arguments[0];
          if (arg && ts.isStringLiteral(arg)) raw.push(arg.text);
        }
        ts.forEachChild(node, scan);
      };
      scan(parsed);
      expect(raw, file).toEqual([]);
    }
  });

  it("localizes only presentation while retaining persistent inventory and transfer status codes", () => {
    const production = source(files[0]);
    const transfers = source(files[1]);
    const formulas = source(files[2]);
    const ranch = source(files[3]);
    expect(production).toContain('status: "iniciada"');
    expect(production).toContain('status: "finalizada"');
    expect(production).toContain('estoque_atual: novo');
    expect(transfers).toContain('status: "em_transito"');
    expect(transfers).toContain('status: "finalizado"');
    expect(transfers).toContain('status: "concluida"');
    expect(formulas).toContain('materia_prima_id: i.materia_prima_id');
    expect(formulas).toContain('produto_id: form.produto_id');
    expect(ranch).toContain('case "PENDENTE":');
    expect(ranch).toContain('case "ACEITA":');
    expect(ranch).toContain('case "CANCELADA":');
    expect(ranch).toContain('{t.observacao}');
  });

  it("translates sack units and numeric formatting only when displayed", () => {
    const production = source(files[0]);
    expect(production).toContain('translateStaticUiText(language, " sacos")');
    expect(production).toContain('value.toLocaleString(language, { maximumFractionDigits: 2 })');
    expect(production).toContain('formatMateriaQuantidade(i.quantidade, mp, true, language)');
    expect(translateStaticUiText("pt-BR", " sacos")).toBe(" sacos");
    expect(translateStaticUiText("en-US", " sacos")).toBe(" bags");
    expect(production).toContain('estoque_atual: novo');
  });

  it("uses selected locale for visible dates, keeps stored ISO dates and names intact", () => {
    const production = source(files[0]);
    const transfers = source(files[1]);
    const ranch = source(files[3]);
    expect(production).toContain('.toLocaleDateString(language)');
    expect(transfers).toContain('.toLocaleString(language)');
    expect(transfers).toContain('.toLocaleDateString(language)');
    expect(ranch).toContain('.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })');
    expect(ranch).toContain('`${uiText("Serão transferidos ")}${confirmAction.transferencia.quantidade}');
    expect(production).toContain('now.toISOString().slice(0, 10)');
    expect(transfers).toContain('now.toISOString().slice(0, 10)');
  });
});
