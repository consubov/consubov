import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/consubov-logo-preta.jpeg.asset.json";

const BUCKET_FOTOS = "visitas-consultor-fotos";
const BUCKET_RELATORIOS = "relatorios";

const GREEN_DARK = "#14432B";
const GOLD = "#C9A84C";
const INK = "#1C1C1A";
const INK_SOFT = "#767066";
const LINE = "#E7E3D6";

const PRODUTO_LABEL: Record<string, string> = {
  mineral: "Mineral",
  racao: "Ração",
  "proteinado_0.1": "Proteinado 0,1%",
  "proteinado_0.3": "Proteinado 0,3%",
  "proteinado_0.5": "Proteinado 0,5%",
  "proteinado_1": "Proteinado 1%",
  outro: "Outro",
};

export interface VisitaPdfPasto {
  id: string;
  letra: string;
  num_pasto: string | null;
  qtd_animais: number | null;
  tipo_produto: string | null;
  percentual_pv: string | null;
  consumo_kg_dia: number | null;
  observacao: string | null;
  scores: { fezes?: number; corporal?: number; bebedouro?: number };
  fotos: { id: string; url: string; ordem: number }[];
}

export interface VisitaPdfData {
  visitaId: string;
  fazenda: { nome_fazenda: string; proprietario?: string | null; municipio?: string | null; uf?: string | null };
  consultor: { nome: string };
  hora_inicio: string;
  hora_fim: string | null;
  observacoes_gerais: string | null;
  conclusao: string | null;
  objetivo_visita?: string | null;
  resumo_executivo?: string | null;
  indicadores_gerais?: string | null;
  pastos: VisitaPdfPasto[];
}

async function fetchFotoDataUrl(path: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrl(path, 60 * 60);
    if (!data?.signedUrl) return null;
    const res = await fetch(data.signedUrl);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function fetchAssetDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

function drawFooter(doc: jsPDF, page: number, totalPages: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.3);
  doc.line(15, h - 12, w - 15, h - 12);
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "normal");
  doc.text("Gerado por Consubov", 15, h - 6);
  doc.text(`Página ${page} de ${totalPages}`, w - 15, h - 6, { align: "right" });
}

function drawCoverHeader(doc: jsPDF, logoDataUrl: string | null, subtitle: string) {
  const w = doc.internal.pageSize.getWidth();
  // fundo branco (padrão), sem retângulo verde
  const headerH = 32;
  const logoH = 16;
  const logoW = 44; // proporção ~2.8:1 da logo consubov
  const logoX = 15;
  const logoY = 10;
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "JPEG", logoX, logoY, logoW, logoH); } catch { /* ignore */ }
  }
  // Linha vertical fina verde
  const dividerX = logoX + logoW + 6;
  doc.setDrawColor(GREEN_DARK);
  doc.setLineWidth(0.8);
  doc.line(dividerX, logoY, dividerX, logoY + logoH);

  // eyebrow + título
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("RELATÓRIO TÉCNICO", dividerX + 4, logoY + 6);
  doc.setTextColor(INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(subtitle, dividerX + 4, logoY + 14);

  // linha divisória abaixo do header
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.line(15, headerH + 4, w - 15, headerH + 4);
}

