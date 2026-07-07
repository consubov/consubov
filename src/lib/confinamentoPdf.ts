import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

const BUCKET_FOTOS = "visitas-consultor-fotos";
const BUCKET_RELATORIOS = "relatorios";

// Palette (same as rotina)
const GREEN_DARK = "#14432B";
const GREEN_MED = "#1F7A4D";
const GOLD = "#C9A84C";
const INK = "#1C1C1A";
const INK_SOFT = "#767066";
const LINE = "#E7E3D6";

export interface ConfinamentoPdfCurral {
  id: string;
  num_curral: string;
  scores: { fezes?: number; corporal?: number; bebedouro?: number }; // médias
  sampleCounts?: { fezes: number; corporal: number; bebedouro: number };
  fotos: { id: string; url: string; ordem: number }[]; // url = storage path
}

export interface ConfinamentoPdfData {
  visitaId: string;
  fazenda: { nome_fazenda: string; proprietario?: string | null; municipio?: string | null; uf?: string | null };
  consultor: { nome: string };
  hora_inicio: string;
  hora_fim: string | null;
  observacoes_gerais: string | null;
  conclusao: string | null;
  avaliacaoFabrica?: {
    organizacao_fabrica_nota: number | null;
    organizacao_insumos_nota: number | null;
  };
  currais: ConfinamentoPdfCurral[];
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

function drawHeaderPage1(doc: jsPDF, data: ConfinamentoPdfData) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(GREEN_DARK);
  doc.rect(0, 0, w, 60, "F");

  doc.setFillColor(GOLD);
  doc.roundedRect(15, 15, 14, 14, 2, 2, "F");
  doc.setTextColor(GREEN_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("C", 22, 25, { align: "center" });

  doc.setTextColor("#FFFFFF");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("RELATÓRIO DE VISITA · CONFINAMENTO", 34, 20);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Consubov Consultoria", 34, 27);

  doc.setFontSize(20);
  doc.text(data.fazenda.nome_fazenda || "—", 15, 48);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#E7E3D6");
  const loc = [data.fazenda.proprietario, data.fazenda.municipio, data.fazenda.uf].filter(Boolean).join(" · ");
  if (loc) doc.text(loc, 15, 55);

  doc.setTextColor(INK);
  const y = 75;
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
    doc.roundedRect(x, y, boxW, 18, 2, 2, "S");
    doc.setFontSize(7);
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "bold");
    doc.text(b.label, x + 3, y + 6);
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.setFont("helvetica", "bold");
    doc.text(b.value, x + 3, y + 13);
  });

  doc.setFontSize(9);
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "normal");
  doc.text(`Total de currais avaliados: ${data.currais.length}`, 15, y + 30);
}

function drawScoreRow(
  doc: jsPDF, label: string, nota: number | null | undefined, x: number, y: number, cellW: number,
) {
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(INK_SOFT);
  doc.text(label.toUpperCase(), x, y);
  const dotY = y + 4;
  const dotR = 1.6;
  const gap = 4.5;
  for (let n = 1; n <= 5; n++) {
    const dx = x + 2 + (n - 1) * gap;
    if (nota && n <= nota) doc.setFillColor(GOLD);
    else doc.setFillColor("#E7E3D6");
    doc.circle(dx, dotY, dotR, "F");
  }
  if (nota) {
    doc.setFontSize(7);
    doc.setTextColor(GREEN_DARK);
    doc.setFont("helvetica", "bold");
    doc.text(`${nota}/5`, x + 2 + 5 * gap + 2, dotY + 1.2);
  }
}

