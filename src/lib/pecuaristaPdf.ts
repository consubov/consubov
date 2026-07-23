import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const GREEN = "#1F7A4D";
const INK = "#1C1C1A";
const INK_SOFT = "#767066";
const LINE = "#E7E3D6";

export interface PecuaristaPdfHeader {
  produtor: string;
  nomeEmpresa?: string | null;
  logoUrl?: string | null;
  fazenda: string;
  cidade?: string | null;
  lote: string;
  codigoLote: string;
  categoria: string;
  identificado: boolean;
  data: string;
}

export interface PecuaristaPesoIdentificado {
  numero: string;
  peso_kg: number;
  data: string;
  peso_anterior_kg?: number | null;
  data_anterior?: string | null;
  lote_anterior?: string | null;
  gmd_individual?: number | null;
  dias?: number | null;
}

export interface PecuaristaPesoSemId {
  ordem: number;
  peso_kg: number;
}

export interface PecuaristaPdfTotais {
  quantidade: number;
  peso_total: number;
  peso_medio: number;
  peso_medio_anterior?: number | null;
  data_anterior?: string | null;
  dias?: number | null;
  gmd?: number | null;
}

export interface PecuaristaPdfData {
  header: PecuaristaPdfHeader;
  totais: PecuaristaPdfTotais;
  identificados?: PecuaristaPesoIdentificado[];
  semId?: PecuaristaPesoSemId[];
}

function fmtN(v: number, d = 2) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtDate(iso: string) { try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; } }
function fmtDateTime(iso: string) { try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; } }

async function urlToJpeg(url: string, maxDim = 800, quality = 0.85) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    let { width, height } = bmp;
    if (width > maxDim || height > maxDim) {
      const s = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * s); height = Math.round(height * s);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d"); if (!ctx) return null;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bmp, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL("image/jpeg", quality), w: width, h: height };
  } catch { return null; }
}

function drawFirstHeader(
  doc: jsPDF,
  opts: { line1: string; line2?: string | null; subtitle: string },
  logo: { dataUrl: string; w: number; h: number } | null,
): number {
  const W = doc.internal.pageSize.getWidth();
  const topY = 12;
  const HEADER_H = 30;
  const stripeY = topY + HEADER_H;

  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(opts.line1 || "—", 15, topY + 7);

  if (opts.line2) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(INK);
    doc.text(opts.line2, 15, topY + 14);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(INK_SOFT);
  doc.text(opts.subtitle.toUpperCase(), 15, topY + (opts.line2 ? 21 : 14));

  if (logo) {
    const maxH = HEADER_H - 6;
    const maxW = 45;
    const ratio = logo.w / logo.h;
    let h = maxH; let w = h * ratio;
    if (w > maxW) { w = maxW; h = w / ratio; }
    const yLogo = topY + (HEADER_H - h) / 2;
    try { doc.addImage(logo.dataUrl, "JPEG", W - 15 - w, yLogo, w, h); } catch {}
  } else {
    // Fallback: marca "Mais Arrobas" como texto no canto direito
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(GREEN);
    doc.text("Mais Arrobas", W - 15, topY + 12, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(INK_SOFT);
    doc.text("consubov.com.br", W - 15, topY + 17, { align: "right" });
  }

  doc.setFillColor(GREEN);
  doc.rect(0, stripeY, W, 2.5, "F");
  return stripeY + 12;
}

function drawFooter(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor("#000000");
    doc.text(`Página ${p} de ${total}`, W - 15, H - 8, { align: "right" });
    doc.text("www.consubov.com.br", 15, H - 8);
    doc.text("Uma marca do grupo Consubov", 15, H - 12);
    doc.text("Mais Arrobas", 15, H - 16);
  }
}

