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
  categoria?: string | null;
  peso_medio_kg?: number | null;
  consumo_esperado_kg?: number | null;
  consumo_real_kg?: number | null;
  observacao: string | null;
  scores: { fezes?: number; corporal?: number; bebedouro?: number };
  samples?: { fezes: number[]; corporal: number[]; bebedouro: number[] };
  fotos: { id: string; url: string; ordem: number }[];
}

export interface VisitaPdfData {
  visitaId: string;
  fazenda: { nome_fazenda: string; proprietario?: string | null; responsavel?: string | null; municipio?: string | null; uf?: string | null };
  consultor: { nome: string };
  hora_inicio: string;
  hora_fim: string | null;
  observacoes_gerais: string | null;
  conclusao: string | null;
  objetivo_visita?: string | null;
  resumo_executivo?: string | null;
  indicadores_gerais?: string | null;
  indicadores_tabela?: { key: string; label: string; value: string }[];
  topicos?: { id: string; titulo: string; texto: string | null; ordem: number; zona?: "introducao" | "desenvolvimento" | "conclusao";
    fotos: { id: string; url: string; ordem: number; signedUrl?: string }[] }[];
  pastos: VisitaPdfPasto[];
  assinantes?: { nome: string; cargo_funcao: string }[];
  logoOverride?: { esquerdaPath: string | null; direitaPath: string | null } | null;
}

async function compressImageBlob(blob: Blob, maxDim = 1280, quality = 0.72): Promise<string> {
  const bitmapUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = bitmapUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no ctx");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
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
    return await compressImageBlob(blob);
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

const BUCKET_LOGOS = "logos-consultor";
export type LogoAsset = { dataUrl: string; w: number; h: number } | null;

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
    const size = await measureImage(dataUrl);
    return { dataUrl, w: size.w, h: size.h };
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
  // REGRA ÚNICA: escalar SEMPRE pela mesma altura de referência (boxH), sem
  // clamp por largura. Assim, ambas as logos (esquerda e direita) terminam
  // visualmente com a MESMA altura, independentemente da proporção original.
  // A largura é calculada proporcionalmente a partir dessa altura.
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
  const headerH = 32;
  const logoH = 16;
  const logoW = 60; // caixa mais generosa para permitir que ambas as logos usem a mesma altura
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
  doc.line(15, headerH + 4, w - 15, headerH + 4);
}

function drawFarmBlock(doc: jsPDF, data: VisitaPdfData, y: number): number {
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
  metaY += 6;
  return metaY;
}

