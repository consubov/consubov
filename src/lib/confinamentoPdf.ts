import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/consubov-logo-preta.jpeg.asset.json";
import { getScoreDescription, SCORE_SCALE_HINT } from "@/lib/scoreLegends";
import { drawAssinaturas } from "@/lib/pdfAssinaturas";
import { drawAllSampleChartPages } from "@/lib/pdfLineCharts";
import { fetchWithConsultorTimeout, withConsultorTimeout } from "@/lib/consultorOffline/network";

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
  samples?: { fezes: number[]; corporal: number[]; bebedouro: number[] };
  fotos: { id: string; url: string; ordem: number }[];
}

export interface ConfinamentoPdfData {
  visitaId: string;
  fazenda: { nome_fazenda: string; proprietario?: string | null; responsavel?: string | null; municipio?: string | null; uf?: string | null };
  consultor: { nome: string };
  hora_inicio: string;
  hora_fim: string | null;
  observacoes_gerais: string | null;
  titulo_encerramento?: string | null;
  conclusao: string | null;
  objetivo_visita?: string | null;
  resumo_executivo?: string | null;
  indicadores_gerais?: string | null;
  avaliacaoFabrica?: {
    organizacao_fabrica_nota: number | null;
    organizacao_insumos_nota: number | null;
  };
  currais: ConfinamentoPdfCurral[];
  topicos?: { id: string; titulo: string; texto: string | null; ordem: number; zona?: "introducao" | "desenvolvimento" | "conclusao";
    fotos: { id: string; url: string; ordem: number }[] }[];
  assinantes?: { nome: string; cargo_funcao: string }[];
  logoOverride?: { esquerdaPath: string | null; direitaPath: string | null } | null;
}

async function fetchFotoDataUrl(path: string): Promise<string | null> {
  try {
    const { data } = await withConsultorTimeout(
      supabase.storage.from(BUCKET_FOTOS).createSignedUrl(path, 60 * 60),
      "assinatura da foto do relatório",
    );
    if (!data?.signedUrl) return null;
    const res = await fetchWithConsultorTimeout(data.signedUrl, "download da foto do relatório");
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
type LogoAsset = { dataUrl: string; w: number; h: number } | null;

async function measureImage(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve({ w: im.naturalWidth || 1, h: im.naturalHeight || 1 });
    im.onerror = () => resolve({ w: 1, h: 1 });
    im.src = dataUrl;
  });
}

async function fetchLogoAsset(path: string | null | undefined): Promise<LogoAsset> {
  if (!path) return null;
  try {
    let res: Response;
    if (/^https?:\/\//i.test(path)) {
      res = await fetchWithConsultorTimeout(path, "download da logo do relatório");
    } else {
      const { data } = await withConsultorTimeout(
        supabase.storage.from(BUCKET_LOGOS).createSignedUrl(path, 60 * 60),
        "assinatura da logo do relatório",
      );
      if (!data?.signedUrl) return null;
      res = await fetchWithConsultorTimeout(data.signedUrl, "download da logo do relatório");
    }
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const s = await measureImage(dataUrl);
    return { dataUrl, w: s.w, h: s.h };
  } catch { return null; }
}

async function fetchAssetDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetchWithConsultorTimeout(url, "download do asset do relatório");
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function toLogoAsset(dataUrl: string | null): Promise<LogoAsset> {
  if (!dataUrl) return null;
  const s = await measureImage(dataUrl);
  return { dataUrl, w: s.w, h: s.h };
}

