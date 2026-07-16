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

export interface ConfinamentoPdfCurral {
  id: string;
  num_curral: string;
  scores: { fezes?: number; corporal?: number; bebedouro?: number };
  sampleCounts?: { fezes: number; corporal: number; bebedouro: number };
  fotos: { id: string; url: string; ordem: number }[];
}

export interface ConfinamentoPdfData {
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
  avaliacaoFabrica?: {
    organizacao_fabrica_nota: number | null;
    organizacao_insumos_nota: number | null;
  };
  currais: ConfinamentoPdfCurral[];
  logoOverride?: { modo: 'padrao' | 'substituir' | 'adicionar'; path: string | null } | null;
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

const BUCKET_LOGOS = "logos-consultor";
async function fetchLogoDataUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  try {
    let res: Response;
    if (/^https?:\/\//i.test(path)) {
      res = await fetch(path);
    } else {
      const { data } = await supabase.storage.from(BUCKET_LOGOS).createSignedUrl(path, 60 * 60);
      if (!data?.signedUrl) return null;
      res = await fetch(data.signedUrl);
    }
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
  doc.text("Gerado por Consubov.com.br", 15, h - 6);
  doc.text(`Página ${page} de ${totalPages}`, w - 15, h - 6, { align: "right" });
}

function drawCoverHeader(
  doc: jsPDF,
  logoDataUrl: string | null,
  subtitle: string,
  logoOverride?: { modo: 'padrao' | 'substituir' | 'adicionar'; dataUrl: string | null } | null,
) {
  const w = doc.internal.pageSize.getWidth();
  const logoH = 16;
  const logoW = 44;
  const logoX = 15;
  const logoY = 10;

  const modo = logoOverride?.modo ?? 'padrao';
  const customUrl = logoOverride?.dataUrl ?? null;

  const leftLogo = modo === 'substituir' && customUrl ? customUrl : logoDataUrl;
  if (leftLogo) {
    try { doc.addImage(leftLogo, "PNG", logoX, logoY, logoW, logoH); } catch { /* ignore */ }
  }
  if (modo === 'adicionar' && customUrl) {
    const rightX = w - 15 - logoW;
    try { doc.addImage(customUrl, "PNG", rightX, logoY, logoW, logoH); } catch { /* ignore */ }
  }

  const dividerX = logoX + logoW + 6;
  doc.setDrawColor(GREEN_DARK);
  doc.setLineWidth(0.8);
  doc.line(dividerX, logoY, dividerX, logoY + logoH);

  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("RELATÓRIO TÉCNICO", dividerX + 4, logoY + 6);
  doc.setTextColor(INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(subtitle, dividerX + 4, logoY + 14);

  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.line(15, 36, w - 15, 36);
}

function drawFarmBlock(doc: jsPDF, data: ConfinamentoPdfData, y: number): number {
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

function drawScoreRow(
  doc: jsPDF, label: string, nota: number | null | undefined, x: number, y: number,
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
  doc: jsPDF, c: ConfinamentoPdfCurral, fotosCache: Record<string, string | null>,
  x: number, y: number, width: number, height: number,
) {
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, width, height, 2, 2, "S");

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
  doc.text("Avaliação", x + badgeW + 8, y + 14);

  doc.setDrawColor(LINE);
  doc.line(x + 3, y + 20, x + width - 3, y + 20);

  const rowY1 = y + 26;
  const cellW = (width - 6) / 3;
  const fezesDot = c.scores.fezes ? Math.round(c.scores.fezes) : null;
  const corpoDot = c.scores.corporal ? Math.round(c.scores.corporal) : null;
  const bebDot = c.scores.bebedouro ? Math.round(c.scores.bebedouro) : null;
  drawScoreRow(doc, "Fezes", fezesDot, x + 3, rowY1);
  drawScoreRow(doc, "Corporal", corpoDot, x + 3 + cellW, rowY1);
  drawScoreRow(doc, "Bebedouro", bebDot, x + 3 + 2 * cellW, rowY1);

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
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(data.fazenda.nome_fazenda || "", 15, 12);
  doc.setDrawColor(LINE);
  doc.line(15, 16, pageW - 15, 16);

  doc.setTextColor(GREEN_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Médias por Classificação", 15, 26);

  const totals = { fezes: 0, corporal: 0, bebedouro: 0 };
  const counts = { fezes: 0, corporal: 0, bebedouro: 0 };
  for (const c of data.currais) {
    if (c.scores.fezes) { totals.fezes += c.scores.fezes; counts.fezes++; }
    if (c.scores.corporal) { totals.corporal += c.scores.corporal; counts.corporal++; }
    if (c.scores.bebedouro) { totals.bebedouro += c.scores.bebedouro; counts.bebedouro++; }
  }
  const fabricaNota = data.avaliacaoFabrica?.organizacao_fabrica_nota ?? 0;
  const insumosNota = data.avaliacaoFabrica?.organizacao_insumos_nota ?? 0;
  const bars: { label: string; value: number }[] = [
    { label: "Fezes", value: counts.fezes ? totals.fezes / counts.fezes : 0 },
    { label: "Corporal", value: counts.corporal ? totals.corporal / counts.corporal : 0 },
    { label: "Bebedouro", value: counts.bebedouro ? totals.bebedouro / counts.bebedouro : 0 },
    { label: "Org. Fábrica", value: fabricaNota || 0 },
    { label: "Org. Insumos", value: insumosNota || 0 },
  ];

  const chartX = 25;
  const chartY = 45;
  const chartW = pageW - 50;
  const chartH = 130;

  doc.setDrawColor(LINE);
  doc.setLineWidth(0.3);
  for (let n = 0; n <= 5; n++) {
    const gy = chartY + chartH - (chartH * n) / 5;
    doc.line(chartX, gy, chartX + chartW, gy);
    doc.setFontSize(7);
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "normal");
    doc.text(String(n), chartX - 3, gy + 1, { align: "right" });
  }

  const gap = 6;
  const barW = (chartW - gap * (bars.length + 1)) / bars.length;
  bars.forEach((b, i) => {
    const bx = chartX + gap + i * (barW + gap);
    const bh = (chartH * b.value) / 5;
    const by = chartY + chartH - bh;
    doc.setFillColor(GOLD);
    doc.rect(bx, by, barW, bh, "F");
    doc.setFontSize(9);
    doc.setTextColor(GREEN_DARK);
    doc.setFont("helvetica", "bold");
    doc.text(b.value ? b.value.toFixed(1) : "—", bx + barW / 2, by - 2, { align: "center" });
    doc.setFontSize(8);
    doc.setTextColor(INK);
    doc.setFont("helvetica", "bold");
    doc.text(b.label, bx + barW / 2, chartY + chartH + 6, { align: "center" });
  });

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

  const logoDataUrl = await fetchAssetDataUrl(logoAsset.url);
  const fotosCache: Record<string, string | null> = {};
  const allFotos = data.currais.flatMap(c => c.fotos.slice(0, 5));
  await Promise.all(allFotos.map(async f => { fotosCache[f.id] = await fetchFotoDataUrl(f.url); }));

  // PAGE 1 — cover claro
  drawCoverHeader(doc, logoDataUrl, "Visita Técnica - Confinamento");
  let y = drawFarmBlock(doc, data, 50);

  const intros: [string, string | null | undefined][] = [
    ["Objetivo da Visita", data.objetivo_visita],
    ["Resumo Executivo", data.resumo_executivo],
    ["Indicadores Gerais", data.indicadores_gerais],
  ];
  for (const [title, txt] of intros) {
    const t = (txt || "").trim();
    if (!t) continue;
    if (y > pageH - 60) { doc.addPage(); y = 20; }
    y = drawIntroBlock(doc, title, t, y);
  }

  // Curral pages: 2 per page, cabeçalho enxuto
  const perPage = 2;
  const blockH = 100;
  const gap = 8;
  for (let i = 0; i < data.currais.length; i += perPage) {
    doc.addPage();
    const pair = data.currais.slice(i, i + perPage);
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(data.fazenda.nome_fazenda || "", 15, 12);
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.4);
    doc.line(15, 16, pageW - 15, 16);

    let cy = 24;
    for (const c of pair) {
      await drawCurralBlock(doc, c, fotosCache, 15, cy, pageW - 30, blockH);
      cy += blockH + gap;
    }
  }

  // Chart page
  doc.addPage();
  drawChartPage(doc, data);

  // Final page
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