export async function gerarPecuaristaLotePdf(data: PecuaristaPdfData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  const logo = data.header.logoUrl ? await urlToJpeg(data.header.logoUrl) : null;

  let y = drawFirstHeader(
    doc,
    {
      line1: data.header.fazenda || "—",
      line2: data.header.produtor || null,
      subtitle: "Relatório de pesagem",
    },
    logo,
  );

  // Info
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Informações da pesagem", 15, y);
  y += 6;

  const rows: [string, string][] = [
    ["Produtor:", data.header.produtor || "—"],
    ["Fazenda:", data.header.fazenda || "—"],
  ];
  if (data.header.cidade) rows.push(["Cidade:", data.header.cidade]);
  rows.push(
    ["Lote:", data.header.lote],
    ["Categoria:", data.header.categoria],
    ["Tipo de lote:", data.header.identificado ? "Identificado" : "Sem identificação"],
    ["Data:", fmtDateTime(data.header.data)],
  );

  doc.setFontSize(10);
  for (const [l, v] of rows) {
    doc.setFont("helvetica", "bold"); doc.setTextColor(INK);
    doc.text(l, 15, y);
    const lw = doc.getTextWidth(l);
    doc.setFont("helvetica", "normal");
    doc.text(String(v), 15 + lw + 2, y);
    y += 5.5;
  }

  y += 1;
  doc.setDrawColor(LINE); doc.setLineWidth(0.4);
  doc.line(15, y, W - 15, y);
  y += 6;

  // Totais card
  const t = data.totais;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(INK);
  doc.text("Resumo da rodada", 15, y);
  y += 5;
  const totRows: [string, string][] = [
    ["Animais pesados", String(t.quantidade)],
    ["Peso total", `${fmtN(t.peso_total, 2)} kg`],
    ["Peso médio", `${fmtN(t.peso_medio, 2)} kg`],
  ];
  if (t.peso_medio_anterior != null) {
    totRows.push(["Peso médio anterior", `${fmtN(t.peso_medio_anterior, 2)} kg`]);
    if (t.data_anterior) totRows.push(["Pesagem anterior", fmtDate(t.data_anterior)]);
    if (t.dias != null) totRows.push(["Dias entre pesagens", String(t.dias)]);
    if (t.gmd != null) totRows.push(["GMD do lote", `${fmtN(t.gmd, 3)} kg/dia`]);
  }
  autoTable(doc, {
    startY: y,
    body: totRows,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 2.5, textColor: INK, lineColor: LINE },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [247, 244, 234] as any, cellWidth: 70 },
      1: { halign: "right" },
    },
    margin: { left: 15, right: 15 },
  });
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 8;

  // Detalhe
  if (data.header.identificado && data.identificados && data.identificados.length > 0) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(INK);
    doc.text("Pesos por animal", 15, y);
    y += 2;
    const body = data.identificados.map((r) => [
      r.numero,
      `${fmtN(r.peso_kg, 1)} kg`,
      fmtDateTime(r.data),
      r.peso_anterior_kg != null ? `${fmtN(r.peso_anterior_kg, 1)} kg` : "—",
      r.data_anterior ? fmtDate(r.data_anterior) : "—",
      r.dias != null ? String(r.dias) : "—",
      r.gmd_individual != null ? `${fmtN(r.gmd_individual, 3)} kg/dia` : "—",
    ]);
    autoTable(doc, {
      startY: y + 2,
      head: [["Nº", "Peso", "Data/hora", "Anterior", "Data anterior", "Dias", "GMD"]],
      body,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, textColor: INK, lineColor: LINE },
      headStyles: { fillColor: [31, 122, 77] as any, textColor: 255, fontStyle: "bold" },
      margin: { left: 15, right: 15 },
    });
  } else if (!data.header.identificado && data.semId && data.semId.length > 0) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(INK);
    doc.text("Pesos registrados (peso vivo)", 15, y);
    y += 2;
    // Grid dinâmica em 5-6 colunas
    const attempts = [
      { cols: 4, rowH: 5.2, fontSize: 9 },
      { cols: 5, rowH: 4.8, fontSize: 8.5 },
      { cols: 6, rowH: 4.5, fontSize: 8 },
    ];
    const chosen = attempts[Math.min(attempts.length - 1, Math.floor(data.semId.length / 40))];
    const { cols, rowH, fontSize } = chosen;
    const colW = (W - 30) / cols;
    doc.setFont("helvetica", "normal"); doc.setFontSize(fontSize);
    y += 4;
    const rowsCount = Math.ceil(data.semId.length / cols);
    for (let r = 0; r < rowsCount; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= data.semId.length) break;
        const p = data.semId[idx];
        doc.text(`${p.ordem}. ${fmtN(p.peso_kg, 1)} kg`, 15 + c * colW, y);
      }
      y += rowH;
      if (y > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 20; }
    }
  }

  drawFooter(doc);
  return doc.output("blob");
}

// ============================================================
// APARTAÇÃO
// ============================================================

export interface ApartacaoDestinoSection {
  nome_lote: string;
  codigo?: string | null;
  identificado: boolean;
  quantidade: number;
  peso_total: number;
  peso_medio: number;
  peso_medio_anterior?: number | null;
  data_anterior?: string | null;
  dias?: number | null;
  gmd?: number | null;
  identificados?: PecuaristaPesoIdentificado[];
  semId?: PecuaristaPesoSemId[];
}

export interface ApartacaoPdfData {
  header: Omit<PecuaristaPdfHeader, "identificado"> & { identificado: boolean };
  totalGeral: { quantidade: number; peso_total: number };
  destinos: ApartacaoDestinoSection[];
}