async function drawCurralBlock(
  doc: jsPDF,
  c: ConfinamentoPdfCurral,
  fotosCache: Record<string, string | null>,
  x: number, y: number, width: number, height: number,
) {
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, width, height, 2, 2, "S");

  // Badge with number
  const badgeW = 20;
  doc.setFillColor(GREEN_DARK);
  doc.roundedRect(x + 4, y + 4, badgeW, 12, 2, 2, "F");
  doc.setTextColor(GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(c.num_curral || "?", x + 4 + badgeW / 2, y + 12, { align: "center" });

  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Curral ${c.num_curral || "—"}`, x + badgeW + 8, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.text("Avaliação sanitária e organizacional", x + badgeW + 8, y + 14);

  doc.setDrawColor(LINE);
  doc.line(x + 3, y + 20, x + width - 3, y + 20);

  // Scores row 1: fezes / corporal / bebedouro
  const rowY1 = y + 26;
  const cellW = (width - 6) / 3;
  drawScoreRow(doc, "Fezes", c.scores.fezes, x + 3, rowY1, cellW);
  drawScoreRow(doc, "Corporal", c.scores.corporal, x + 3 + cellW, rowY1, cellW);
  drawScoreRow(doc, "Bebedouro", c.scores.bebedouro, x + 3 + 2 * cellW, rowY1, cellW);

  // Row 2: org. fábrica / org. insumos
  const rowY2 = y + 40;
  const half = (width - 6) / 2;
  drawScoreRow(doc, "Org. Fábrica", c.organizacao_fabrica_nota, x + 3, rowY2, half);
  drawScoreRow(doc, "Org. Insumos", c.organizacao_insumos_nota, x + 3 + half, rowY2, half);

  // Fotos grid
  const fotosStartY = y + 54;
  const fotoAreaH = height - (fotosStartY - y) - 4;
  const cols = 5;
  const gap = 2;
  const fw = (width - 6 - (cols - 1) * gap) / cols;
  const fh = Math.min(fw, fotoAreaH);
  for (let i = 0; i < cols; i++) {
    const fx = x + 3 + i * (fw + gap);
    const foto = c.fotos[i];
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

function drawChartPage(doc: jsPDF, data: ConfinamentoPdfData) {
  const pageW = doc.internal.pageSize.getWidth();

  // Section bar
  doc.setFillColor(GREEN_DARK);
  doc.rect(0, 0, pageW, 18, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Médias por Classificação", 15, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#E7E3D6");
  doc.text(data.fazenda.nome_fazenda, pageW - 15, 12, { align: "right" });

  // Compute averages
  const totals = { fezes: 0, corporal: 0, bebedouro: 0, fabrica: 0, insumos: 0 };
  const counts = { fezes: 0, corporal: 0, bebedouro: 0, fabrica: 0, insumos: 0 };
  for (const c of data.currais) {
    if (c.scores.fezes) { totals.fezes += c.scores.fezes; counts.fezes++; }
    if (c.scores.corporal) { totals.corporal += c.scores.corporal; counts.corporal++; }
    if (c.scores.bebedouro) { totals.bebedouro += c.scores.bebedouro; counts.bebedouro++; }
    if (c.organizacao_fabrica_nota) { totals.fabrica += c.organizacao_fabrica_nota; counts.fabrica++; }
    if (c.organizacao_insumos_nota) { totals.insumos += c.organizacao_insumos_nota; counts.insumos++; }
  }
  const bars: { label: string; value: number }[] = [
    { label: "Fezes", value: counts.fezes ? totals.fezes / counts.fezes : 0 },
    { label: "Corporal", value: counts.corporal ? totals.corporal / counts.corporal : 0 },
    { label: "Bebedouro", value: counts.bebedouro ? totals.bebedouro / counts.bebedouro : 0 },
    { label: "Org. Fábrica", value: counts.fabrica ? totals.fabrica / counts.fabrica : 0 },
    { label: "Org. Insumos", value: counts.insumos ? totals.insumos / counts.insumos : 0 },
  ];

  // Chart area
  const chartX = 25;
  const chartY = 40;
  const chartW = pageW - 50;
  const chartH = 130;

  doc.setDrawColor(LINE);
  doc.setLineWidth(0.3);
  // Y grid lines at 1..5
  for (let n = 0; n <= 5; n++) {
    const gy = chartY + chartH - (chartH * n) / 5;
    doc.line(chartX, gy, chartX + chartW, gy);
    doc.setFontSize(7);
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "normal");
    doc.text(String(n), chartX - 3, gy + 1, { align: "right" });
  }

  // Bars
  const gap = 6;
  const barW = (chartW - gap * (bars.length + 1)) / bars.length;
  bars.forEach((b, i) => {
    const bx = chartX + gap + i * (barW + gap);
    const bh = (chartH * b.value) / 5;
    const by = chartY + chartH - bh;
    doc.setFillColor(GOLD);
    doc.rect(bx, by, barW, bh, "F");
    // Value on top
    doc.setFontSize(9);
    doc.setTextColor(GREEN_DARK);
    doc.setFont("helvetica", "bold");
    doc.text(b.value ? b.value.toFixed(1) : "—", bx + barW / 2, by - 2, { align: "center" });
    // Label under axis
    doc.setFontSize(8);
    doc.setTextColor(INK);
    doc.setFont("helvetica", "bold");
    doc.text(b.label, bx + barW / 2, chartY + chartH + 6, { align: "center" });
  });

  // Legend note
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Escala 1 (pior) a 5 (melhor). Médias calculadas a partir dos currais avaliados nesta visita.",
    pageW / 2, chartY + chartH + 20, { align: "center" },
  );
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

export async function generateConfinamentoPdf(data: ConfinamentoPdfData): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Preload photos (first 5 per curral in PDF grid)
  const fotosCache: Record<string, string | null> = {};
  const allFotos = data.currais.flatMap(c => c.fotos.slice(0, 5));
  await Promise.all(allFotos.map(async f => { fotosCache[f.id] = await fetchFotoDataUrl(f.url); }));

  // Page 1
  drawHeaderPage1(doc, data);

  // Curral pages: 2 per page
  const perPage = 2;
  const blockH = 100;
  const gap = 8;
  for (let i = 0; i < data.currais.length; i += perPage) {
    doc.addPage();
    const pair = data.currais.slice(i, i + perPage);
    doc.setFillColor(GREEN_DARK);
    doc.rect(0, 0, pageW, 18, "F");
    doc.setTextColor("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Currais (${i + 1}–${i + pair.length} de ${data.currais.length})`, 15, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor("#E7E3D6");
    doc.text(data.fazenda.nome_fazenda, pageW - 15, 12, { align: "right" });

    let y = 26;
    for (const c of pair) {
      await drawCurralBlock(doc, c, fotosCache, 15, y, pageW - 30, blockH);
      y += blockH + gap;
    }
  }

  // Chart page
  doc.addPage();
  drawChartPage(doc, data);

  // Final page: obs + conclusão
  doc.addPage();
  doc.setFillColor(GREEN_DARK);
  doc.rect(0, 0, pageW, 18, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Considerações Finais", 15, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#E7E3D6");
  doc.text(data.fazenda.nome_fazenda, pageW - 15, 12, { align: "right" });

  let y = 30;
  y = drawTextBlock(doc, "Observações Gerais", data.observacoes_gerais || "—", y);
  y = Math.max(y + 8, 130);
  drawTextBlock(doc, "Conclusão da Visita", data.conclusao || "—", y);

  const sigY = pageH - 40;
  doc.setDrawColor(INK_SOFT);
  doc.setLineWidth(0.3);
  doc.line(pageW / 2 - 40, sigY, pageW / 2 + 40, sigY);
  doc.setTextColor(INK_SOFT);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(data.consultor.nome || "Consultor", pageW / 2, sigY + 5, { align: "center" });
  doc.setFontSize(8);
  doc.text("Consultor Técnico – Consubov", pageW / 2, sigY + 10, { align: "center" });

  // Footers
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, p, total);
  }

  const blob = doc.output("blob");
  const stamp = format(new Date(), "yyyyMMdd-HHmm");
  const safeName = (data.fazenda.nome_fazenda || "fazenda").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const fileName = `confinamento-${safeName}-${stamp}.pdf`;
  return { blob, fileName };
}

export async function uploadConfinamentoPdf(
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
