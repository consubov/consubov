import { fetchPdfBinaryWithTimeout } from "@/lib/reportPdfExport";
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
  horaInicio?: string | null;
  horaFim?: string | null;
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

export interface PecuaristaLeituraBalancao {
  ordem: number;
  peso_total: number;
  quantidade_animais: number;
  peso_individual: number;
}

export interface PecuaristaPdfData {
  header: PecuaristaPdfHeader;
  totais: PecuaristaPdfTotais;
  identificados?: PecuaristaPesoIdentificado[];
  semId?: PecuaristaPesoSemId[];
  leiturasBalancao?: PecuaristaLeituraBalancao[];
}

function fmtN(v: number, d = 2) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtDate(iso: string) { try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; } }
function fmtDateTime(iso: string) { try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; } }
function fmtHora(iso: string) {
  try { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}
function fmtHorarioLinha(dataFim: string, dataInicio?: string | null): string | null {
  const hFim = fmtHora(dataFim);
  const hIni = dataInicio ? fmtHora(dataInicio) : "";
  if (hIni && hFim) return `Início da pesagem: ${hIni}h - Término da pesagem: ${hFim}h`;
  return null;
}

async function urlToJpeg(url: string, maxDim = 800, quality = 0.85) {
  try {
    const blob = await fetchPdfBinaryWithTimeout(url);
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

// Gráfico de pesos: barras verdes + linha de tendência laranja (mesmo estilo do Pesador).
function renderChartToDataUrl(pesos: number[]): string | null {
  try {
    const n = pesos.length;
    if (n === 0) return null;
    const W = 1400, H = 600;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    const padL = 70, padR = 30, padT = 40, padB = 60;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const max = Math.max(...pesos);
    const min = Math.min(...pesos);
    const yMax = Math.ceil(max / 50) * 50;
    const yMin = Math.max(0, Math.floor(min / 50) * 50 - 50);
    const yRange = yMax - yMin || 1;
    ctx.font = "16px Helvetica";
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const y = padT + (chartH * i) / ySteps;
      ctx.strokeStyle = "#EEEEEE";
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      const val = yMax - (yRange * i) / ySteps;
      ctx.fillStyle = "#666666"; ctx.textAlign = "right";
      ctx.fillText(`${Math.round(val)}`, padL - 8, y + 5);
    }
    const barSlot = chartW / n;
    const barW = Math.max(1, barSlot * 0.7);
    const showLabels = barSlot >= 22;
    ctx.fillStyle = GREEN;
    for (let i = 0; i < n; i++) {
      const v = pesos[i];
      const h = ((v - yMin) / yRange) * chartH;
      const x = padL + i * barSlot + (barSlot - barW) / 2;
      const y = padT + chartH - h;
      ctx.fillRect(x, y, barW, h);
    }
    ctx.strokeStyle = "#E8863A"; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const v = pesos[i];
      const h = ((v - yMin) / yRange) * chartH;
      const x = padL + i * barSlot + barSlot / 2;
      const y = padT + chartH - h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#E8863A";
    for (let i = 0; i < n; i++) {
      const v = pesos[i];
      const h = ((v - yMin) / yRange) * chartH;
      const x = padL + i * barSlot + barSlot / 2;
      const y = padT + chartH - h;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    if (showLabels) {
      ctx.fillStyle = "#333333"; ctx.font = "14px Helvetica"; ctx.textAlign = "center";
      for (let i = 0; i < n; i++) {
        const v = pesos[i];
        const h = ((v - yMin) / yRange) * chartH;
        const x = padL + i * barSlot + barSlot / 2;
        const y = padT + chartH - h - 6;
        ctx.fillText(`${Math.round(v)}`, x, y);
      }
    }
    ctx.fillStyle = "#666666"; ctx.font = "14px Helvetica"; ctx.textAlign = "center";
    const tickStep = Math.max(1, Math.ceil(n / 20));
    for (let i = 0; i < n; i += tickStep) {
      const x = padL + i * barSlot + barSlot / 2;
      ctx.fillText(`${i + 1}`, x, padT + chartH + 20);
    }
    if ((n - 1) % tickStep !== 0) {
      const x = padL + (n - 1) * barSlot + barSlot / 2;
      ctx.fillText(`${n}`, x, padT + chartH + 20);
    }
    ctx.strokeStyle = "#999999";
    ctx.beginPath(); ctx.moveTo(padL, padT + chartH); ctx.lineTo(W - padR, padT + chartH); ctx.stroke();
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch { return null; }
}

// Desenha um gráfico de pesos dentro do espaço restante da página (nunca quebra).
// Se não couber o mínimo, cria nova página. Retorna o novo y.
function drawPesosChart(doc: jsPDF, pesos: number[], W: number, H: number, y: number, titulo: string): number {
  const url = renderChartToDataUrl(pesos);
  if (!url) return y;
  const FOOTER_RES = 22;
  const TITLE_H = 6;
  const MIN_CHART_H = 35;
  const MAX_CHART_H = 70;
  let remaining = H - FOOTER_RES - y - TITLE_H - 2;
  if (remaining < MIN_CHART_H) {
    doc.addPage();
    y = 20;
    remaining = H - FOOTER_RES - y - TITLE_H - 2;
  }
  const imgW = W - 30;
  const naturalH = imgW * (600 / 1400);
  const chartH = Math.min(MAX_CHART_H, Math.max(MIN_CHART_H, Math.min(remaining, naturalH)));
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(INK);
  doc.text(titulo, 15, y);
  y += 2;
  try { doc.addImage(url, "JPEG", 15, y, imgW, chartH); } catch { /* ignore */ }
  return y + chartH + 4;
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
    try { doc.addImage(logo.dataUrl, "JPEG", W - 15 - w, yLogo, w, h); } catch { /* Optional logo rendering must not block the report. */ }
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
    doc.text("consubov.com.br", 15, H - 8);
    doc.text("Mais Arrobas", 15, H - 12);
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
    ["Data:", fmtDate(data.header.data)],
  );
  const horarioLinhaP = fmtHorarioLinha(data.header.horaFim ?? data.header.data, data.header.horaInicio);
  if (horarioLinhaP) rows.push(["", horarioLinhaP]);

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
    ["Peso médio (@)", `${fmtN(t.peso_medio / 30, 2)} @`],
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
      0: { fontStyle: "bold", fillColor: [247, 244, 234] as [number, number, number], cellWidth: 70 },
      1: { halign: "right" },
    },
    margin: { left: 15, right: 15 },
  });
  y = ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;

  const H = doc.internal.pageSize.getHeight();
  let pesosParaGrafico: number[] = [];

  // Detalhe
  if (data.header.identificado && data.identificados && data.identificados.length > 0) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(INK);
    doc.text("Pesos por animal", 15, y);
    y += 2;
    const body = data.identificados.map((r) => [
      r.numero,
      `${fmtN(r.peso_kg, 1)} kg`,
      `${fmtN(r.peso_kg / 30, 2)} @`,
      fmtDate(r.data),
      r.peso_anterior_kg != null ? `${fmtN(r.peso_anterior_kg, 1)} kg` : "—",
      r.data_anterior ? fmtDate(r.data_anterior) : "—",
      r.dias != null ? String(r.dias) : "—",
      r.gmd_individual != null ? `${fmtN(r.gmd_individual, 3)} kg/dia` : "—",
    ]);
    autoTable(doc, {
      startY: y + 2,
      head: [["Nº", "Peso", "@", "Data/hora", "Anterior", "Data anterior", "Dias", "GMD"]],
      body,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, textColor: INK, lineColor: LINE },
      headStyles: { fillColor: [31, 122, 77] as [number, number, number], textColor: 255, fontStyle: "bold" },
      margin: { left: 15, right: 15 },
    });
    y = ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 6;
    pesosParaGrafico = data.identificados.map((r) => r.peso_kg);
  } else if (!data.header.identificado && data.semId && data.semId.length > 0) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(INK);
    doc.text("Pesos registrados (peso vivo)", 15, y);
    y += 2;
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
        doc.text(`${p.ordem} - ${fmtN(p.peso_kg, 1)} kg`, 15 + c * colW, y);
      }
      y += rowH;
      if (y > H - 20) { doc.addPage(); y = 20; }
    }
    pesosParaGrafico = data.semId.map((r) => r.peso_kg);
  }

  // Gráfico de pesos (sempre 1 página, comprime conforme necessário)
  if (pesosParaGrafico.length > 0) {
    y = drawPesosChart(doc, pesosParaGrafico, W, H, y + 2, `Gráfico de Pesos (1 a ${pesosParaGrafico.length})`);
  }


  if (data.leiturasBalancao && data.leiturasBalancao.length > 0) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Leituras em Balanção", 15, 20);
    autoTable(doc, {
      startY: 26,
      head: [["Ordem", "Peso total (kg)", "Qtd animais", "Peso individual (kg)"]],
      body: data.leiturasBalancao.map((l) => [
        `#${l.ordem}`,
        fmtN(l.peso_total, 2),
        String(l.quantidade_animais),
        fmtN(l.peso_individual, 2),
      ]),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [31, 122, 77] as [number, number, number], textColor: 255, fontStyle: "bold" },
      margin: { left: 15, right: 15 },
    });
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
    ["Data:", fmtDate(data.header.data)],
  );
  const horarioLinhaA = fmtHorarioLinha(data.header.horaFim ?? data.header.data, data.header.horaInicio);
  if (horarioLinhaA) rows.push(["", horarioLinhaA]);
  rows.push(
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
      ["Peso médio (@)", `${fmtN(d.peso_medio / 30, 2)} @`],
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
        0: { fontStyle: "bold", fillColor: [247, 244, 234] as [number, number, number], cellWidth: 70 },
        1: { halign: "right" },
      },
      margin: { left: 15, right: 15 },
    });
    y = ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 4;

    let pesosDest: number[] = [];

    // Detalhe
    if (d.identificado && d.identificados && d.identificados.length > 0) {
      const body = d.identificados.map((r) => [
        r.numero,
        `${fmtN(r.peso_kg, 1)} kg`,
        `${fmtN(r.peso_kg / 30, 2)} @`,
        fmtDate(r.data),
        r.gmd_individual != null ? `${fmtN(r.gmd_individual, 3)} kg/dia` : "—",
      ]);
      autoTable(doc, {
        startY: y + 1,
        head: [["Nº", "Peso", "@", "Data/hora", "GMD"]],
        body,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 1.8, textColor: INK, lineColor: LINE },
        headStyles: { fillColor: [31, 122, 77] as [number, number, number], textColor: 255, fontStyle: "bold" },
        margin: { left: 15, right: 15 },
      });
      y = ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 6;
      pesosDest = d.identificados.map((r) => r.peso_kg);
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
          doc.text(`${p.ordem} - ${fmtN(p.peso_kg, 1)} kg`, 15 + c * colW, y);
        }
        y += 5;
      }
      y += 4;
      pesosDest = d.semId.map((r) => r.peso_kg);
    }

    if (pesosDest.length > 0) {
      y = drawPesosChart(doc, pesosDest, W, H, y, `Gráfico de Pesos — ${d.nome_lote} (1 a ${pesosDest.length})`);
    }
  }


  drawFooter(doc);
  return doc.output("blob");
}