function drawLogoFitted(
  doc: jsPDF, asset: LogoAsset, boxX: number, boxY: number, boxW: number, boxH: number, align: "left" | "right",
) {
  if (!asset) return;
  // Escala SEMPRE pela mesma altura (boxH), sem clamp por largura, para que
  // ambas as logos fiquem visualmente com a mesma altura.
  const h = boxH;
  const w = asset.w * (boxH / asset.h);
  const x = align === "left" ? boxX : boxX + boxW - w;
  const y = boxY;
  const fmt = asset.dataUrl.includes("image/png") ? "PNG" : "JPEG";
  try { doc.addImage(asset.dataUrl, fmt, x, y, w, h); } catch { /* ignore */ }
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
  defaultLogo: LogoAsset,
  subtitle: string,
  logos?: { esquerda: LogoAsset; direita: LogoAsset } | null,
) {
  const w = doc.internal.pageSize.getWidth();
  const logoH = 16;
  const logoW = 60;
  const logoX = 15;
  const logoY = 10;

  const leftAsset = logos?.esquerda || defaultLogo;
  drawLogoFitted(doc, leftAsset, logoX, logoY, logoW, logoH, "left");
  if (logos?.direita) {
    const rightBoxX = w - 15 - logoW;
    drawLogoFitted(doc, logos.direita, rightBoxX, logoY, logoW, logoH, "right");
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
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(data.fazenda.nome_fazenda || "—", 15, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(INK_SOFT);

  let metaY = y + 6;
  const locStr = [data.fazenda.municipio, data.fazenda.uf].filter(Boolean).join("/");
  if (locStr) { doc.text(locStr, 15, metaY); metaY += 5; }
  if (data.fazenda.proprietario) { doc.text(`Proprietário: ${data.fazenda.proprietario}`, 15, metaY); metaY += 5; }
  if (data.fazenda.responsavel) { doc.text(`Responsável: ${data.fazenda.responsavel}`, 15, metaY); metaY += 5; }
  doc.text(`Consultor: ${data.consultor.nome || "—"}`, 15, metaY); metaY += 5;
  const inicioTxt = format(new Date(data.hora_inicio), "dd/MM/yyyy HH:mm", { locale: ptBR });
  const terminoTxt = data.hora_fim ? format(new Date(data.hora_fim), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—";
  doc.text(`Início: ${inicioTxt}  ·  Término: ${terminoTxt}`, 15, metaY);
  return metaY + 6;
}

function drawParagraphText(
  doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 4.6,
): number {
  const raw = String(text ?? "");
  const paragraphs = raw.split(/\r?\n/);

  const drawJustifiedLine = (line: string, lineY: number) => {
    const clean = line.trim().replace(/\s+/g, " ");
    const words = clean.split(" ").filter(Boolean);
    const lineWidth = doc.getTextWidth(clean);

    if (words.length < 4 || lineWidth < maxWidth * 0.82 || lineWidth >= maxWidth) {
      doc.text(clean, x, lineY);
      return;
    }

    const totalWordsWidth = words.reduce((sum, word) => sum + doc.getTextWidth(word), 0);
    const gap = (maxWidth - totalWordsWidth) / (words.length - 1);
    if (!Number.isFinite(gap) || gap <= 0 || gap > 4) {
      doc.text(clean, x, lineY);
      return;
    }

    let cursorX = x;
    words.forEach((word, index) => {
      doc.text(word, cursorX, lineY);
      cursorX += doc.getTextWidth(word) + (index < words.length - 1 ? gap : 0);
    });
  };

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) { y += lineHeight; continue; }
    const lines = doc.splitTextToSize(trimmed.replace(/\s+/g, " "), maxWidth) as string[];
    lines.forEach((line, index) => {
      if (index < lines.length - 1) drawJustifiedLine(line, y);
      else doc.text(line.trim().replace(/\s+/g, " "), x, y);
      y += lineHeight;
    });
  }
  return y;
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
  const yEnd = drawParagraphText(doc, text, 15, y + 11, w, 4.6);
  return yEnd + 4;
}

function drawScoreRow(
  doc: jsPDF, label: string, nota: number | null | undefined, x: number, y: number, cellW = 40,
) {
  const key = label.toLowerCase();
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(INK_SOFT);
  doc.text(label.toUpperCase(), x, y);
  const dotY = y + 4;
  // Indicador único (círculo + N/5) em vez das 5 opções.
  doc.setFillColor(nota ? GOLD : "#E7E3D6");
  doc.circle(x + 2, dotY, 1.8, "F");
  doc.setFontSize(9);
  doc.setTextColor(nota ? GREEN_DARK : INK_SOFT);
  doc.setFont("helvetica", "bold");
  doc.text(nota ? `${nota}/5` : "—", x + 6, dotY + 1.2);
  // Legenda curta
  doc.setFontSize(5.6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(INK_SOFT);
  const legend = getScoreDescription(key);
  if (legend) {
    const lines = doc.splitTextToSize(legend, cellW - 4);
    doc.text(lines.slice(0, 2), x, dotY + 4.8);
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
  drawScoreRow(doc, "Fezes", fezesDot, x + 3, rowY1, cellW);
  drawScoreRow(doc, "Corporal", corpoDot, x + 3 + cellW, rowY1, cellW);
  drawScoreRow(doc, "Bebedouro", bebDot, x + 3 + 2 * cellW, rowY1, cellW);

  // Grid até 10 fotos: 2 linhas × 5 colunas
  const fotosStartY = y + 54;
  const fotoAreaH = height - (fotosStartY - y) - 4;
  const cols = 5;
  const rows = 2;
  const gap = 2;
  const fw = (width - 6 - (cols - 1) * gap) / cols;
  const fh = (fotoAreaH - (rows - 1) * gap) / rows;
  const maxFotos = cols * rows; // 10
  const nFotos = Math.min(c.fotos.length, maxFotos);
  for (let i = 0; i < nFotos; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const fx = x + 3 + col * (fw + gap);
    const fy = fotosStartY + row * (fh + gap);
    const foto = c.fotos[i];
    const dataUrl = fotosCache[foto.id];
    if (dataUrl) {
      try {
        const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
        doc.addImage(dataUrl, fmt, fx, fy, fw, fh, undefined, "FAST");
      } catch {
        doc.setDrawColor(LINE);
        doc.rect(fx, fy, fw, fh);
      }
    } else {
      doc.setFillColor("#F3F1E8");
      doc.rect(fx, fy, fw, fh, "F");
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
  return drawParagraphText(doc, text || "—", x, y + 15, w, 4.8);
}

export async function generateConfinamentoPdf(data: ConfinamentoPdfData): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const logoDefaultDataUrl = await fetchAssetDataUrl(logoAsset.url);
  const [logoDefault, esquerda, direita] = await Promise.all([
    toLogoAsset(logoDefaultDataUrl),
    fetchLogoAsset(data.logoOverride?.esquerdaPath || null),
    fetchLogoAsset(data.logoOverride?.direitaPath || null),
  ]);
  const logos = { esquerda, direita };
  const fotosCache: Record<string, string | null> = {};
  const allFotos = [
    ...data.currais.flatMap(c => c.fotos.slice(0, 10)),
    ...((data.topicos || []).flatMap(t => t.fotos.slice(0, 5))),
  ];
  await Promise.all(allFotos.map(async f => { fotosCache[f.id] = await fetchFotoDataUrl(f.url); }));

  const allT = [...(data.topicos || [])].sort((a, b) => a.ordem - b.ordem);
  const zonaOf = (t: typeof allT[number]): "introducao" | "desenvolvimento" | "conclusao" => {
    if (t.zona) return t.zona;
    if (t.ordem >= 1001) return "conclusao";
    if (t.ordem >= 5 && t.ordem <= 1000) return "desenvolvimento";
    return "introducao";
  };
  const introT = allT.filter(t => zonaOf(t) === "introducao");
  const devT = allT.filter(t => zonaOf(t) === "desenvolvimento");
  const conclusaoT = allT.filter(t => zonaOf(t) === "conclusao");

  const drawTopicoFotos = (t: typeof allT[number], startY: number): number => {
    if (t.fotos.length === 0) return startY;
    const wArea = pageW - 30;
    const cols = 5;
    const gapF = 2;
    const fw = (wArea - (cols - 1) * gapF) / cols;
    const fh = fw;
    if (startY + fh > pageH - 30) { doc.addPage(); startY = 20; }
    for (let i = 0; i < Math.min(t.fotos.length, cols); i++) {
      const fx = 15 + i * (fw + gapF);
      const dataUrl = fotosCache[t.fotos[i].id];
      if (dataUrl) {
        try { const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
          doc.addImage(dataUrl, fmt, fx, startY, fw, fh, undefined, "FAST"); }
        catch { doc.setDrawColor(LINE); doc.rect(fx, startY, fw, fh); }
      } else { doc.setFillColor("#F3F1E8"); doc.rect(fx, startY, fw, fh, "F"); }
    }
    return startY + fh + 6;
  };

  // PAGE 1 — cover claro
  drawCoverHeader(doc, logoDefault, "Visita Técnica - Confinamento", logos);
  let y = drawFarmBlock(doc, data, 50);

  for (const t of introT) {
    const txt = (t.texto || "").trim();
    if (!txt && t.fotos.length === 0) continue;
    if (y > pageH - 60) { doc.addPage(); y = 20; }
    if (txt) y = drawIntroBlock(doc, t.titulo.trim() || " ", txt, y);
    y = drawTopicoFotos(t, y);
  }
  // Legacy fallback só quando não existir tópico de introdução.
  if (introT.length === 0) {
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
  }

  // Curral pages: 2 per page, cabeçalho enxuto
  const perPage = 2;
  const blockH = 130;
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

    // Escala uma única vez por página de currais.
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(INK_SOFT);
    doc.text(SCORE_SCALE_HINT, pageW - 15, 20, { align: "right" });

    let cy = 24;
    for (const c of pair) {
      await drawCurralBlock(doc, c, fotosCache, 15, cy, pageW - 30, blockH);
      cy += blockH + gap;
    }
  }

  // DESENVOLVIMENTO — tópicos após currais
  if (devT.length > 0) {
    doc.addPage();
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(data.fazenda.nome_fazenda || "", 15, 12);
    doc.setDrawColor(LINE);
    doc.line(15, 16, pageW - 15, 16);
    let dy = 24;
    for (const t of devT) {
      const txt = (t.texto || "").trim();
      if (!txt && t.fotos.length === 0) continue;
      if (dy > pageH - 60) { doc.addPage(); dy = 20; }
      if (txt) dy = drawTextBlock(doc, t.titulo.trim() || " ", txt, dy);
      dy = drawTopicoFotos(t, dy + 2) + 4;
    }
  }

  // Bar chart (Médias por Classificação) — sempre primeiro
  doc.addPage();
  drawChartPage(doc, data);

  // Line charts — amostras individuais (Fezes / Corporal / Bebedouro), uma página cada
  const series = {
    fezes: data.currais.flatMap(c => c.samples?.fezes || []),
    corporal: data.currais.flatMap(c => c.samples?.corporal || []),
    bebedouro: data.currais.flatMap(c => c.samples?.bebedouro || []),
  };
  drawAllSampleChartPages(doc, data.fazenda.nome_fazenda || "", series);



  // Final page
  doc.addPage();
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(data.fazenda.nome_fazenda || "", 15, 12);
  doc.setDrawColor(LINE);
  doc.line(15, 16, pageW - 15, 16);

  let fy = 26;
  // Título editável da seção final
  const tituloEnc = (data.titulo_encerramento || "Observações e Recomendações").trim() || "Observações e Recomendações";
  doc.setFillColor(GREEN_DARK);
  doc.rect(15, fy, 3, 10, "F");
  doc.setTextColor(GREEN_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(tituloEnc.toUpperCase(), 21, fy + 7);
  fy += 16;

  if (conclusaoT.length > 0) {
    for (const t of conclusaoT) {
      const txt = (t.texto || "").trim();
      if (!txt && t.fotos.length === 0) continue;
      if (fy > pageH - 60) { doc.addPage(); fy = 20; }
      if (txt) fy = drawTextBlock(doc, t.titulo.trim() || " ", txt, fy);
      fy = drawTopicoFotos(t, fy + 2) + 4;
    }
  } else {
    const obs = (data.observacoes_gerais || "").trim();
    const conc = (data.conclusao || "").trim();
    if (obs) {
      fy = drawTextBlock(doc, "Observações Gerais", obs, fy);
      fy = Math.max(fy + 8, 140);
    }
    if (conc) {
      drawTextBlock(doc, "Conclusão da Visita", conc, fy);
    }
  }

  drawAssinaturas(doc, pageW, pageH, data.assinantes, data.consultor.nome);

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
  const { error } = await withConsultorTimeout(supabase.storage
    .from(BUCKET_RELATORIOS)
    .upload(path, blob, { upsert: true, contentType: "application/pdf" }), "upload do PDF");
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET_RELATORIOS).getPublicUrl(path);
  return data.publicUrl;
}