export async function gerarPecuaristaApartacaoPdf(data: ApartacaoPdfData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const logo = data.header.logoUrl ? await urlToJpeg(data.header.logoUrl) : null;

  let y = drawFirstHeader(
    doc,
    {
      line1: data.header.fazenda || "—",
      line2: data.header.produtor || null,
      subtitle: "Relatório de pesagem — apartação",
    },
    logo,
  );

  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Informações da apartação", 15, y);
  y += 6;

  const rows: [string, string][] = [
    ["Produtor:", data.header.produtor || "—"],
    ["Fazenda:", data.header.fazenda || "—"],
  ];
  if (data.header.cidade) rows.push(["Cidade:", data.header.cidade]);
  rows.push(
    ["Lote de origem:", data.header.lote],
    ["Categoria:", data.header.categoria],
    ["Tipo:", data.header.identificado ? "Identificado" : "Sem identificação"],
    ["Data:", fmtDateTime(data.header.data)],
    ["Total animais apartados:", String(data.totalGeral.quantidade)],
    ["Peso total geral:", `${fmtN(data.totalGeral.peso_total, 2)} kg`],
  );
  doc.setFontSize(10);
  for (const [l, v] of rows) {
    doc.setFont("helvetica", "bold"); doc.setTextColor(INK);
    doc.text(l, 15, y);
    const lw = doc.getTextWidth(l);
    doc.setFont("helvetica", "normal");
    doc.text(String(v), 15 + lw + 2, y);
    y += 5.5;
  }

  y += 2;
  doc.setDrawColor(LINE); doc.setLineWidth(0.4);
  doc.line(15, y, W - 15, y);
  y += 6;

  for (const d of data.destinos) {
    if (y > H - 60) { doc.addPage(); y = 20; }

    // Título do destino
    doc.setFillColor(31, 122, 77);
    doc.rect(15, y - 4, W - 30, 8, "F");
    doc.setTextColor("#ffffff");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Destino: ${d.nome_lote}`, 17, y + 1.5);
    doc.setFontSize(9);
    doc.text(`${d.quantidade} animais`, W - 17, y + 1.5, { align: "right" });
    y += 8;

    // Totais do destino
    const tRows: [string, string][] = [
      ["Peso total", `${fmtN(d.peso_total, 2)} kg`],
      ["Peso médio", `${fmtN(d.peso_medio, 2)} kg`],
    ];
    if (d.peso_medio_anterior != null) {
      tRows.push(["Peso médio anterior", `${fmtN(d.peso_medio_anterior, 2)} kg`]);
      if (d.data_anterior) tRows.push(["Pesagem anterior", fmtDate(d.data_anterior)]);
      if (d.dias != null) tRows.push(["Dias entre pesagens", String(d.dias)]);
      if (d.gmd != null) tRows.push(["GMD do lote", `${fmtN(d.gmd, 3)} kg/dia`]);
    }
    autoTable(doc, {
      startY: y + 2,
      body: tRows,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, textColor: INK, lineColor: LINE },
      columnStyles: {
        0: { fontStyle: "bold", fillColor: [247, 244, 234] as any, cellWidth: 70 },
        1: { halign: "right" },
      },
      margin: { left: 15, right: 15 },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 4;

    // Detalhe
    if (d.identificado && d.identificados && d.identificados.length > 0) {
      const body = d.identificados.map((r) => [
        r.numero,
        `${fmtN(r.peso_kg, 1)} kg`,
        fmtDateTime(r.data),
        r.gmd_individual != null ? `${fmtN(r.gmd_individual, 3)} kg/dia` : "—",
      ]);
      autoTable(doc, {
        startY: y + 1,
        head: [["Nº", "Peso", "Data/hora", "GMD"]],
        body,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 1.8, textColor: INK, lineColor: LINE },
        headStyles: { fillColor: [31, 122, 77] as any, textColor: 255, fontStyle: "bold" },
        margin: { left: 15, right: 15 },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? y) + 6;
    } else if (!d.identificado && d.semId && d.semId.length > 0) {
      const cols = 4;
      const colW = (W - 30) / cols;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(INK);
      y += 4;
      const rowsCount = Math.ceil(d.semId.length / cols);
      for (let r = 0; r < rowsCount; r++) {
        if (y > H - 15) { doc.addPage(); y = 20; }
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          if (idx >= d.semId.length) break;
          const p = d.semId[idx];
          doc.text(`${p.ordem}. ${fmtN(p.peso_kg, 1)} kg`, 15 + c * colW, y);
        }
        y += 5;
      }
      y += 4;
    }
  }

  drawFooter(doc);
  return doc.output("blob");
}
