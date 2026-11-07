import { describe, expect, it, vi } from "vitest";
import { gerarDespesasPdf } from "./despesasPdf";
import { gerarManejoPDF } from "./syncvetManejoPdf";
import { gerarServicoPDF } from "./syncvetServicoPdf";
import { translatePdfLabel } from "./pdfUiLabels";

vi.mock("./reportPdfExport", async (importOriginal) => {
  const original = await importOriginal<typeof import("./reportPdfExport")>();
  return { ...original, fetchPdfBinaryWithTimeout: vi.fn(async () => { throw new Error("offline PDF fixture"); }) };
});

/** Inspect the real jsPDF document stream, not a mocked text renderer. */
async function pdfBytes(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsBinaryString(blob);
  });
}

const dataDespesas = {
  consultor_nome: "Ana Silva", data_inicio: "2026-10-01", data_fim: "2026-10-31",
  tipo_periodo: "mensal", valor_total: 136.2, despesas: [
    { data_despesa: "2026-10-20", valor: 136.2, foto_cupom_url: "fixture:no-network" },
  ],
} as const;
const dataManejo = {
  tipo: "dg_us" as const, data: "2026-10-20", empresa: "Fazenda Santa Helena",
  fazenda: "Fazenda Santa Helena", lote: "Lote A1", responsavel: "Ana Silva",
  protocolo: "Protocolo PR-100", semen: "Sêmen XYZ-25", observacoes: "Observação original do técnico",
  animais: [{ numero: "2345", categoria: "Recria 1", diagnostico: "prenha" as const }],
};
const dataServico = {
  numero: "SVC001", data_referencia: "2026-10-20", data_vencimento: "2026-10-27",
  empresa: { nome: "Veterinária ABC" }, veterinario: { nome: "Ana Silva" },
  fazenda: { nome: "Fazenda Santa Helena", proprietario: "João" },
  modelo_cobranca: "protocolo_completo", periodo: { inicio: "2026-10-01", fim: "2026-10-20" },
  estacao: "Safra 2026", itens: [{ descricao: "Vacina A1", tipo_item: "procedimento", quantidade: 2, valor_unitario: 36, valor_total: 72 }],
  valor_total: 72, km_total: 30, animais_atendidos: 2, observacoes: "Nota do veterinário",
};

describe("I18N-006 — specialized PDF labels and report content", () => {
  it("uses reviewed bilingual labels, falling back to original data and technical identifiers", () => {
    expect(translatePdfLabel("en-US", "TAXA DE PRENHEZ")).toBe("PREGNANCY RATE");
    expect(translatePdfLabel("en-US", "Cliente / Fazenda")).toBe("Client / Ranch");
    expect(translatePdfLabel("en-US", "Fazenda Santa Helena")).toBe("Fazenda Santa Helena");
    expect(translatePdfLabel("pt-BR", "Vencimento:")).toBe("Vencimento:");
  });

  it("renders expenses PDFs in both locales without modifying the consultant's name, dates, or amounts", async () => {
    const english = await pdfBytes(await gerarDespesasPdf({ ...dataDespesas, language: "en-US", despesas: [...dataDespesas.despesas] }));
    const portuguese = await pdfBytes(await gerarDespesasPdf({ ...dataDespesas, despesas: [...dataDespesas.despesas] }));
    expect(english).toContain("Expense Report");
    expect(english).toContain("Fuel Expenses");
    expect(english).toContain("Total receipts:");
    expect(english).toContain("Ana Silva");
    expect(english).toContain("10/20/2026");
    expect(portuguese).toContain("20/10/2026");
    expect(english).not.toContain("Despesas de Combust");
    expect(portuguese).toContain("Total de cupons:");
    expect(portuguese).toContain("Ana Silva");
  });

  it("renders livestock procedure labels in English and keeps the herd, diagnosis inputs and annotations intact", async () => {
    const english = await pdfBytes(await gerarManejoPDF({ ...dataManejo, language: "en-US" }));
    const portuguese = await pdfBytes(await gerarManejoPDF(dataManejo));
    expect(english).toContain("Livestock Procedure Report");
    expect(english).toContain("PREGNANCY RATE");
    expect(english).toContain("Pregnant");
    expect(english).toContain("Ana Silva");
    expect(english).toContain("Lote A1");
    expect(english).toContain("Protocolo PR-100");
    expect(portuguese).toContain("Respons");
    expect(portuguese).not.toContain("PREGNANCY RATE");
  });

  it("renders service PDF billing labels in English while retaining business names, raw descriptions and amounts", async () => {
    const english = await pdfBytes(await gerarServicoPDF({ ...dataServico, language: "en-US" }));
    const portuguese = await pdfBytes(await gerarServicoPDF(dataServico));
    expect(english).toContain("Service Report");
    expect(english).toContain("Billing Model:");
    expect(english).toContain("Full Protocol");
    expect(english).toContain("Vacina A1");
    expect(english).toContain("Ana Silva");
    expect(english).toContain("SVC001");
    expect(english).toContain("10/20/2026");
    expect(portuguese).toContain("20/10/2026");
    expect(portuguese).toContain("Modelo de cobran");
    expect(portuguese).not.toContain("Billing Model:");
  });
});
