import { describe, expect, it } from "vitest";
import { gerarPdfSalga, localizeSalgaPeriod } from "@/utils/gerarPdfSalga";
import { gerarPdfPesagem } from "@/utils/gerarPdfPesagem";

async function pdfContent(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsBinaryString(blob);
  });
}

const saltData = {
  fazendaNome: "RANCHO DO VALE", retiroNome: "Retiro Primavera", periodoLabel: "Outubro 2026",
  responsavel: "Ana Silva", pastos: [
    { nome: "Pasto 100", numAnimais: 30, pesoMedioKg: 456.5, sacosUtilizados: 4, cochoCheio: 2, status: "ABAIXO" },
    { nome: "Pasto Azul", numAnimais: 12, pesoMedioKg: 350, sacosUtilizados: 7, status: "ACIMA" },
  ],
};
const weightData = {
  pesagemId: "weigh_001", fazendaNome: "FAZENDA SANTA HELENA", retiroNome: "RETIRO A",
  pastoNome: "Pasto Azul", dataPesagem: "2026-10-15T12:00:00.000Z",
  horaFinalizacao: "14:35", responsavelNome: "Ana Silva",
  animais: [{ id: "animal-1", numero: 101, pesoKg: 420.1 }, { id: "animal-2", numero: 102, pesoKg: 450.3 }],
};

describe("I18N-007 - PDF field reports", () => {
  it("translates only known author-controlled period labels", () => {
    expect(localizeSalgaPeriod("en-US", "Outubro 2026")).toBe("October 2026");
    expect(localizeSalgaPeriod("en-US", "Ultimos 7 dias")).toBe("Ultimos 7 dias");
    expect(localizeSalgaPeriod("en-US", "Últimos 7 dias")).toBe("Last 7 days");
    expect(localizeSalgaPeriod("en-US", "Última salga: 15/10/2026")).toBe("Last salt supplementation: 15/10/2026");
    expect(localizeSalgaPeriod("en-US", "SYNC_01-10-2026_30-10-2026")).toBe("SYNC_01-10-2026_30-10-2026");
    expect(localizeSalgaPeriod("pt-BR", "Outubro 2026")).toBe("Outubro 2026");
  });

  it("renders real salt PDFs in PT and EN with the same storage filename and original ranch data", async () => {
    const pt = gerarPdfSalga(saltData);
    const en = gerarPdfSalga({ ...saltData, language: "en-US" });
    expect(en.fileName).toBe(pt.fileName);
    const english = await pdfContent(en.blob);
    const portuguese = await pdfContent(pt.blob);
    expect(english).toContain("Ranch Unit:");
    expect(english).toContain("Period: October 2026");
    expect(english).toContain("No. of Animals");
    expect(english).toContain("BELOW TARGET");
    expect(english).toContain("ABOVE TARGET");
    expect(english).toContain("full-trough entries");
    expect(english).toContain("Ana Silva");
    expect(english).toContain("Pasto Azul");
    expect(portuguese).toContain("Retiro:");
    expect(portuguese).not.toContain("BELOW TARGET");
  });

  it("renders weighing PDFs in PT and EN without altering numbers and filenames", async () => {
    const pt = gerarPdfPesagem(weightData);
    const en = gerarPdfPesagem({ ...weightData, language: "en-US" });
    expect(en.fileName).toBe(pt.fileName);
    const english = await pdfContent(en.blob);
    const portuguese = await pdfContent(pt.blob);
    expect(english).toContain("Ranch Unit:");
    expect(english).toContain("Number of Animals");
    expect(english).toContain("Animal No.");
    expect(english).toContain("Weight \\(kg\\)");
    expect(english).toContain("Pasto Azul");
    expect(english).toContain("101");
    expect(english).toContain("Ana Silva");
    expect(portuguese).not.toContain("Number of Animals");
  });
});
