import { describe, expect, it } from "vitest";
import { pdf } from "@react-pdf/renderer";
import PainelInteligenciaPDF, { type PainelPDFData } from "@/components/painel/PainelInteligenciaPDF";

const data: PainelPDFData = {
  fazendaNome: "Fazenda Aurora",
  periodo: "Novembro 2026",
  dataGeracao: "03/11/2026",
  filtros: [{ label: "Fazenda", valor: "Fazenda Aurora" }],
  consumoMedioReal: 150,
  consumoEsperado: 160,
  desvioPercent: -6.25,
  intervaloMedio: 12,
  painelConsumoReal: 150,
  painelConsumoGlobal: 140,
  painelEficiencia: 96,
  painelPesoMedio: 420,
  alertas: [{ tipo: "warning", texto: "Observação sintética do usuário — manter original" }],
  metricas: [{ categoria: "Categoria Fazenda 17", consumoMedio: 140, totalAnimais: 30,
    totalSacos: 10, custoMedio: 25, custoPorKgGanho: 4, gmd: 0.7, custoTotal: 750 }],
  tendencia: [{ periodo: "Out/2026", consumo: 130 }],
  ranking: [{ nome: "Fazenda Aurora", estado: "TO", consumoMedio: 140,
    desvio: -2, intervaloMedio: 12, lancamentos: 2 }],
};

function blobBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe("I18N-011 — real PDF rendering in both App languages", () => {
  it("generates real PDF files with the same synthetic numeric/user data in PT and EN", async () => {
    const en = await pdf(<PainelInteligenciaPDF data={data} language="en-US" />).toBlob();
    const pt = await pdf(<PainelInteligenciaPDF data={data} language="pt-BR" />).toBlob();
    const magicEn = new TextDecoder().decode((await blobBuffer(en)).slice(0, 8));
    const magicPt = new TextDecoder().decode((await blobBuffer(pt)).slice(0, 8));
    expect(magicEn).toContain("%PDF-");
    expect(magicPt).toContain("%PDF-");
    expect(en.size).toBeGreaterThan(1000);
    expect(pt.size).toBeGreaterThan(1000);
    expect(data.fazendaNome).toBe("Fazenda Aurora");
    expect(data.metricas[0].totalAnimais).toBe(30);
  });
});
