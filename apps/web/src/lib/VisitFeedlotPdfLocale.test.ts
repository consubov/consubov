import { describe, expect, it, vi } from "vitest";
import { generateVisitaPdf, generateFabricaPdf } from "./visitaPdf";
import { generateConfinamentoPdf } from "./confinamentoPdf";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The PDF renderer is real jsPDF; only external asset/storage operations are mocked.
vi.mock("@/lib/consultorOffline/network", () => ({
  fetchWithConsultorTimeout: vi.fn(async () => { throw new Error("offline fixture"); }),
  withConsultorTimeout: vi.fn(async <T,>(p: Promise<T>) => p),
}));
vi.mock("@/lib/pdfImagePrep", () => ({ prefetchFotosDataUrls: vi.fn(async () => ({})) }));

async function pdfString(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsBinaryString(blob);
  });
}
const base = {
  visitaId: "visita-i18n009",
  fazenda: { nome_fazenda: "Fazenda Aurora", proprietario: "Maria Lima", responsavel: "Pedro Rocha", municipio: "Araguaina", uf: "TO" },
  consultor: { nome: "Joao Vieira" },
  hora_inicio: "2026-10-20T12:00:00Z", hora_fim: "2026-10-20T17:00:00Z",
  observacoes_gerais: "Anotacao original do tecnico", conclusao: "Siga o plano original de manejo.",
};
const pasto = {
  id: "p1", letra: "A", num_pasto: "13", qtd_animais: 30, tipo_produto: "mineral", percentual_pv: "0.10",
  consumo_kg_dia: 30, categoria: "Categoria Livre 17", peso_medio_kg: 420, observacao: "Nome proprio e nota do consultor",
  scores: { fezes: 3, corporal: 4, bebedouro: 5 }, fotos: [],
};