/**
 * Renderiza texto respeitando quebras de linha manuais do usuário.
 * Cada parágrafo (separado por \n) é justificado, exceto a última linha
 * (norma ABNT). Linhas curtas ou únicas ficam alinhadas à esquerda para
 * evitar espaçamentos gigantes entre palavras.
 */
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
  const sub = [
    pasto.categoria || null,
    `${pasto.qtd_animais ?? "—"} animais`,
    pasto.peso_medio_kg ? `${pasto.peso_medio_kg} kg/cab` : null,
  ].filter(Boolean).join(" · ");
  doc.text(sub, x + 20, y + 13);

  doc.setDrawColor(LINE);
  doc.line(x + 3, y + 18, x + width - 3, y + 18);

  const real = pasto.consumo_real_kg ?? pasto.consumo_kg_dia ?? 0;
  const esp = pasto.consumo_esperado_kg ?? 0;
  const indice = real > 0 && esp > 0 ? (real / esp) * 100 : 0;
  const pesoVivoTotal = (pasto.qtd_animais || 0) * (pasto.peso_medio_kg || 0);

  const lineY = y + 24;
  const cellW = (width - 6) / 3;
  const cells = [
    { label: "PRODUTO", value: pasto.tipo_produto ? (PRODUTO_LABEL[pasto.tipo_produto] || pasto.tipo_produto) : "—" },
    { label: "% PV", value: pasto.percentual_pv || "—" },
    { label: "PESO VIVO TOTAL", value: pesoVivoTotal > 0 ? `${pesoVivoTotal.toLocaleString("pt-BR")} kg` : "—" },
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

  const lineY2 = y + 34;
  const cells2 = [
    { label: "CONSUMO ESPERADO", value: esp > 0 ? `${esp.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg/dia` : "—" },
    { label: "CONSUMO REAL", value: real > 0 ? `${real.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg/dia` : "—" },
    { label: "ÍNDICE / META", value: indice > 0 ? `${indice.toFixed(1)}%` : "—" },
  ];
  cells2.forEach((c, i) => {
    const cx = x + 3 + i * cellW;
    doc.setFontSize(6.5);
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "bold");
    doc.text(c.label, cx, lineY2);
    doc.setFontSize(9);
    doc.setTextColor(INK);
    doc.setFont("helvetica", "bold");
    doc.text(c.value, cx, lineY2 + 5);
  });

  const scoreY = y + 44;
  const scoreCellW = (width - 6) / 3;
  const scores: [string, string, number | undefined][] = [
    ["Fezes", "fezes", pasto.scores.fezes],
    ["Corporal", "corporal", pasto.scores.corporal],
    ["Bebedouro", "bebedouro", pasto.scores.bebedouro],
  ];
  scores.forEach(([label, key, nota], i) => {
    const cx = x + 3 + i * scoreCellW;
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(INK_SOFT);
    doc.text(label.toUpperCase(), cx, scoreY);
    // Indicador único (círculo dourado + N/5) em vez das 5 opções.
    const notaNum = nota != null ? Math.round(nota * 10) / 10 : null;
    const dotY = scoreY + 4;
    doc.setFillColor(notaNum ? GOLD : "#E7E3D6");
    doc.circle(cx + 2, dotY, 1.8, "F");
    doc.setFontSize(9);
    doc.setTextColor(notaNum ? GREEN_DARK : INK_SOFT);
    doc.setFont("helvetica", "bold");
    doc.text(notaNum ? `${notaNum}/5` : "—", cx + 6, dotY + 1.2);
    // Legenda curta abaixo, quebrando em até 2 linhas.
    doc.setFontSize(5.6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(INK_SOFT);
    const legend = getScoreDescription(key);
    const legLines = doc.splitTextToSize(legend, scoreCellW - 4);
    doc.text(legLines.slice(0, 2), cx, dotY + 4.8);
  });
  // A escala 1-5 é impressa uma única vez no rodapé da página de pastos, não por card.

  if (pasto.observacao) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(INK_SOFT);
    doc.text("OBSERVAÇÃO", x + 3, y + 58);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(INK);
    const lines = doc.splitTextToSize(pasto.observacao, width - 6);
    doc.text(lines.slice(0, 2), x + 3, y + 63);
  }

  const fotosStartY = y + 72;
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
  return drawParagraphText(doc, text || "—", x, y + 15, w, 4.8);
}

