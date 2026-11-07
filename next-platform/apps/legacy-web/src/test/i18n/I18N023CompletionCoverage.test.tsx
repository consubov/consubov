import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import english from "@/lib/staticUiEnglish.json";
import { translateStaticUiText } from "@/components/i18n/LocalizedText";

const root = resolve(process.cwd(), "src");
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === "test") return [];
    const full = join(dir, entry.name);
    return entry.isDirectory() ? sources(full) : full.endsWith(".tsx") ? [full] : [];
  });
}
const readSource = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("I18N-023 — completeness guard for author-controlled text", () => {
  it("every literal LocalizedText/uiText key has an English mapping", () => {
    const misses: string[] = [];
    let references = 0;
    const patterns = [
      /<LocalizedText\s+source=\{["']([^"'\n]+)["']\}/g,
      /\buiText\(["']([^"'\n]+)["']\)/g,
    ];
    for (const file of sources(root)) {
      const text = readFileSync(file, "utf8");
      for (const pattern of patterns) {
        for (const match of text.matchAll(pattern)) {
          references++;
          if (!Object.prototype.hasOwnProperty.call(english, match[1])) {
            misses.push(file.replace(root, "") + ": " + match[1]);
          }
        }
      }
    }
    expect(references).toBeGreaterThan(2500);
    expect(misses).toEqual([]);
  });

  it("translates newly localized accessibility, navigation and operational labels", () => {
    const pairs = [
      ["Ops! Página não encontrada", "Oops! Page not found"],
      ["Voltar para o início", "Return to home"],
      ["Atualizar aplicativo", "Update app"],
      ["Remover logo", "Remove logo"],
      ["Mapa indisponível. Recarregue quando tiver conexão.", "Map unavailable. Reload when connected."],
      ["Carregando mapa", "Loading map"],
      ["Descartar foto", "Discard photo"],
      ["Foto da pesagem", "Weighing photo"],
      ["Ano da curva de consumo", "Consumption curve year"],
      ["Fundo (Bandeja)", "Bottom tray"],
      ["Para baixo", "Down"],
      ["Remover foto", "Remove photo"],
      ["opcional", "optional"],
      ["Ex: 320,00", "E.g.: 320.00"],
    ] as const;
    for (const [pt, en] of pairs) {
      expect(translateStaticUiText("en-US", pt), pt).toBe(en);
      expect(translateStaticUiText("pt-BR", pt), pt).toBe(pt);
    }
    expect(translateStaticUiText("en-US", "Retiro Boa Vista")).toBe("Retiro Boa Vista");
  });

  it("keeps pasture category values and animal data unchanged", () => {
    const pasture = readSource("components/pastos/CategoriaPastoSelect.tsx");
    expect(pasture).toContain("value={c}");
    expect(pasture).toContain("onValueChange={onChange}");
    expect(pasture).toContain("uiText(c)");
    const weighing = readSource("pages/PesadorPesagemNovoPage.tsx");
    expect(weighing).toContain('value: "boi_gordo"');
    expect(weighing).toContain('parseFloat(s.replace(",", "."))');
    expect(weighing).toContain('placeholder={uiText("Ex: 320,00")}');
  });

  it("formats display values in PDFs using the selected language while retaining BRL", () => {
    for (const file of ["lib/despesasPdf.ts", "lib/syncvetServicoPdf.ts"]) {
      const code = readSource(file);
      expect(code).toContain('language === "en-US"');
      expect(code).toContain('toLocaleString(language, { style: "currency", currency: "BRL" })');
    }
    for (const file of ["lib/visitaPdf.ts", "lib/confinamentoPdf.ts"]) {
      const code = readSource(file);
      expect(code).toContain('language === "en-US" ? "MM/dd/yyyy');
    }
    for (const file of ["lib/pecuaristaPdf.ts", "lib/pesagemPdf.ts"]) {
      expect(readSource(file)).toContain('toLocaleDateString(language)');
      expect(readSource(file)).toContain('toLocaleString(language');
    }
  });
});