describe("I18N-009 - technical visit, conference, feed mill, feedlot PDFs", () => {
  it("translates technical visit headings, score legends and charts, preserving names and data", async () => {
    const data = { ...base, pastos: [pasto], objetivo_visita: "Revisar o rebanho", indicadores_tabela: [{ key: "custom", label: "Dado proprietário", value: "Teste 100" }],
      topicos: [], sampleChartTypes: { fezes: "lines" as const } };
    const en = await generateVisitaPdf({ ...data, language: "en-US", pastos: [{ ...pasto, samples: { fezes: [3, 4], corporal: [], bebedouro: [] } }] });
    const pt = await generateVisitaPdf(data);
    const english = await pdfString(en.blob);
    const portuguese = await pdfString(pt.blob);
    expect(english).toContain("TECHNICAL REPORT");
    expect(english).toContain("Technical Visit - Routine");
    expect(english).toContain("Owner: Maria Lima");
    expect(english).toContain("Pasture 13");
    expect(english).toContain("EXPECTED CONSUMPTION");
    expect(english).toContain("Fecal Score");
    expect(english).toContain("Fecal Score");
    expect(english).toContain("Fazenda Aurora");
    expect(english).toContain("Categoria Livre 17");
    expect(english).toContain("Nome proprio e nota do consultor");
    expect(english).toContain("Dado propriet");
    expect(portuguese).toContain("Relat");
    expect(portuguese).not.toContain("Technical Visit - Routine");
    expect(en.fileName).toMatch(/^visita-fazenda-aurora-/);
    expect(pt.fileName).toMatch(/^visita-fazenda-aurora-/);
  });

  it("translates conference-specific pasture and manager labels without changing stored farm names", async () => {
    const r = await generateVisitaPdf({ ...base, language: "en-US", modo: "conferencia", pastos: [{ ...pasto,
      fazenda_nome: "Fazenda Aurora", retiro_nome: "Retiro Girassol", sexo: "MISTO", ultima_salga_sacos: 6,
      ultima_salga: "2026-10-15T12:00:00Z", consumo_medio_g: 320 }],
      fazenda: { ...base.fazenda, gerente: "Gerente Inacio" },
    });
    const text = await pdfString(r.blob);
    expect(text).toContain("Routine Visit");
    expect(text).toContain("Manager: Gerente Inacio");
    expect(text).toContain("Ranch Unit Retiro Girassol");
    expect(text).toContain("LAST SALT SUPPLEMENTATION");
    expect(text).toContain("6 bags");
    expect(text).toContain("Fazenda Aurora");
  });

  it("renders feed mill assessment in English with original grades and evaluated item names", async () => {
    const r = await generateFabricaPdf({
      visitaId: base.visitaId, fazenda: base.fazenda, consultor: base.consultor,
      hora_inicio: base.hora_inicio, hora_fim: base.hora_fim, language: "en-US",
      quesitos: [{ chave: "organizacao_geral", rotulo: "Organização geral da fábrica", nota: 4 },
        { chave: "armazenamento_insumos", rotulo: "Armazenamento dos insumos", nota: 3 }],
      topicos: [],
    });
    const english = await pdfString(r.blob);
    expect(english).toContain("Technical Visit - Feed Mill");
    expect(english).toContain("FEED MILL ASSESSMENT");
    expect(english).toContain("Overall Feed Mill Organization");
    expect(english).toContain("Raw Material Storage");
    expect(english).toContain("Overall average:");
    expect(english).toContain("Fazenda Aurora");
    expect(r.fileName).toMatch(/^fabrica-fazenda-aurora-/);
  });

  it("renders feedlot, Penn State and production indicators in English while preserving raw notes", async () => {
    const data = { ...base, language: "en-US" as const,
      currais: [{ id: "c1", num_curral: "CURRAL D12", scores: { fezes: 3, corporal: 4, bebedouro: 5 },
        samples: { fezes: [2, 3], corporal: [], bebedouro: [] }, fotos: [] }],
      avaliacaoFabrica: { organizacao_fabrica_nota: 4, organizacao_insumos_nota: 4 },
      pennState: [{ id: "ps1", nome: "Ponto Fazenda 1", ordem: 1,
        percentual_19mm: 10, percentual_8mm: 40, percentual_4mm: 30, percentual_fundo: 20,
        fef: 45, peNDF: 29, aviso_divergencia: "Alerta original do fabricante", fotos: [] },
        { id: "ps2", nome: "Ponto Fazenda 2", ordem: 2, percentual_19mm: 12, percentual_8mm: 38,
          percentual_4mm: 30, percentual_fundo: 20, fef: 46, peNDF: null, aviso_divergencia: null, fotos: [] }],
      indicadoresZootecnicos: { indicador: { currais_ocupados: 5, animais_ativos: 500 },
        faixas: [{ faixa: "1-20", ordem: 1, quantidade_animais: 100, consumo_medio_pv: 2.3 }] },
    };
    const english = await pdfString((await generateConfinamentoPdf(data)).blob);
    const portuguese = await pdfString((await generateConfinamentoPdf({ ...data, language: "pt-BR" })).blob);
    expect(english).toContain("Technical Visit - Feedlot");
    expect(english).toContain("Pen CURRAL D12");
    expect(english).toContain("PENN STATE ANALYSIS");
    expect(english).toContain("19 mm Sieve");
    expect(english).toContain("Physically Effective Neutral Detergent Fiber");
    expect(english).toContain("PRODUCTION INDICATORS");
    expect(english).toContain("Occupied Pens");
    expect(english).toContain("Average Fecal Score by Pen");
    expect(english).toContain("Ponto Fazenda 1");
    expect(english).toContain("Alerta original do fabricante");
    expect(portuguese).not.toContain("Technical Visit - Feedlot");
  });

  it("threads selected language through all four React export entry points", () => {
    for (const file of ["pages/RevisaoVisitaPage.tsx", "pages/ConferenciaPage.tsx",
      "components/consultor/FabricaVisitaView.tsx", "components/consultor/ConfinamentoRevisaoView.tsx"]) {
      const source = readFileSync(resolve(process.cwd(), "src", file), "utf8");
      expect(source).toContain("useTranslation()");
      expect(source).toContain("language,");
    }
  });
});
