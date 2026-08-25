import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/consubov-logo-preta.jpeg.asset.json";
import { mentionsToText } from "@/lib/photoMentions";
import { getActivePhotoLinks, setActivePhotoLinks, PhotoLinkCollector, currentPage } from "@/lib/pdfPhotoLinks";
import { getScoreDescription, SCORE_SCALE_HINT } from "@/lib/scoreLegends";
import { drawAssinaturas } from "@/lib/pdfAssinaturas";
import { drawAllSampleChartPages, drawFezesCategoriaChartPages, type SampleChartTypes } from "@/lib/pdfLineCharts";
import { fetchWithConsultorTimeout, withConsultorTimeout } from "@/lib/consultorOffline/network";
import { prefetchFotosDataUrls } from "@/lib/pdfImagePrep";

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
  dieta_categoria?: string | null;
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
  pennState?: {
    id: string;
    nome: string;
    ordem: number;
    percentual_19mm: number;
    percentual_8mm: number;
    percentual_4mm: number;
    percentual_fundo: number;
    fef: number;
    peNDF: number | null;
    aviso_divergencia: string | null;
    fotos: { id: string; url: string; ordem: number }[];
  }[];
  topicos?: { id: string; titulo: string; texto: string | null; ordem: number; zona?: "introducao" | "desenvolvimento" | "conclusao";
    fotos: { id: string; url: string; ordem: number }[] }[];
  numeroMap?: Record<string, number>;
  assinantes?: { nome: string; cargo_funcao: string }[];
  logoOverride?: { esquerdaPath: string | null; direitaPath: string | null } | null;
  chartType?: "bars" | "lines" | "pie" | "radar";
  sampleChartTypes?: SampleChartTypes;
  indicadoresZootecnicos?: {
    indicador: { currais_ocupados: number | null; animais_ativos: number | null } | null;
    faixas: { faixa: string; ordem: number; quantidade_animais: number | null; consumo_medio_pv: number | null }[];
  } | null;
}

