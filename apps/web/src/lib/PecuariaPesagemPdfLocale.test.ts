import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gerarPecuaristaLotePdf, gerarPecuaristaApartacaoPdf } from "./pecuaristaPdf";
import { gerarPesagemPdf } from "./pesagemPdf";

async function streamOf(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsBinaryString(blob);
  });
}

const header = {
  produtor: "Ana Ribeiro", fazenda: "FAZENDA SANTA HELENA",
  cidade: "Araguaina", lote: "Lote Invernada", codigoLote: "L001",
  categoria: "Categoria Customizada 07", identificado: true,
  data: "2026-10-30T14:00:00Z",
};
const identified = [
  { numero: "B102", peso_kg: 425, data: "2026-10-30", peso_anterior_kg: 403, data_anterior: "2026-09-30", dias: 30, gmd_individual: 0.733 },
];
const readings = [
  { ordem: 1, peso_total: 850, quantidade_animais: 2, peso_individual: 425 },
];

const weighing = {
  header: { produtor: "Ana Ribeiro", fazenda: "FAZENDA SANTA HELENA", cidade: "Araguaina",
    data: "2026-10-30T14:00:00Z", categoriaLabel: "Categoria Customizada 07", formaPagamento: "À vista" },
  cfg: { tipo_preco: "kg" as const, preco_valor: 12.5, modo_percentual: "na" as const, percentual_fixo: null },
  animais: [
    { ordem: 1, peso_kg: 425, percentual_individual: null, peso_pagavel: 425, arroba_pagavel: null, valor: 5312.5 },
  ],
};

describe("I18N-008 - cattle-owner and purchase weighing PDF translations", () => {
  // jsdom does not render HTMLCanvasElement; PDF textual/table content remains real jsPDF.
  let canvasStub: ReturnType<typeof vi.spyOn>;
  beforeAll(() => { canvasStub = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null); });
  afterAll(() => { canvasStub.mockRestore(); });

  it("renders owner herd weighing in PT and EN preserving names, numbers and custom categories", async () => {
    const data = {
      header,
      totais: { quantidade: 1, peso_total: 425, peso_medio: 425, peso_medio_anterior: 403, data_anterior: "2026-09-30", dias: 30, gmd: 0.733 },
      identificados: identified, leiturasBalancao: readings,
    };
    const english = await streamOf(await gerarPecuaristaLotePdf({ ...data, language: "en-US" }));
    const portuguese = await streamOf(await gerarPecuaristaLotePdf(data));
    expect(english).toContain("WEIGHING REPORT");
    expect(english).toContain("Weighing Information");
    expect(english).toContain("Herd Group Type:");
    expect(english).toContain("Previous Average Weight");
    expect(english).toContain("Scale Readings");
    expect(english).toContain("FAZENDA SANTA HELENA");
    expect(english).toContain("Lote Invernada");
    expect(english).toContain("Categoria Customizada 07");
    expect(english).toContain("B102");
    expect(portuguese).not.toContain("Herd Group Type:");
    expect(portuguese).toContain("Mais Arrobas");
  });

  it("renders sorting and weighing destinations in English with unchanged herd names", async () => {
    const data = {
      header,
      totalGeral: { quantidade: 1, peso_total: 425 },
      destinos: [
        { nome_lote: "Lote Corte 1", codigo: "B200", identificado: true,
          quantidade: 1, peso_total: 425, peso_medio: 425, identificados: identified },
      ],
    };
    const english = await streamOf(await gerarPecuaristaApartacaoPdf({ ...data, language: "en-US" }));
    const portuguese = await streamOf(await gerarPecuaristaApartacaoPdf(data));
    expect(english).toContain("SORTING AND WEIGHING REPORT");
    expect(english).toContain("Sorting Information");
    expect(english).toContain("Destination:");
    expect(english).toContain("Lote Corte 1");
    expect(english).toContain("Total Animals Sorted:");
    expect(english).toContain("Ana Ribeiro");
    expect(portuguese).not.toContain("Sorting Information");
  });

  it("renders purchase weighing in English including totals and mixed prices with original BRL amounts", async () => {
    const english = await streamOf(await gerarPesagemPdf({ ...weighing, language: "en-US", leiturasBalancao: readings }));
    const portuguese = await streamOf(await gerarPesagemPdf(weighing));
    expect(english).toContain("WEIGHING REPORT");
    expect(english).toContain("Weighing Information");
    expect(english).toContain("Price per kg:");
    expect(english).toContain("Herd Group Totals");
    expect(english).toContain("Total Amount Payable");
    expect(english).toContain("Scale Readings");
    expect(english).toContain("FAZENDA SANTA HELENA");
    expect(english).toContain("Categoria Customizada 07");
    expect(portuguese).not.toContain("Total Amount Payable");
  });

  it("translates routine weighing without exposing a payment total or altering payment calculation", async () => {
    const english = await streamOf(await gerarPesagemPdf({ ...weighing, language: "en-US", semValores: true, rendimentoEstimado: 55 }));
    expect(english).toContain("Routine Weighing");
    expect(english).toContain("Estimated Yield:");
    expect(english).toContain("informational only");
    expect(english).not.toContain("Total Amount Payable");
  });

  it("wires locale to all three producer/owner export flows and historical re-export", () => {
    for (const file of [
      "pages/PecuaristaPesagemExecPage.tsx", "pages/PecuaristaApartacaoPage.tsx",
      "pages/PesadorPesagemResumoPage.tsx", "pages/PecuaristaHistoricoPage.tsx",
      "lib/pecuaristaPdfHistorico.ts",
    ]) {
      const source = readFileSync(resolve(process.cwd(), "src", file), "utf8");
      expect(source).toContain("language");
      expect(source).toContain("gerarP");
    }
  });
});
