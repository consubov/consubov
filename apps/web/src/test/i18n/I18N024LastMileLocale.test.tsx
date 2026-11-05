import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import translations from "@/lib/staticUiEnglish.json";
import { translateStaticUiText } from "@/components/i18n/LocalizedText";

const readSource = (file: string) => readFileSync(resolve(process.cwd(), "src", file), "utf8");

describe("I18N-024 — last-mile field, locale, PDF and recovery labels", () => {
  it("maps identified missing operator-controlled messages into English", () => {
    const pairs = [
      ["Animal cadastrado", "Animal registered"],
      ["Remover animal ", "Remove animal "],
      ["Escolha uma data de hoje ou anterior.", "Choose today or an earlier date."],
      [
        'Os dados de cada capataz são reportados automaticamente após cada tentativa de sincronização. Use "Importar JSON de emergência" se um capataz enviar manualmente o backup exportado pelo PWA.',
        'Each ranch supervisor’s data is reported automatically after each sync attempt. Use "Import emergency JSON" if a ranch supervisor manually sends the backup exported by the PWA.',
      ],
    ] as const;
    for (const [pt, en] of pairs) {
      expect(translateStaticUiText("en-US", pt), pt).toBe(en);
      expect(translateStaticUiText("pt-BR", pt), pt).toBe(pt);
    }
  });

  it("localizes SyncVet animal feedback and leaves animal fields unchanged", () => {
    const page = readSource("pages/SyncVetLoteDetalhePage.tsx");
    expect(page).toContain('toast.success(uiText("Animal cadastrado"))');
    expect(page).toContain('uiText("Remover animal ")');
    expect(page).toContain("brinco: brinco || null");
    expect(page).toContain("numero: numero || null");
    expect(page).toContain('supabase.from("syncvet_animais").delete()');
  });

  it("localizes initial weighing labels and blocks future dates as before", () => {
    const lot = readSource("pages/PecuaristaLoteDetalhePage.tsx");
    const ranch = readSource("pages/PecuaristaFazendaDetalhePage.tsx");
    expect(lot).toContain('toast.error(uiText("Escolha uma data de hoje ou anterior."))');
    expect(lot).toContain("dataEscolhida > hojeSP");
    expect(ranch).toContain('uiText("Animal")');
    expect(ranch).toContain("a.numero");
    expect(ranch).toContain("a.peso");
  });

  it("shows dates and BRL figures using language while preserving currency code", () => {
    for (const file of [
      "pages/PecuaristaBuscarAnimalPage.tsx",
      "pages/PecuaristaHistoricoPage.tsx",
      "pages/PesadorPesagemResumoPage.tsx",
      "pages/SyncVetPrecosPage.tsx",
      "pages/ConsultorPainelPage.tsx",
      "pages/PesadorDashboard.tsx",
    ]) {
      const code = readSource(file);
      expect(code, file).toContain('const { language } = useTranslation();');
    }
    expect(readSource("pages/PecuaristaBuscarAnimalPage.tsx")).toContain("new Date(h.data).toLocaleString(language)");
    expect(readSource("pages/PecuaristaHistoricoPage.tsx")).toContain("new Date(iso).toLocaleDateString(language)");
    expect(readSource("pages/PesadorPesagemResumoPage.tsx")).toContain("new Date(finalizadaAt).toLocaleDateString(language)");
    expect(readSource("pages/SyncVetPrecosPage.tsx")).toContain('toLocaleString(language, { style: "currency", currency: "BRL" })');
  });

  it("formats PDF graph numeric values for their selected language", () => {
    const charts = readSource("lib/pdfLineCharts.ts");
    expect(charts).toContain("const fmt1 = (v: number, language: SiteLanguage");
    expect(charts).toContain("fmt1(rows[i].media, language)");
    expect(charts).toContain("fmt1(minY + ((maxY - minY) * i) / TICKS, language)");
    expect(charts).toContain('Number(v).toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })');
    expect(charts).not.toContain('Number(v).toLocaleString("pt-BR",');
  });

  it("has an English mapping for all literal localized JSX and uiText keys", () => {
    const locations = [
      "pages/RecuperarDadosPage.tsx",
      "pages/SyncVetLoteDetalhePage.tsx",
      "pages/PecuaristaFazendaDetalhePage.tsx",
      "pages/PecuaristaLoteDetalhePage.tsx",
    ];
    for (const file of locations) {
      const src = readSource(file);
      const ast = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const check = (text: string) => expect(Object.prototype.hasOwnProperty.call(translations, text), file + ": " + text).toBe(true);
      const visit = (node: ts.Node): void => {
        if (ts.isJsxAttribute(node) && node.name.getText(ast) === "source" && node.initializer
          && ts.isJsxExpression(node.initializer) && node.initializer.expression
          && ts.isStringLiteral(node.initializer.expression)) check(node.initializer.expression.text);
        if (ts.isCallExpression(node) && node.expression.getText(ast) === "uiText" && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
          check((node.arguments[0] as ts.StringLiteral).text);
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
  });
});