export async function generateVisitaPdf(data: VisitaPdfData): Promise<{ blob: Blob; fileName: string }> {
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
  const allFotos = data.pastos.flatMap(p => p.fotos.slice(0, 5));
  const allTopicoFotos = (data.topicos || []).flatMap(t => t.fotos.slice(0, 5));
  await Promise.all([
    ...allFotos.map(async f => { fotosCache[f.id] = await fetchFotoDataUrl(f.url); }),
    ...allTopicoFotos.map(async f => { fotosCache[f.id] = await fetchFotoDataUrl(f.url); }),
  ]);

  // PAGE 1 — cover header claro + fazenda + intro blocks
  drawCoverHeader(doc, logoDefault, "Visita Técnica - Rotina", logos);
  let y = drawFarmBlock(doc, data, 50);

  const drawTabela = () => {
    const tabela = (data.indicadores_tabela || []).filter(r => (r.value || "").trim() && r.value !== "—");
    if (!tabela.length) return;
    if (y > pageH - (14 + tabela.length * 7)) { doc.addPage(); y = 20; }
    doc.setFillColor(GREEN_DARK);
    doc.rect(15, y, 2.5, 6, "F");
    doc.setTextColor(GREEN_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("INDICADORES GERAIS DA FAZENDA", 20, y + 4.5);
    y += 10;
    const wTable = pageW - 30;
    const labelW = wTable * 0.55;
    const rowH = 7;
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.3);
    tabela.forEach((r, i) => {
      if (i % 2 === 0) { doc.setFillColor("#FAF8F0"); doc.rect(15, y, wTable, rowH, "F"); }
      doc.setTextColor(INK);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(r.label, 18, y + 4.8);
      doc.setFont("helvetica", "bold");
      const lines = doc.splitTextToSize(r.value, wTable - labelW - 6);
      doc.text(lines[0] || "—", 15 + labelW, y + 4.8);
      doc.line(15, y + rowH, 15 + wTable, y + rowH);
      y += rowH;
    });
    y += 6;
  };

  const drawTopico = (titulo: string, texto: string | null, fotos: { id: string; ordem: number }[]) => {
    const t = (texto || "").trim();
    if (!t && fotos.length === 0) return;
    if (y > pageH - 60) { doc.addPage(); y = 20; }
    if (t) {
      y = drawIntroBlock(doc, titulo.trim() || " ", t, y);
    }
    if (fotos.length > 0) {
      const wArea = pageW - 30;
      const cols = 5;
      const gap = 2;
      const fw = (wArea - (cols - 1) * gap) / cols;
      const fh = fw;
      if (y + fh > pageH - 20) { doc.addPage(); y = 20; }
      for (let i = 0; i < Math.min(fotos.length, cols); i++) {
        const fx = 15 + i * (fw + gap);
        const foto = fotos[i];
        const dataUrl = fotosCache[foto.id];
        if (dataUrl) {
          try {
            const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
            doc.addImage(dataUrl, fmt, fx, y, fw, fh, undefined, "FAST");
          } catch {
            doc.setDrawColor(LINE); doc.rect(fx, y, fw, fh);
          }
        } else {
          doc.setFillColor("#F3F1E8"); doc.rect(fx, y, fw, fh, "F");
        }
      }
      y += fh + 6;
    } else {
      y += 2;
    }
  };

  const sortedAll = [...(data.topicos || [])].sort((a, b) => a.ordem - b.ordem);
  const zonaOf = (t: typeof sortedAll[number]): "introducao" | "desenvolvimento" | "conclusao" => {
    if (t.zona) return t.zona;
    if (t.ordem >= 1001) return "conclusao";
    if (t.ordem >= 5 && t.ordem <= 1000) return "desenvolvimento";
    return "introducao";
  };
  const introTopicos = sortedAll.filter(t => zonaOf(t) === "introducao");
  const devTopicos = sortedAll.filter(t => zonaOf(t) === "desenvolvimento");
  const conclusaoTopicos = sortedAll.filter(t => zonaOf(t) === "conclusao");

  for (const t of introTopicos) drawTopico(t.titulo, t.texto, t.fotos);
  // Legacy fallback: campos antigos como intro se não houver tópico de intro.
  if (introTopicos.length === 0) {
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
  drawTabela();



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

    // Escala de scores impressa UMA VEZ por página de pastos (rodapé do cabeçalho).
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(INK_SOFT);
    doc.text(SCORE_SCALE_HINT, pageW - 15, 20, { align: "right" });

    let py = 24;
    for (const p of pair) {
      await drawPastoBlock(doc, p, fotosCache, 15, py, pageW - 30, blockHeight);
      py += blockHeight + gap;
    }
  }

  // Line charts — amostras individuais por tipo (uma página por gráfico com dados)
  drawAllSampleChartPages(doc, data.fazenda.nome_fazenda || "", {
    fezes: data.pastos.flatMap(p => p.samples?.fezes || []),
    corporal: data.pastos.flatMap(p => p.samples?.corporal || []),
    bebedouro: data.pastos.flatMap(p => p.samples?.bebedouro || []),
  });

  // DESENVOLVIMENTO — tópicos após pastos, em novas páginas
  if (devTopicos.length > 0) {
    doc.addPage();
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(data.fazenda.nome_fazenda || "", 15, 12);
    doc.setDrawColor(LINE);
    doc.line(15, 16, pageW - 15, 16);
    y = 24;
    for (const t of devTopicos) drawTopico(t.titulo, t.texto, t.fotos);
  }

  // ÚLTIMA PÁGINA: conclusão + assinatura
  doc.addPage();
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(data.fazenda.nome_fazenda || "", 15, 12);
  doc.setDrawColor(LINE);
  doc.line(15, 16, pageW - 15, 16);

  let fy = 26;
  if (conclusaoTopicos.length > 0) {
    for (const t of conclusaoTopicos) {
      const txt = (t.texto || "").trim();
      if (!txt && t.fotos.length === 0) continue;
      if (fy > pageH - 80) { doc.addPage(); fy = 20; }
      if (txt) {
        fy = drawTextBlock(doc, t.titulo.trim() || " ", txt, fy);
      }
      if (t.fotos.length > 0) {
        const wArea = pageW - 30;
        const cols = 5;
        const gapF = 2;
        const fw = (wArea - (cols - 1) * gapF) / cols;
        const fh = fw;
        if (fy + fh > pageH - 60) { doc.addPage(); fy = 20; }
        fy += 4;
        for (let i = 0; i < Math.min(t.fotos.length, cols); i++) {
          const fx = 15 + i * (fw + gapF);
          const dataUrl = fotosCache[t.fotos[i].id];
          if (dataUrl) {
            try {
              const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
              doc.addImage(dataUrl, fmt, fx, fy, fw, fh, undefined, "FAST");
            } catch { doc.setDrawColor(LINE); doc.rect(fx, fy, fw, fh); }
          } else { doc.setFillColor("#F3F1E8"); doc.rect(fx, fy, fw, fh, "F"); }
        }
        fy += fh + 6;
      }
      fy += 6;
    }
  } else {
    const obs = (data.observacoes_gerais || "").trim();
    const conc = (data.conclusao || "").trim();
    if (obs) {
      fy = drawTextBlock(doc, "Observações Gerais", obs, fy);
      fy = Math.max(fy + 8, 130);
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
  const fileName = `visita-${safeName}-${stamp}.pdf`;
  return { blob, fileName };
}

export async function uploadVisitaPdf(
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

// ============================================================================
// FÁBRICA — template isolado (Round 8, PDF novo)
// ============================================================================

export interface VisitaFabricaPdfData {
  visitaId: string;
  fazenda: { nome_fazenda: string; proprietario?: string | null; responsavel?: string | null; municipio?: string | null; uf?: string | null };
  consultor: { nome: string };
  hora_inicio: string;
  hora_fim: string | null;
  quesitos: { chave: string; rotulo: string; nota: number | null }[];
  topicos: { id: string; titulo: string; texto: string | null; ordem: number; zona?: "introducao" | "desenvolvimento" | "conclusao";
    fotos: { id: string; url: string; ordem: number }[] }[];
  numeroMap?: Record<string, number>;
  assinantes?: { nome: string; cargo_funcao: string }[];
  logoOverride?: { esquerdaPath: string | null; direitaPath: string | null } | null;
}

function drawNumeroBadge(doc: jsPDF, x: number, y: number, n: number) {
  const r = 3.4;
  doc.setFillColor(GREEN_DARK);
  doc.circle(x + r, y + r, r, "F");
  doc.setTextColor(GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(String(n), x + r, y + r, { align: "center", baseline: "middle" });
}

export async function generateFabricaPdf(data: VisitaFabricaPdfData): Promise<{ blob: Blob; fileName: string }> {
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
  const allFotos = (data.topicos || []).flatMap(t => t.fotos.slice(0, 5));
  await Promise.all(allFotos.map(async f => { fotosCache[f.id] = await fetchFotoDataUrl(f.url); }));

  // PAGE 1
  drawCoverHeader(doc, logoDefault, "Visita Técnica - Fábrica", logos);
  let y = drawFarmBlock(doc, {
    fazenda: data.fazenda, consultor: data.consultor,
    hora_inicio: data.hora_inicio, hora_fim: data.hora_fim,
    visitaId: data.visitaId, observacoes_gerais: null, conclusao: null, pastos: [],
  } as VisitaPdfData, 50);

  // Bloco Avaliação
  if (y > pageH - 70) { doc.addPage(); y = 20; }
  doc.setFillColor(GREEN_DARK);
  doc.rect(15, y, 2.5, 6, "F");
  doc.setTextColor(GREEN_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("AVALIAÇÃO DA FÁBRICA", 20, y + 4.5);
  y += 10;

  const wTable = pageW - 30;
  const rowH = 13;
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.3);
  const notaValida = data.quesitos.filter(q => q.nota != null);
  const media = notaValida.length
    ? notaValida.reduce((s, q) => s + (q.nota || 0), 0) / notaValida.length
    : 0;
  const notaColW = 20; // largura da coluna do indicador N/5 à direita
  const labelX = 18;
  const notaX = 15 + wTable - notaColW / 2;
  data.quesitos.forEach((q, i) => {
    if (i % 2 === 0) { doc.setFillColor("#FAF8F0"); doc.rect(15, y, wTable, rowH, "F"); }
    // Rótulo
    doc.setTextColor(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(q.rotulo, labelX, y + 5.4);
    // Legenda em cinza logo abaixo
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(INK_SOFT);
    const legend = getScoreDescription(q.chave);
    if (legend) {
      const legLines = doc.splitTextToSize(legend, wTable - notaColW - 8);
      doc.text(legLines.slice(0, 1), labelX, y + 10);
    }
    // Indicador único N/5 à direita
    const cy = y + rowH / 2;
    if (q.nota != null) {
      doc.setFillColor(GOLD);
      doc.circle(notaX - 6, cy, 2.2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(GREEN_DARK);
      doc.text(`${q.nota}/5`, notaX, cy + 1.4, { align: "center" });
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(INK_SOFT);
      doc.text("—", notaX, cy + 1.4, { align: "center" });
    }
    doc.setDrawColor(LINE);
    doc.line(15, y + rowH, 15 + wTable, y + rowH);
    y += rowH;
  });

  // Escala uma única vez, logo antes da média geral.
  y += 2;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(INK_SOFT);
  doc.text(SCORE_SCALE_HINT, 15, y);
  y += 5;

  if (notaValida.length) {
    doc.setTextColor(GREEN_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Média geral: ${media.toFixed(1)}/5  ·  ${notaValida.length}/${data.quesitos.length} quesitos avaliados`, 15, y);
    y += 8;
  } else {
    y += 6;
  }

  // Renderiza um tópico completo (título + texto + fotos), retorna novo y
  const renderTopico = (t: NonNullable<typeof data.topicos>[number], yStart: number): number => {
    let yy = yStart;
    const tx = (t.texto || "").trim();
    if (!t.titulo.trim() && !tx && t.fotos.length === 0) return yy;
    if (t.titulo.trim() || tx) {
      yy = drawIntroBlock(doc, t.titulo || "—", tx || "—", yy);
    }
    if (t.fotos.length > 0) {
      const wArea = pageW - 30;
      const cols = 5;
      const gap = 2;
      const fw = (wArea - (cols - 1) * gap) / cols;
      const fh = fw;
      for (let i = 0; i < Math.min(t.fotos.length, cols); i++) {
        const fx = 15 + i * (fw + gap);
        const foto = t.fotos[i];
        const dataUrl = fotosCache[foto.id];
        if (dataUrl) {
          try {
            const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
            doc.addImage(dataUrl, fmt, fx, yy, fw, fh, undefined, "FAST");
          } catch {
            doc.setDrawColor(LINE); doc.rect(fx, yy, fw, fh);
          }
        } else {
          doc.setFillColor("#F3F1E8"); doc.rect(fx, yy, fw, fh, "F");
        }
        const n = data.numeroMap?.[foto.id];
        if (n != null) drawNumeroBadge(doc, fx + 1.5, yy + 1.5, n);
      }
      yy += fh + 6;
    } else {
      yy += 2;
    }
    return yy;
  };

  // Paginação Fábrica:
  // Página 1 = header + Avaliação + 1º tópico
  // A partir da página 2 = 2 tópicos por página
  const allT = [...(data.topicos || [])].sort((a, b) => a.ordem - b.ordem)
    .filter(t => t.titulo.trim() || (t.texto || "").trim() || t.fotos.length > 0);
  const zonaOfF = (t: typeof allT[number]): "introducao" | "desenvolvimento" | "conclusao" => {
    if (t.zona) return t.zona;
    if (t.ordem >= 1001) return "conclusao";
    if (t.ordem >= 5 && t.ordem <= 1000) return "desenvolvimento";
    return "introducao";
  };
  const introT = allT.filter(t => zonaOfF(t) === "introducao");
  const devT = allT.filter(t => zonaOfF(t) === "desenvolvimento");
  const conclusaoT = allT.filter(t => zonaOfF(t) === "conclusao");

  const drawSlimHeader = () => {
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(data.fazenda.nome_fazenda || "", 15, 12);
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.4);
    doc.line(15, 16, pageW - 15, 16);
  };

  for (const t of introT) y = renderTopico(t, y);
  for (const group of [devT, conclusaoT]) {
    if (group.length === 0) continue;
    for (let i = 0; i < group.length; i += 2) {
      doc.addPage();
      drawSlimHeader();
      let py = 24;
      py = renderTopico(group[i], py);
      if (i + 1 < group.length) {
        py += 4;
        py = renderTopico(group[i + 1], py);
      }
    }
  }


  // Assinatura
  drawAssinaturas(doc, pageW, pageH, data.assinantes, data.consultor.nome);

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, p, total);
  }

  const blob = doc.output("blob");
  const stamp = format(new Date(), "yyyyMMdd-HHmm");
  const safeName = (data.fazenda.nome_fazenda || "fazenda").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const fileName = `fabrica-${safeName}-${stamp}.pdf`;
  return { blob, fileName };
}