function drawFarmBlock(doc: jsPDF, data: VisitaPdfData, y: number): number {
  const w = doc.internal.pageSize.getWidth();
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(data.fazenda.nome_fazenda || "—", 15, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(INK_SOFT);
  const loc = [data.fazenda.proprietario, data.fazenda.municipio, data.fazenda.uf].filter(Boolean).join(" · ");
  if (loc) doc.text(loc, 15, y + 6);

  const boxY = y + 12;
  const boxW = (w - 30 - 10) / 3;
  const boxes = [
    { label: "CONSULTOR", value: data.consultor.nome || "—" },
    { label: "INÍCIO", value: format(new Date(data.hora_inicio), "dd/MM/yyyy HH:mm", { locale: ptBR }) },
    { label: "TÉRMINO", value: data.hora_fim ? format(new Date(data.hora_fim), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—" },
  ];
  boxes.forEach((b, i) => {
    const x = 15 + i * (boxW + 5);
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, boxY, boxW, 18, 2, 2, "S");
    doc.setFontSize(7);
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "bold");
    doc.text(b.label, x + 3, boxY + 6);
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.setFont("helvetica", "bold");
    doc.text(b.value, x + 3, boxY + 13);
  });
  return boxY + 24;
}

function drawIntroBlock(doc: jsPDF, title: string, text: string, y: number): number {
  const w = doc.internal.pageSize.getWidth() - 30;
  doc.setFillColor(GREEN_DARK);
  doc.rect(15, y, 2.5, 6, "F");
  doc.setTextColor(GREEN_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(title.toUpperCase(), 20, y + 4.5);
  doc.setTextColor(INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const lines = doc.splitTextToSize(text, w);
  doc.text(lines, 15, y + 11);
  return y + 11 + lines.length * 4.6 + 4;
}

async function drawPastoBlock(
  doc: jsPDF, pasto: VisitaPdfPasto, fotosCache: Record<string, string | null>,
  x: number, y: number, width: number, height: number,
) {
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, width, height, 2, 2, "S");

  doc.setFillColor(GREEN_DARK);
  doc.circle(x + 10, y + 10, 6, "F");
  doc.setTextColor(GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(pasto.letra || "?", x + 10, y + 12, { align: "center" });

  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Pasto ${pasto.num_pasto || "—"}`, x + 20, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.text(`${pasto.qtd_animais ?? "—"} animais`, x + 20, y + 13);

  doc.setDrawColor(LINE);
  doc.line(x + 3, y + 18, x + width - 3, y + 18);

  const lineY = y + 24;
  const cellW = (width - 6) / 3;
  const cells = [
    { label: "PRODUTO", value: pasto.tipo_produto ? (PRODUTO_LABEL[pasto.tipo_produto] || pasto.tipo_produto) : "—" },
    { label: "% PV", value: pasto.percentual_pv || "—" },
    { label: "CONSUMO", value: pasto.consumo_kg_dia ? `${pasto.consumo_kg_dia} kg/dia` : "—" },
  ];
  cells.forEach((c, i) => {
    const cx = x + 3 + i * cellW;
    doc.setFontSize(6.5);
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "bold");
    doc.text(c.label, cx, lineY);
    doc.setFontSize(9);
    doc.setTextColor(INK);
    doc.setFont("helvetica", "bold");
    doc.text(c.value, cx, lineY + 5);
  });

  const scoreY = y + 36;
  const scoreCellW = (width - 6) / 3;
  const scores: [string, number | undefined][] = [
    ["Fezes", pasto.scores.fezes],
    ["Corporal", pasto.scores.corporal],
    ["Bebedouro", pasto.scores.bebedouro],
  ];
  scores.forEach(([label, nota], i) => {
    const cx = x + 3 + i * scoreCellW;
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(INK_SOFT);
    doc.text(label.toUpperCase(), cx, scoreY);
    const dotY = scoreY + 4;
    const dotR = 1.6;
    const gap = 4.5;
    const notaInt = nota ? Math.round(nota) : null;
    for (let n = 1; n <= 5; n++) {
      const dx = cx + 2 + (n - 1) * gap;
      if (notaInt && n <= notaInt) doc.setFillColor(GOLD);
      else doc.setFillColor("#E7E3D6");
      doc.circle(dx, dotY, dotR, "F");
    }
    if (nota) {
      doc.setFontSize(7);
      doc.setTextColor(GREEN_DARK);
      doc.setFont("helvetica", "bold");
      doc.text(nota.toFixed(1), cx + 2 + 5 * gap + 2, dotY + 1.2);
    }
  });

  if (pasto.observacao) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(INK_SOFT);
    doc.text("OBSERVAÇÃO", x + 3, y + 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(INK);
    const lines = doc.splitTextToSize(pasto.observacao, width - 6);
    doc.text(lines.slice(0, 2), x + 3, y + 55);
  }

  const fotosStartY = y + 66;
  const fotoAreaH = height - (fotosStartY - y) - 4;
  const cols = 5;
  const gap = 2;
  const fw = (width - 6 - (cols - 1) * gap) / cols;
  const fh = Math.min(fw, fotoAreaH);
  for (let i = 0; i < cols; i++) {
    const fx = x + 3 + i * (fw + gap);
    const foto = pasto.fotos[i];
    if (foto) {
      const dataUrl = fotosCache[foto.id];
      if (dataUrl) {
        try {
          const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
          doc.addImage(dataUrl, fmt, fx, fotosStartY, fw, fh, undefined, "FAST");
        } catch {
          doc.setDrawColor(LINE);
          doc.rect(fx, fotosStartY, fw, fh);
        }
      } else {
        doc.setFillColor("#F3F1E8");
        doc.rect(fx, fotosStartY, fw, fh, "F");
      }
    } else {
      doc.setDrawColor(LINE);
      doc.setFillColor("#FAF8F0");
      doc.roundedRect(fx, fotosStartY, fw, fh, 1, 1, "FD");
    }
  }
}

function drawTextBlock(doc: jsPDF, title: string, text: string, y: number, x = 15): number {
  const w = doc.internal.pageSize.getWidth() - 30;
  doc.setFillColor(GREEN_DARK);
  doc.rect(x, y, 3, 8, "F");
  doc.setTextColor(GREEN_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title.toUpperCase(), x + 6, y + 6);

  doc.setTextColor(INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(text || "—", w);
  doc.text(lines, x, y + 15);
  return y + 15 + lines.length * 4.8;
}

export async function generateVisitaPdf(data: VisitaPdfData): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const [logoDataUrl] = await Promise.all([fetchAssetDataUrl(logoAsset.url)]);
  const fotosCache: Record<string, string | null> = {};
  const allFotos = data.pastos.flatMap(p => p.fotos.slice(0, 5));
  await Promise.all(allFotos.map(async f => { fotosCache[f.id] = await fetchAssetDataUrl(
    (await supabase.storage.from(BUCKET_FOTOS).createSignedUrl(f.url, 60 * 60)).data?.signedUrl || ""
  ); }));
  // Actually preserve original behaviour for fotos:
  await Promise.all(allFotos.map(async f => { if (!fotosCache[f.id]) fotosCache[f.id] = await fetchFotoDataUrl(f.url); }));

  // PAGE 1 — cover header claro + fazenda + intro blocks
  drawCoverHeader(doc, logoDataUrl, "Visita de Rotina");
  let y = drawFarmBlock(doc, data, 50);

  const intros: [string, string | null | undefined][] = [
    ["Objetivo da Visita", data.objetivo_visita],
    ["Resumo Executivo", data.resumo_executivo],
    ["Indicadores Gerais", data.indicadores_gerais],
  ];
  for (const [title, txt] of intros) {
    const t = (txt || "").trim();
    if (!t) continue;
    // page break if perto do rodapé
    if (y > pageH - 60) { doc.addPage(); y = 20; }
    y = drawIntroBlock(doc, title, t, y);
  }

  // PAGES: 2 pastos por página — cabeçalho enxuto só com nome da fazenda
  const pastosPorPagina = 2;
  const blockHeight = 100;
  const gap = 8;

  for (let i = 0; i < data.pastos.length; i += pastosPorPagina) {
    doc.addPage();
    const pair = data.pastos.slice(i, i + pastosPorPagina);
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(data.fazenda.nome_fazenda || "", 15, 12);
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.4);
    doc.line(15, 16, pageW - 15, 16);

    let py = 24;
    for (const p of pair) {
      await drawPastoBlock(doc, p, fotosCache, 15, py, pageW - 30, blockHeight);
      py += blockHeight + gap;
    }
  }

  // ÚLTIMA PÁGINA: observações + conclusão + assinatura
  doc.addPage();
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(data.fazenda.nome_fazenda || "", 15, 12);
  doc.setDrawColor(LINE);
  doc.line(15, 16, pageW - 15, 16);

  let fy = 26;
  fy = drawTextBlock(doc, "Observações Gerais", data.observacoes_gerais || "—", fy);
  fy = Math.max(fy + 8, 130);
  drawTextBlock(doc, "Conclusão da Visita", data.conclusao || "—", fy);

  const sigY = pageH - 40;
  doc.setDrawColor(INK_SOFT);
  doc.setLineWidth(0.3);
  doc.line(pageW / 2 - 40, sigY, pageW / 2 + 40, sigY);
  doc.setTextColor(INK_SOFT);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(data.consultor.nome || "Consultor", pageW / 2, sigY + 5, { align: "center" });
  doc.setFontSize(8);
  doc.text("Consultor Técnico", pageW / 2, sigY + 10, { align: "center" });

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, p, total);
  }

  const blob = doc.output("blob");
  const stamp = format(new Date(), "yyyyMMdd-HHmm");
  const safeName = (data.fazenda.nome_fazenda || "fazenda").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const fileName = `visita-${safeName}-${stamp}.pdf`;
  return { blob, fileName };
}

export async function uploadVisitaPdf(
  blob: Blob, fileName: string, consultorId: string, visitaId: string,
): Promise<string> {
  const path = `visitas-consultor/${consultorId}/${visitaId}/${fileName}`;
  const { error } = await supabase.storage
    .from(BUCKET_RELATORIOS)
    .upload(path, blob, { upsert: true, contentType: "application/pdf" });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET_RELATORIOS).getPublicUrl(path);
  return data.publicUrl;
}
