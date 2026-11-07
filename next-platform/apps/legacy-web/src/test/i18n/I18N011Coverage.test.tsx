import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import { translateStaticUiText } from "@/components/i18n/LocalizedText";
import { translatePdfLabel } from "@/lib/pdfUiLabels";

const pages = [
  "SyncVetMedicamentosPage", "SyncVetSemenPage", "SyncVetProtocolosPage",
  "SyncVetProtocoloDetalhePage", "SyncVetPartosPage", "SyncVetPrecosPage",
  "SyncVetPreferenciasPage", "SyncVetTrajetosPage", "PainelInteligenciaPage",
  "VisitaTecnicaPage",
];
const src = (file: string) => readFileSync(resolve(process.cwd(), "src", file), "utf8");

describe("I18N-011 — P0 coverage guards", () => {
  it("connects each of the ten P0 screens to the current App locale", () => {
    for (const page of pages) {
      const file = src(`pages/${page}.tsx`);
      expect(file, page).toContain("useStaticUiText()");
      expect(file, page).toContain("LocalizedText");
    }
  });

  it("keeps literal translated JSX copy in the reviewed catalog", () => {
    for (const page of pages) {
      const file = src(`pages/${page}.tsx`);
      const source = ts.createSourceFile(page, file, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      let checked = 0;
      const visit = (node: ts.Node) => {
        if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "LocalizedText") {
          const attr = node.attributes.properties.find(x => ts.isJsxAttribute(x) && x.name.getText(source) === "source");
          expect(attr && ts.isJsxAttribute(attr) && attr.initializer && ts.isJsxExpression(attr.initializer)).toBeTruthy();
          if (attr && ts.isJsxAttribute(attr) && attr.initializer && ts.isJsxExpression(attr.initializer)) {
            const val = attr.initializer.expression;
            if (val && ts.isStringLiteral(val)) {
              if (val.text !== "Total:") expect(translateStaticUiText("en-US", val.text), `${page}: ${val.text}`).not.toBe(val.text);
              checked++;
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      expect(checked, page).toBeGreaterThan(0);
    }
  });

  it("translates domain copy without changing unknown user-entered values", () => {
    const cases = [
      ["Medicamentos", "Medications"], ["Sêmen", "Semen"],
      ["Calendário de Partos", "Calving Calendar"],
      ["Montador de protocolos reprodutivos", "Reproductive protocol builder"],
      ["Meus Trajetos", "My Trips"], ["Tabela de Preços", "Price List"],
      ["Painel de Inteligência Nutricional", "Nutritional Intelligence Dashboard"],
      ["Visita não encontrada", "Visit not found"],
    ];
    for (const [pt, en] of cases) expect(translateStaticUiText("en-US", pt)).toBe(en);
    expect(translateStaticUiText("en-US", "Fazenda Aurora - animal B17")).toBe("Fazenda Aurora - animal B17");
    expect(translateStaticUiText("pt-BR", "Meus Trajetos")).toBe("Meus Trajetos");
  });

  it("passes locale through PDF generators and preserves traditional Portuguese fallback", () => {
    expect(translatePdfLabel("en-US", "QR Codes para impressão")).toBe("Printable QR Codes");
    expect(translatePdfLabel("en-US", "RESUMO GERAL")).toBe("OVERVIEW");
    expect(translatePdfLabel("pt-BR", "RESUMO GERAL")).toBe("RESUMO GERAL");
    expect(src("pages/PainelInteligenciaPage.tsx")).toContain("<PainelInteligenciaPDF data={pdfData} language={language} />");
    expect(src("pages/EscritorioLayout.tsx")).toContain("<QrCodePrintPDF items={items} language={language} />");
    expect(src("components/relatorio/RelatorioPDF.tsx")).toContain('<PdfCopy text="pasto(s)" />');
  });
});