/** Selo numerado (canto sup. esquerdo da foto). */
function drawNumeroBadge(doc: jsPDF, x: number, y: number, n: number) {
  getActivePhotoLinks()?.setTarget(n, currentPage(doc), y);
  const r = 3.4;
  doc.setFillColor(GREEN_DARK);
  doc.circle(x + r, y + r, r, "F");
  doc.setTextColor(GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(String(n), x + r, y + r, { align: "center", baseline: "middle" });
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
  doc.setFont("helvetica", "bold");
  doc.text("Relatto\u00AE", 15, h - 9);
  doc.setFont("helvetica", "normal");
  doc.text("Gerado por Consubov.com.br", 15, h - 5);
  doc.text(`Página ${page} de ${totalPages}`, w - 15, h - 5, { align: "right" });
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
  const linker = getActivePhotoLinks();
  const raw = mentionsToText(String(text ?? ""));
  const paragraphs = raw.split(/\r?\n/);

  const drawWordsTracked = (words: string[], lineY: number, advance: (w: string) => number) => {
    const isNum = (w: string) => /^\d+[.,;:)\]]?$/.test(w);
    const partOfMention = new Set<number>();
    const pairs: { i: number; numero: number }[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i] === "Imagem" && isNum(words[i + 1])) {
        partOfMention.add(i); partOfMention.add(i + 1);
        pairs.push({ i, numero: parseInt(words[i + 1], 10) });
        i++;
      }
    }
    const xs: number[] = [];
    let cursorX = x;
    words.forEach((word, i) => {
      xs.push(cursorX);
      if (partOfMention.has(i)) doc.setTextColor(GREEN_DARK);
      doc.text(word, cursorX, lineY);
      if (partOfMention.has(i)) doc.setTextColor(INK);
      cursorX += advance(word);
    });
    for (const p of pairs) {
      const x0 = xs[p.i];
      const x1 = xs[p.i + 1] + doc.getTextWidth(words[p.i + 1]);
      doc.setDrawColor(GREEN_DARK);
      doc.setLineWidth(0.2);
      doc.line(x0, lineY + 0.8, x1, lineY + 0.8);
      linker?.addRef({
        numero: p.numero, page: currentPage(doc),
        x: x0, y: lineY - 3.2, w: Math.max(1, x1 - x0), h: 4.6,
      });
    }
  };

  const lineHasMention = (line: string) => /\bImagem\s+\d/.test(line);

  const drawJustifiedLine = (line: string, lineY: number) => {
    const clean = line.trim().replace(/\s+/g, " ");
    const words = clean.split(" ").filter(Boolean);
    const lineWidth = doc.getTextWidth(clean);

    if (words.length < 4 || lineWidth < maxWidth * 0.82 || lineWidth >= maxWidth) {
      if (lineHasMention(clean)) {
        const spaceW = doc.getTextWidth(" ");
        drawWordsTracked(words, lineY, w => doc.getTextWidth(w) + spaceW);
      } else doc.text(clean, x, lineY);
      return;
    }

    const totalWordsWidth = words.reduce((sum, word) => sum + doc.getTextWidth(word), 0);
    const gap = (maxWidth - totalWordsWidth) / (words.length - 1);
    if (!Number.isFinite(gap) || gap <= 0 || gap > 4) {
      if (lineHasMention(clean)) {
        const spaceW = doc.getTextWidth(" ");
        drawWordsTracked(words, lineY, w => doc.getTextWidth(w) + spaceW);
      } else doc.text(clean, x, lineY);
      return;
    }

    if (lineHasMention(clean)) {
      drawWordsTracked(words, lineY, w => doc.getTextWidth(w) + gap);
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
      else {
        const clean = line.trim().replace(/\s+/g, " ");
        if (lineHasMention(clean)) {
          const spaceW = doc.getTextWidth(" ");
          drawWordsTracked(clean.split(" ").filter(Boolean), y, w => doc.getTextWidth(w) + spaceW);
        } else doc.text(clean, x, y);
      }
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
  numeroMap?: Record<string, number>,
) {
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, width, height, 2, 2, "S");

  const label = c.num_curral || "?";
  doc.setFont("helvetica", "bold");
  const MAX_BADGE_W = 44;
  const MIN_BADGE_W = 20;
  let badgeFont = 11;
  doc.setFontSize(badgeFont);
  let textW = doc.getTextWidth(label);
  while (textW + 4 > MAX_BADGE_W && badgeFont > 6) {
    badgeFont -= 1;
    doc.setFontSize(badgeFont);
    textW = doc.getTextWidth(label);
  }
  const badgeW = Math.min(MAX_BADGE_W, Math.max(MIN_BADGE_W, textW + 4));
  doc.setFillColor(GREEN_DARK);
  doc.roundedRect(x + 4, y + 4, badgeW, 12, 2, 2, "F");
  doc.setTextColor(GOLD);
  doc.text(label, x + 4 + badgeW / 2, y + 12, { align: "center" });

  const titleX = x + 4 + badgeW + 4;
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Curral ${label}`, titleX, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.text("Avaliação", titleX, y + 14);

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
    const num = numeroMap?.[foto.id];
    if (num != null) drawNumeroBadge(doc, fx + 1.5, fy + 1.5, num);
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
  const kind = data.chartType || "bars";

  if (kind === "bars") {
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
  } else if (kind === "lines") {
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
    const step = bars.length > 1 ? chartW / (bars.length - 1) : 0;
    const points = bars.map((b, i) => ({
      x: chartX + i * step,
      y: chartY + chartH - (chartH * b.value) / 5,
      b,
    }));
    doc.setDrawColor(GOLD);
    doc.setLineWidth(1.2);
    for (let i = 0; i < points.length - 1; i++) {
      doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }
    points.forEach(p => {
      doc.setFillColor(GREEN_DARK);
      doc.circle(p.x, p.y, 1.6, "F");
      doc.setFontSize(9);
      doc.setTextColor(GREEN_DARK);
      doc.setFont("helvetica", "bold");
      doc.text(p.b.value ? p.b.value.toFixed(1) : "—", p.x, p.y - 3, { align: "center" });
      doc.setFontSize(8);
      doc.setTextColor(INK);
      doc.text(p.b.label, p.x, chartY + chartH + 6, { align: "center" });
    });
  } else if (kind === "pie") {
    const cx = pageW / 2;
    const cy = chartY + chartH / 2;
    const r = Math.min(chartH / 2 - 6, 55);
    const total = bars.reduce((s, b) => s + (b.value || 0), 0);
    const palette = ["#C9A84C", "#14432B", "#1F7A4D", "#8A6D2E", "#4C8C68"];
    if (total <= 0) {
      doc.setDrawColor(LINE);
      doc.circle(cx, cy, r, "S");
      doc.setFontSize(9);
      doc.setTextColor(INK_SOFT);
      doc.text("Sem dados", cx, cy, { align: "center", baseline: "middle" });
    } else {
      let acc = -Math.PI / 2;
      const steps = 60;
      bars.forEach((b, idx) => {
        const frac = (b.value || 0) / total;
        if (frac <= 0) return;
        const end = acc + frac * Math.PI * 2;
        // build filled polygon approximating the sector
        const pts: [number, number][] = [[cx, cy]];
        const n = Math.max(2, Math.ceil(steps * frac));
        for (let i = 0; i <= n; i++) {
          const a = acc + (end - acc) * (i / n);
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        doc.setFillColor(palette[idx % palette.length]);
        const lines: [number, number][] = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
        (doc as any).lines(lines, pts[0][0], pts[0][1], [1, 1], "F", true);
        // label near mid-angle outside
        const mid = (acc + end) / 2;
        const lx = cx + Math.cos(mid) * (r + 10);
        const ly = cy + Math.sin(mid) * (r + 10);
        doc.setFontSize(8);
        doc.setTextColor(INK);
        doc.setFont("helvetica", "bold");
        doc.text(`${b.label}: ${b.value ? b.value.toFixed(1) : "—"}`, lx, ly, { align: "center" });
        acc = end;
      });
    }
  } else if (kind === "radar") {
    const cx = pageW / 2;
    const cy = chartY + chartH / 2;
    const r = Math.min(chartH / 2 - 10, 55);
    const N = bars.length;
    const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
    // rings
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.3);
    for (let g = 1; g <= 5; g++) {
      const rr = (r * g) / 5;
      const pts: [number, number][] = [];
      for (let i = 0; i < N; i++) pts.push([cx + Math.cos(angle(i)) * rr, cy + Math.sin(angle(i)) * rr]);
      for (let i = 0; i < N; i++) {
        const a = pts[i]; const b = pts[(i + 1) % N];
        doc.line(a[0], a[1], b[0], b[1]);
      }
    }
    // axes + labels
    bars.forEach((b, i) => {
      const ax = cx + Math.cos(angle(i)) * r;
      const ay = cy + Math.sin(angle(i)) * r;
      doc.setDrawColor(LINE);
      doc.line(cx, cy, ax, ay);
      const lx = cx + Math.cos(angle(i)) * (r + 10);
      const ly = cy + Math.sin(angle(i)) * (r + 10);
      doc.setFontSize(8);
      doc.setTextColor(INK);
      doc.setFont("helvetica", "bold");
      doc.text(b.label, lx, ly, { align: "center", baseline: "middle" });
    });
    // data polygon
    const dpts: [number, number][] = bars.map((b, i) => {
      const rr = (r * (b.value || 0)) / 5;
      return [cx + Math.cos(angle(i)) * rr, cy + Math.sin(angle(i)) * rr];
    });
    const rel: [number, number][] = dpts.slice(1).map((p, i) => [p[0] - dpts[i][0], p[1] - dpts[i][1]]);
    rel.push([dpts[0][0] - dpts[dpts.length - 1][0], dpts[0][1] - dpts[dpts.length - 1][1]]);
    doc.setFillColor(GOLD);
    doc.setDrawColor(GREEN_DARK);
    doc.setLineWidth(0.8);
    (doc as any).lines(rel, dpts[0][0], dpts[0][1], [1, 1], "FD", true);
    bars.forEach((b, i) => {
      doc.setFillColor(GREEN_DARK);
      doc.circle(dpts[i][0], dpts[i][1], 1.2, "F");
      doc.setFontSize(8);
      doc.setTextColor(GREEN_DARK);
      doc.text(b.value ? b.value.toFixed(1) : "—", dpts[i][0], dpts[i][1] - 2.5, { align: "center" });
    });
  }


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

const FAIXAS_ORDER = ["1-20", "21-40", "41-60", "61-80", "81-100", "101-120", "121+"] as const;
const FAIXA_LABELS: Record<string, string> = {
  "1-20": "1-20", "21-40": "21-40", "41-60": "41-60", "61-80": "61-80",
  "81-100": "81-100", "101-120": "101-120", "121+": "121>>",
};

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(GREEN_DARK);
  doc.rect(15, y, 3, 10, "F");
  doc.setTextColor(GREEN_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title.toUpperCase(), 21, y + 7);
  return y + 16;
}

function drawOcupacaoTable(
  doc: jsPDF, y: number, currais: number | null, animais: number | null,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const w = pageW - 30;
  const rowH = 9;
  const headerH = 8;
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  // header
  doc.setFillColor("#F3F1E8");
  doc.rect(15, y, w, headerH, "F");
  doc.setTextColor(GREEN_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Indicador", 18, y + 5.6);
  doc.text("Quantidade", pageW - 18, y + 5.6, { align: "right" });
  doc.rect(15, y, w, headerH, "S");
  let ry = y + headerH;
  const rows: [string, string][] = [];
  if (currais != null) rows.push(["Currais Ocupados", String(currais)]);
  if (animais != null) rows.push(["Animais Ativos", String(animais)]);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(INK);
  doc.setFontSize(9.5);
  for (const [label, val] of rows) {
    doc.rect(15, ry, w, rowH, "S");
    doc.text(label, 18, ry + 6);
    doc.setFont("helvetica", "bold");
    doc.text(val, pageW - 18, ry + 6, { align: "right" });
    doc.setFont("helvetica", "normal");
    ry += rowH;
  }
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "italic");
  doc.text("Tabela 1 — Ocupação da Estrutura", 15, ry + 5);
  return ry + 10;
}

function drawBarsChart(
  doc: jsPDF,
  y: number,
  bars: { label: string; value: number; display: string }[],
  color: string,
  yAxisLabel: string,
  xAxisLabel: string,
  caption: string,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const chartX = 28;
  const chartY = y + 6;
  const chartW = pageW - 15 - chartX;
  const chartH = 90;

  const maxV = Math.max(1, ...bars.map(b => b.value));
  // "nice" upper bound
  const niceMax = (() => {
    const raw = maxV * 1.15;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = Math.ceil(raw / mag) * mag;
    return n || 1;
  })();

  // Y-axis label (rotated)
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "normal");
  doc.text(yAxisLabel, 12, chartY + chartH / 2, { align: "center", angle: 90 } as any);

  // grid + Y labels
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.3);
  const steps = 5;
  for (let n = 0; n <= steps; n++) {
    const gy = chartY + chartH - (chartH * n) / steps;
    doc.line(chartX, gy, chartX + chartW, gy);
    const val = (niceMax * n) / steps;
    const txt = niceMax >= 10 ? String(Math.round(val)) : val.toFixed(1).replace(".", ",");
    doc.setFontSize(7);
    doc.setTextColor(INK_SOFT);
    doc.text(txt, chartX - 2, gy + 1.2, { align: "right" });
  }

  // Bars
  const gap = 4;
  const barW = (chartW - gap * (bars.length + 1)) / bars.length;
  bars.forEach((b, i) => {
    const bx = chartX + gap + i * (barW + gap);
    const bh = (chartH * b.value) / niceMax;
    const by = chartY + chartH - bh;
    doc.setFillColor(color);
    doc.rect(bx, by, barW, bh, "F");
    if (b.value > 0) {
      doc.setFontSize(8);
      doc.setTextColor(INK);
      doc.setFont("helvetica", "bold");
      doc.text(b.display, bx + barW / 2, by - 1.5, { align: "center" });
    }
    doc.setFontSize(7.5);
    doc.setTextColor(INK);
    doc.setFont("helvetica", "normal");
    doc.text(b.label, bx + barW / 2, chartY + chartH + 5, { align: "center" });
  });

  // X-axis label
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "italic");
  doc.text(xAxisLabel, chartX + chartW / 2, chartY + chartH + 11, { align: "center" });

  // Caption
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(INK_SOFT);
  doc.text(caption, pageW / 2, chartY + chartH + 20, { align: "center" });

  return chartY + chartH + 26;
}


export async function generateConfinamentoPdf(data: ConfinamentoPdfData): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const photoLinks = new PhotoLinkCollector();
  setActivePhotoLinks(photoLinks);
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
    ...((data.pennState || []).flatMap(a => a.fotos.slice(0, 5))),
  ];
  Object.assign(fotosCache, await prefetchFotosDataUrls(BUCKET_FOTOS, allFotos));

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

  const numeroMap = data.numeroMap || {};

  // ------- Helpers de fluxo contínuo -------
  const slimHeader = (): number => {
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(data.fazenda.nome_fazenda || "", 15, 12);
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.4);
    doc.line(15, 16, pageW - 15, 16);
    return 24;
  };
  const ensureRoom = (currentY: number, needed: number): number => {
    if (currentY + needed <= pageH - 20) return currentY;
    doc.addPage();
    return slimHeader();
  };

  // Mede altura de um bloco de tópico (título + texto + linha de fotos).
  const measureTopicoBlock = (t: typeof allT[number], includeTitle = true): number => {
    const w = pageW - 30;
    let h = 0;
    const txt = (t.texto || "").trim();
    if (txt) {
      if (includeTitle) h += 15; // barra + título
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(txt, w);
      h += lines.length * 4.8 + 4;
    }
    if (t.fotos.length > 0) {
      const cols = 5;
      const gapF = 2;
      const fw = (w - (cols - 1) * gapF) / cols;
      h += fw + 8;
    }
    return h;
  };

  // Desenha grid de fotos do tópico com selos numerados.
  const drawTopicoFotosAt = (t: typeof allT[number], startY: number): number => {
    if (t.fotos.length === 0) return startY;
    const wArea = pageW - 30;
    const cols = 5;
    const gapF = 2;
    const fw = (wArea - (cols - 1) * gapF) / cols;
    const fh = fw;
    const nF = Math.min(t.fotos.length, cols);
    for (let i = 0; i < nF; i++) {
      const fx = 15 + i * (fw + gapF);
      const foto = t.fotos[i];
      const dataUrl = fotosCache[foto.id];
      if (dataUrl) {
        try { const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
          doc.addImage(dataUrl, fmt, fx, startY, fw, fh, undefined, "FAST"); }
        catch { doc.setDrawColor(LINE); doc.rect(fx, startY, fw, fh); }
      } else { doc.setFillColor("#F3F1E8"); doc.rect(fx, startY, fw, fh, "F"); }
      const num = numeroMap[foto.id];
      if (num != null) drawNumeroBadge(doc, fx + 1.5, startY + 1.5, num);
    }
    return startY + fh + 6;
  };

  // Renderiza um tópico como bloco atômico (título+texto+fotos juntos na mesma página).
  const renderTopicoAtomic = (t: typeof allT[number], y: number, useIntroStyle: boolean): number => {
    const txt = (t.texto || "").trim();
    if (!txt && t.fotos.length === 0) return y;
    const h = measureTopicoBlock(t);
    y = ensureRoom(y, h);
    if (txt) {
      y = useIntroStyle
        ? drawIntroBlock(doc, t.titulo.trim() || " ", txt, y)
        : drawTextBlock(doc, t.titulo.trim() || " ", txt, y) + 4;
    }
    if (t.fotos.length > 0) y = drawTopicoFotosAt(t, y + 2);
    return y + 2;
  };

  // PAGE 1 — cover claro
  drawCoverHeader(doc, logoDefault, "Visita Técnica - Confinamento", logos);
  let y = drawFarmBlock(doc, data, 50);

  // INTRODUÇÃO — tópicos (fluxo contínuo a partir da capa)
  for (const t of introT) {
    y = renderTopicoAtomic(t, y, true);
  }
  // Legacy fallback só quando não existir tópico de introdução.
  if (introT.length === 0) {
    const intros: [string, string | null | undefined][] = [
      ["Objetivo da Visita", data.objetivo_visita],
      ["Resumo Executivo", data.resumo_executivo],
      ["Indicadores Gerais", data.indicadores_gerais],
    ];
    for (const [title, txt] of intros) {
      const tt = (txt || "").trim();
      if (!tt) continue;
      // altura estimada
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      const lines = doc.splitTextToSize(tt, pageW - 30);
      const h = 15 + lines.length * 4.8 + 4;
      y = ensureRoom(y, h);
      y = drawIntroBlock(doc, title, tt, y);
    }
  }

  // CURRAIS — fluxo contínuo, bloco atômico de 118mm.
  // Dimensionado para caber 2 currais por página (6+118+6+118=248 ≤ 253mm úteis).
  const blockH = 118;
  const gap = 6;
  const scaleH = 6;
  let scaleShown = false;
  const showScaleInline = () => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(INK_SOFT);
    doc.text(SCORE_SCALE_HINT, 15, y);
    y += scaleH;
  };
  for (const c of data.currais) {
    const need = blockH + (scaleShown ? 0 : scaleH);
    // se não couber, abre nova página com header slim
    if (y + need > pageH - 20) {
      doc.addPage();
      y = slimHeader();
      scaleShown = false;
    }
    if (!scaleShown) { showScaleInline(); scaleShown = true; }
    await drawCurralBlock(doc, c, fotosCache, 15, y, pageW - 30, blockH, numeroMap);
    y += blockH + gap;
  }

  // DESENVOLVIMENTO — tópicos após currais, fluxo contínuo (sem quebra forçada)
  for (const t of devT) {
    y = renderTopicoAtomic(t, y, false);
  }

  // ANÁLISE PENN STATE — omitida quando não há análises. Usa o mesmo fluxo
  // contínuo/atômico (ensureRoom) dos demais blocos, sem paginação própria.
  const analises = [...(data.pennState || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  if (analises.length > 0) {
    const wArea = pageW - 30;
    const colsF = 5;
    const gapF = 2;
    const fwF = (wArea - (colsF - 1) * gapF) / colsF;
    const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

    const measureAnalise = (a: typeof analises[number]) => {
      let h = analises.length > 1 ? 12 : 0; // título da subseção (só com múltiplas)
      h += 4 * 5; // 4 frações
      h += 8; // fef
      if (a.peNDF != null) h += 9;
      if (a.fotos.length > 0) h += fwF + 6;
      if ((a.aviso_divergencia || "").trim()) h += 6;
      return h + 4;
    };

    const drawAnalise = (a: typeof analises[number], startY: number): number => {
      let ay = startY;
      // Com uma única análise o título da seção já identifica o bloco.
      if (analises.length > 1) {
        doc.setFillColor(GREEN_DARK);
        doc.rect(15, ay, 3, 8, "F");
        doc.setTextColor(GREEN_DARK);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(`Análise Penn State — ${a.nome}`, 21, ay + 6);
        ay += 12;
      }

      doc.setFontSize(9.5);
      const linhas: [string, number][] = [
        ["Peneira Superior", a.percentual_19mm], ["Peneira Intermediária", a.percentual_8mm],
        ["Peneira Inferior", a.percentual_4mm], ["Fundo (Bandeja)", a.percentual_fundo],
      ];
      for (const [label, v] of linhas) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(INK_SOFT);
        doc.text(label, 21, ay + 3.4);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(INK);
        doc.text(pct(v), pageW - 15, ay + 3.4, { align: "right" });
        ay += 5;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(GREEN_DARK);
      doc.text(`fef: ${pct(a.fef)}`, 21, ay + 4);
      ay += 8;

      if (a.peNDF != null) {
        doc.setFontSize(10);
        doc.setTextColor(INK);
        doc.text(`peNDF: ${pct(a.peNDF)}`, 21, ay + 3.5);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(INK_SOFT);
        doc.text("FDN fisicamente efetiva", 21, ay + 7.5);
        ay += 9;
      }

      if (a.fotos.length > 0) {
        const nF = Math.min(a.fotos.length, colsF);
        for (let i = 0; i < nF; i++) {
          const fx = 15 + i * (fwF + gapF);
          const foto = a.fotos[i];
          const dataUrl = fotosCache[foto.id];
          if (dataUrl) {
            try {
              const fmtImg = dataUrl.includes("image/png") ? "PNG" : "JPEG";
              doc.addImage(dataUrl, fmtImg, fx, ay, fwF, fwF, undefined, "FAST");
            } catch { doc.setDrawColor(LINE); doc.rect(fx, ay, fwF, fwF); }
          } else { doc.setFillColor("#F3F1E8"); doc.rect(fx, ay, fwF, fwF, "F"); }
          const num = numeroMap[foto.id];
          if (num != null) drawNumeroBadge(doc, fx + 1.5, ay + 1.5, num);
        }
        ay += fwF + 6;
      }

      const aviso = (a.aviso_divergencia || "").trim();
      if (aviso) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(INK_SOFT);
        doc.text(aviso, 21, ay + 3);
        ay += 6;
      }
      return ay + 4;
    };

    // Bloco atômico: o título da seção nunca fica sozinho no fim da página —
    // ele reserva espaço junto com a primeira subseção.
    y = ensureRoom(y, 16 + measureAnalise(analises[0]));
    y = drawSectionTitle(doc, "Análise Penn State", y);
    for (const a of analises) {
      y = ensureRoom(y, measureAnalise(a));
      y = drawAnalise(a, y);
    }

    // Comparação entre pontos (bloco atômico) — só com 2+ análises.
    if (analises.length > 1) {
      const temPeNDF = analises.some(a => a.peNDF != null);
      const rowH = 5.5;
      const tableH = 12 + 7 + analises.length * rowH + 8;
      y = ensureRoom(y, tableH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(GREEN_DARK);
      doc.text("Comparação entre Pontos", 15, y + 4);
      y += 8;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(INK_SOFT);
      doc.text(
        "Compare a distribuição entre os pontos coletados para avaliar a uniformidade da mistura ao longo da distribuição do cocho.",
        15, y + 3, { maxWidth: pageW - 30 },
      );
      y += 8;

      const headers = ["Ponto", "Sup.", "Interm.", "Inf.", "Fundo (Bandeja)", "fef", ...(temPeNDF ? ["peNDF"] : [])];
      const nCols = headers.length;
      const firstW = 40;
      const otherW = (pageW - 30 - firstW) / (nCols - 1);
      const colX = (i: number) => 15 + (i === 0 ? 0 : firstW + (i - 1) * otherW);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(INK_SOFT);
      headers.forEach((h, i) => {
        if (i === 0) doc.text(h, colX(0) + 1, y + 4);
        else doc.text(h, colX(i) + otherW - 1, y + 4, { align: "right" });
      });
      y += 6;
      doc.setDrawColor(LINE);
      doc.setLineWidth(0.3);
      doc.line(15, y, pageW - 15, y);

      doc.setFontSize(8.5);
      for (const a of analises) {
        y += rowH;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(INK);
        doc.text(a.nome || "-", colX(0) + 1, y, { maxWidth: firstW - 2 });
        doc.setFont("helvetica", "normal");
        const cells = [
          pct(a.percentual_19mm), pct(a.percentual_8mm), pct(a.percentual_4mm),
          pct(a.percentual_fundo), pct(a.fef),
          ...(temPeNDF ? [a.peNDF != null ? pct(a.peNDF) : "—"] : []),
        ];
        cells.forEach((c, i) => doc.text(c, colX(i + 1) + otherW - 1, y, { align: "right" }));
      }
      y += 8;
    }
  }

  // INDICADORES ZOOTÉCNICOS — só se algum campo estiver preenchido
  const iz = data.indicadoresZootecnicos;
  const izInd = iz?.indicador || null;
  const izFaixas = (iz?.faixas || []).slice().sort((a, b) => a.ordem - b.ordem);
  const hasOcup = !!izInd && (izInd.currais_ocupados != null || izInd.animais_ativos != null);
  const faixasQtd = izFaixas.filter(f => f.quantidade_animais != null && (f.quantidade_animais as number) >= 0);
  const faixasCons = izFaixas.filter(f => f.consumo_medio_pv != null);
  const hasIndicadores = hasOcup || faixasQtd.length > 0 || faixasCons.length > 0;
  if (hasIndicadores) {
    doc.addPage();
    let iy = slimHeader() + 2;
    iy = drawSectionTitle(doc, "Indicadores Zootécnicos", iy);
    if (hasOcup) {
      iy = ensureRoom(iy, 40);
      iy = drawOcupacaoTable(doc, iy, izInd!.currais_ocupados, izInd!.animais_ativos);
    }
    if (faixasQtd.length > 0) {
      iy = ensureRoom(iy, 130);
      const bars = FAIXAS_ORDER.map(k => {
        const found = faixasQtd.find(f => f.faixa === k);
        const v = found ? Number(found.quantidade_animais) : 0;
        return { label: FAIXA_LABELS[k], value: v, display: v ? String(v) : "" };
      }).filter(b => b.value > 0);
      iy = drawBarsChart(
        doc, iy, bars, "#3B3B3B",
        "Quantidade de animais",
        "Dias de Confinamento",
        "Gráfico 1 – Distribuição do quantitativo de animais por tempo de confinamento",
      );
    }
    if (faixasCons.length > 0) {
      iy = ensureRoom(iy, 130);
      const bars = FAIXAS_ORDER.map(k => {
        const found = faixasCons.find(f => f.faixa === k);
        const v = found ? Number(found.consumo_medio_pv) : 0;
        return {
          label: FAIXA_LABELS[k],
          value: v,
          display: v ? v.toFixed(2).replace(".", ",") : "",
        };
      }).filter(b => b.value > 0);
      iy = drawBarsChart(
        doc, iy, bars, "#1F7A4D",
        "Consumo médio, últ. 5 dias %PV",
        "Dias de Confinamento x Consumo",
        "Gráfico 2 – Consumo segmentado por Confinamento",
      );
    }
  }

  // Gráficos — sempre em página nova
  doc.addPage();
  drawChartPage(doc, data);
  const series = {
    fezes: data.currais.flatMap(c => c.samples?.fezes || []),
    corporal: data.currais.flatMap(c => c.samples?.corporal || []),
    bebedouro: data.currais.flatMap(c => c.samples?.bebedouro || []),
  };
  drawAllSampleChartPages(doc, data.fazenda.nome_fazenda || "", series, data.sampleChartTypes);

  // Escore de fezes: um gráfico de linha por categoria de dieta distinta.
  const fezesGroups: { categoria: string; samples: number[] }[] = [];
  for (const c of data.currais) {
    const cat = (c.dieta_categoria || "").trim() || "Sem categoria";
    const vals = (c.samples?.fezes || []).filter(n => Number.isFinite(n) && n > 0);
    if (vals.length === 0) continue;
    const g = fezesGroups.find(x => x.categoria.toLowerCase() === cat.toLowerCase());
    if (g) g.samples.push(...vals);
    else fezesGroups.push({ categoria: cat, samples: [...vals] });
  }
  drawFezesCategoriaChartPages(
    doc, data.fazenda.nome_fazenda || "", fezesGroups, data.sampleChartTypes?.fezes || "lines",
  );

  // SEÇÃO FINAL (Observações e Recomendações) — só renderiza se houver conteúdo.
  const hasConclusaoTopicos = conclusaoT.some(t => (t.texto || "").trim() || t.fotos.length > 0);
  const obs = (data.observacoes_gerais || "").trim();
  const conc = (data.conclusao || "").trim();
  const hasLegacy = introT.length === 0 && conclusaoT.length === 0 && (obs || conc);
  if (hasConclusaoTopicos || hasLegacy) {
    doc.addPage();
    let fy = slimHeader() + 2;
    const tituloEnc = (data.titulo_encerramento || "Observações e Recomendações").trim() || "Observações e Recomendações";
    doc.setFillColor(GREEN_DARK);
    doc.rect(15, fy, 3, 10, "F");
    doc.setTextColor(GREEN_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(tituloEnc.toUpperCase(), 21, fy + 7);
    fy += 16;

    if (hasConclusaoTopicos) {
      for (const t of conclusaoT) {
        fy = renderTopicoAtomic(t, fy, false);
      }
    } else {
      if (obs) fy = drawTextBlock(doc, "Observações Gerais", obs, fy) + 8;
      if (conc) drawTextBlock(doc, "Conclusão da Visita", conc, fy);
    }
  }


  drawAssinaturas(doc, pageW, pageH, data.assinantes, data.consultor.nome);

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, p, total);
  }

  photoLinks.apply(doc);
  setActivePhotoLinks(null);
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
