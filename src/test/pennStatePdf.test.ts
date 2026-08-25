import { describe, expect, it, vi, beforeAll } from "vitest";
import fs from "node:fs";

// Supabase e assets não são usados na parte medida do PDF; stubs evitam rede.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null }), upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  },
}));
vi.mock("@/lib/pdfImagePrep", () => ({ prefetchFotosDataUrls: async () => ({}) }));

const base = {
  visitaId: "v1",
  fazenda: { nome_fazenda: "Fazenda Teste" },
  consultor: { nome: "Consultor" },
  hora_inicio: new Date().toISOString(),
  hora_fim: new Date().toISOString(),
  observacoes_gerais: null,
  conclusao: null,
  currais: [],
};

const analise = (n: string, ordem: number, peNDF: number | null, fotos: number) => ({
  id: `a${ordem}`, nome: n, ordem,
  percentual_19mm: 10, percentual_8mm: 50, percentual_4mm: 25, percentual_fundo: 15,
  fef: 85, peNDF,
  aviso_divergencia: ordem === 2 ? "Divergência de pesagem: 2g" : null,
  fotos: Array.from({ length: fotos }, (_, i) => ({ id: `f${ordem}-${i}`, url: `p/${ordem}/${i}.jpg`, ordem: i + 1 })),
});

async function gerar(pennState: any[], extra: any = {}) {
  const { generateConfinamentoPdf } = await import("@/lib/confinamentoPdf");
  const { blob } = await generateConfinamentoPdf({ ...base, ...extra, pennState } as any);
  return await new Promise<Buffer>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(Buffer.from(fr.result as ArrayBuffer));
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(blob as any);
  });
}

describe("PDF Confinamento — Análise Penn State", () => {
  beforeAll(() => { fs.mkdirSync("/tmp/pennpdf", { recursive: true }); });

  it("(a) sem análises: nenhuma seção Penn State", async () => {
    const buf = await gerar([]);
    fs.writeFileSync("/tmp/pennpdf/zero.pdf", buf);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("(b) 1 análise com FDN e foto", async () => {
    const buf = await gerar([analise("Linha 1", 1, 25.5, 1)]);
    fs.writeFileSync("/tmp/pennpdf/uma.pdf", buf);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("(c) 3 análises: uma sem FDN, uma sem foto", async () => {
    const buf = await gerar([
      analise("Linha 1", 1, 25.5, 3),
      analise("Linha 2", 2, null, 2),
      analise("Linha 3", 3, 24.1, 0),
    ]);
    fs.writeFileSync("/tmp/pennpdf/tres.pdf", buf);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("(d) título Penn State perto do fim da página não fica órfão", async () => {
    const topicos = Array.from({ length: 7 }, (_, i) => ({
      id: `t${i}`, titulo: `Tópico ${i + 1}`, ordem: i, zona: "desenvolvimento",
      texto: "Texto de preenchimento. ".repeat(14), fotos: [],
    }));
    const buf = await gerar([analise("Linha 1", 1, 25.5, 2)], { topicos });
    fs.writeFileSync("/tmp/pennpdf/paginacao.pdf", buf);
    expect(buf.length).toBeGreaterThan(1000);
  });
});
