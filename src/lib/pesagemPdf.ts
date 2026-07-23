import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AnimalCalc, PesagemCompraCfg } from "./pesagemCompra";
import { totalizar } from "./pesagemCompra";

const GREEN_STRIPE = "#1F7A4D";
const INK = "#1C1C1A";
const INK_SOFT = "#767066";
const LINE = "#E7E3D6";

export interface PesagemPdfHeader {
  produtor: string;
  fazenda: string;
  cidade: string;
  data: string;
  categoriaLabel: string;
  formaPagamento: string;
}

export interface PesagemPdfData {
  header: PesagemPdfHeader;
  cfg: PesagemCompraCfg;
  animais: AnimalCalc[];
  pesadorLogoUrl?: string | null;
  pesadorNomeEmpresa?: string | null;
  pesadorNome?: string | null;
  valorTotalOverride?: number | null;
  semValores?: boolean;
  rendimentoEstimado?: number | null;
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtNum(v: number, decimals = 2) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
}

async function urlToJpeg(url: string, maxDim = 800, quality = 0.85): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    let { width, height } = bmp;
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * scale); height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d"); if (!ctx) return null;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bmp, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL("image/jpeg", quality), w: width, h: height };
  } catch { return null; }
}

// Header block only on page 1. Text and logo stay ABOVE the green stripe.
// Returns the Y position immediately below the stripe (where content begins).
function drawFirstPageHeader(
  doc: jsPDF,
  nomeEmpresa: string,
  pesadorNome: string | null,
  rightLogo: { dataUrl: string; w: number; h: number } | null,
): number {
  const W = doc.internal.pageSize.getWidth();
  const topY = 12;
  const HEADER_H = 26; // block height reserved for text/logo
  const stripeY = topY + HEADER_H;

  // Left text block
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(nomeEmpresa || "PESADOR", 15, topY + 7);

  let y = topY + 13;
  if (pesadorNome) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.text(pesadorNome, 15, y);
    y += 5;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(INK_SOFT);
  doc.text("RELATÓRIO DE PESAGEM", 15, y);

  // Right logo — vertically centered inside HEADER_H
  if (rightLogo) {
    const maxH = HEADER_H - 4;
    const maxW = 45;
    const ratio = rightLogo.w / rightLogo.h;
    let h = maxH;
    let w = h * ratio;
    if (w > maxW) { w = maxW; h = w / ratio; }
    const yLogo = topY + (HEADER_H - h) / 2;
    try { doc.addImage(rightLogo.dataUrl, "JPEG", W - 15 - w, yLogo, w, h); } catch { /* ignore */ }
  }

  // Green stripe below the whole header block
  doc.setFillColor(GREEN_STRIPE);
  doc.rect(0, stripeY, W, 2.5, "F");

  return stripeY + 12;
}

const CATEGORIA_LABELS_PDF: Record<string, string> = {
  boi_gordo: "Boi Gordo",
  vaca_gorda: "Vaca Gorda",
  vaca_magra: "Vaca Magra",
  boi_magro: "Boi Magro",
  garrote: "Garrote",
  novilha: "Novilha",
  bezerro: "Bezerro",
  bezerra: "Bezerra",
  aleatoria: "Aleatória",
};

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
    // Rodapé em 3 linhas (base alinhada com o "Página x de y")
    doc.text("www.consubov.com.br", 15, H - 8);
    doc.text("Uma marca do grupo Consubov", 15, H - 12);
    doc.text("Mais Arrobas", 15, H - 16);
  }
}


function renderChartToDataUrl(pesos: number[]): string | null {
  try {
    const n = pesos.length;
    if (n === 0) return null;
    const W = 1400, H = 600;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    const padL = 70, padR = 30, padT = 40, padB = 60;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const max = Math.max(...pesos);
    const min = Math.min(...pesos);
    const yMax = Math.ceil(max / 50) * 50;
    const yMin = Math.max(0, Math.floor(min / 50) * 50 - 50);
    const yRange = yMax - yMin || 1;

    ctx.strokeStyle = "#CCCCCC";
    ctx.lineWidth = 1;
    ctx.font = "16px Helvetica";
    ctx.fillStyle = "#666666";
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const y = padT + (chartH * i) / ySteps;
      ctx.strokeStyle = "#EEEEEE";
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      const val = yMax - (yRange * i) / ySteps;
      ctx.fillStyle = "#666666";
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(val)}`, padL - 8, y + 5);
    }

    const barSlot = chartW / n;
    const barW = Math.max(1, barSlot * 0.7);
    const showLabels = barSlot >= 22;

    ctx.fillStyle = GREEN_STRIPE;
    for (let i = 0; i < n; i++) {
      const v = pesos[i];
      const h = ((v - yMin) / yRange) * chartH;
      const x = padL + i * barSlot + (barSlot - barW) / 2;
      const y = padT + chartH - h;
      ctx.fillRect(x, y, barW, h);
    }

    ctx.strokeStyle = "#E8863A";
    ctx.lineWidth = 2.5;
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
      ctx.fillStyle = "#333333";
      ctx.font = "14px Helvetica";
      ctx.textAlign = "center";
      for (let i = 0; i < n; i++) {
        const v = pesos[i];
        const h = ((v - yMin) / yRange) * chartH;
        const x = padL + i * barSlot + barSlot / 2;
        const y = padT + chartH - h - 6;
        ctx.fillText(`${Math.round(v)}`, x, y);
      }
    }

    ctx.fillStyle = "#666666";
    ctx.font = "14px Helvetica";
    ctx.textAlign = "center";
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
    ctx.beginPath();
    ctx.moveTo(padL, padT + chartH);
    ctx.lineTo(W - padR, padT + chartH);
    ctx.stroke();

    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return null;
  }
}

export async function gerarPesagemPdf(data: PesagemPdfData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const rightLogo = data.pesadorLogoUrl ? await urlToJpeg(data.pesadorLogoUrl) : null;
  const nomeEmpresa = data.pesadorNomeEmpresa || "PESADOR";
  const pesadorNome = data.pesadorNome ?? null;

  // ===== PAGE 1: header + info + weights grid + chart =====
  let y = drawFirstPageHeader(doc, nomeEmpresa, pesadorNome, rightLogo);

  // Info block
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Informações da pesagem", 15, y);
  y += 6;

  const cfg = data.cfg;
  const semValores = !!data.semValores;
  const rendimentoLabel =
    cfg.modo_percentual === "fixo" && cfg.percentual_fixo != null
      ? `${fmtNum(cfg.percentual_fixo, 1)}%`
      : "Variável por animal";

  const infoRows: [string, string][] = [];
  infoRows.push(["Produtor:", data.header.produtor || "—"]);
  if (data.header.fazenda) infoRows.push(["Fazenda:", data.header.fazenda]);
  if (data.header.cidade) infoRows.push(["Cidade:", data.header.cidade]);
  const catLabel = cfg.tipo_preco === "misto" ? "Aleatória (mista)" : data.header.categoriaLabel;
  infoRows.push(["Categoria:", catLabel]);

  if (semValores) {
    infoRows.push(["Tipo:", "Pesagem de rotina (sem valores)"]);
    if (data.rendimentoEstimado != null) {
      infoRows.push(["Rendimento estimado:", `${fmtNum(data.rendimentoEstimado, 1)}%`]);
    }
  } else if (cfg.tipo_preco === "arroba") {
    infoRows.push(["Valor da arroba:", `${fmtBRL(cfg.preco_valor)}/@`]);
    infoRows.push(["Rendimento de carcaça:", rendimentoLabel]);
  } else if (cfg.tipo_preco === "kg") {
    infoRows.push(["Valor do kg:", `${fmtBRL(cfg.preco_valor)}/kg`]);
  } else if (cfg.tipo_preco === "fixo_animal") {
    infoRows.push(["Preço fixo por animal:", fmtBRL(cfg.preco_valor)]);
  } else if (cfg.tipo_preco === "misto") {
    infoRows.push(["Forma de pagamento:", "Mista (@ / kg / Fixo por animal)"]);
  }
  infoRows.push(["Data:", fmtDate(data.header.data)]);

  doc.setFontSize(10);
  for (const [label, value] of infoRows) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(INK);
    doc.text(label, 15, y);
    const labelW = doc.getTextWidth(label);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(INK);
    doc.text(String(value), 15 + labelW + 2, y);
    y += 5.5;
  }

  // Divider
  y += 1;
  doc.setDrawColor(LINE); doc.setLineWidth(0.4);
  doc.line(15, y, W - 15, y);
  y += 6;

  // ===== Weights registered — dynamic layout to fit on page 1 =====
  const n = data.animais.length;
  const FOOTER_RESERVE = 12;
  const CHART_TITLE_H = 6;
  const CHART_H_MIN = 45;
  const CHART_H_MAX = 70;
  const LIST_TITLE_H = 6;

  // Available height on page 1 below the info block
  const availableForListAndChart = H - FOOTER_RESERVE - y;

  // Try progressively denser grids until content fits
  const isMisto = cfg.tipo_preco === "misto";
  let chartH = CHART_H_MIN;

  if (isMisto) {
    // One-column list, one row per animal, with category / rendimento / valor
    const listAttempts = [
      { rowH: 5.2, fontSize: 9 },
      { rowH: 4.8, fontSize: 8.5 },
      { rowH: 4.4, fontSize: 8 },
      { rowH: 4.0, fontSize: 7.5 },
      { rowH: 3.7, fontSize: 7 },
      { rowH: 3.5, fontSize: 6.5 },
    ];
    let chosenList = listAttempts[listAttempts.length - 1];
    for (const a of listAttempts) {
      const listH = LIST_TITLE_H + n * a.rowH;
      const remainingForChart = availableForListAndChart - listH - CHART_TITLE_H - 2;
      if (remainingForChart >= CHART_H_MIN) {
        chosenList = a;
        chartH = Math.min(CHART_H_MAX, remainingForChart);
        break;
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK);
    doc.text("Pesos registrados (peso vivo):", 15, y);
    y += LIST_TITLE_H;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(chosenList.fontSize);
    for (let i = 0; i < n; i++) {
      const a = data.animais[i];
      const catKey = a.categoria_individual ?? "";
      const catLabel = CATEGORIA_LABELS_PDF[catKey] ?? catKey ?? "—";
      const mapped = cfg.categorias_map?.[catKey];
      const tipoInd = (mapped?.tipo_preco ?? a.tipo_preco_individual ?? "kg");
      const parts: string[] = [`${i + 1} - ${fmtNum(a.peso_kg, 0)} kg`, catLabel];
      if (tipoInd === "arroba" && a.percentual_individual != null) {
        parts.push(`Rend. ${fmtNum(a.percentual_individual, 0)}%`);
      }
      parts.push(fmtBRL(a.valor));
      doc.text(parts.join(" — "), 15, y);
      y += chosenList.rowH;
    }
  } else {
    // Try progressively denser grids until content fits
    const attempts: Array<{ cols: number; rowH: number; fontSize: number }> = [
      { cols: 3, rowH: 5.5, fontSize: 9 },
      { cols: 3, rowH: 5.0, fontSize: 8.5 },
      { cols: 4, rowH: 4.8, fontSize: 8 },
      { cols: 5, rowH: 4.5, fontSize: 7.5 },
      { cols: 6, rowH: 4.2, fontSize: 7 },
      { cols: 7, rowH: 4.0, fontSize: 6.8 },
      { cols: 8, rowH: 3.8, fontSize: 6.5 },
    ];

    let chosen = attempts[attempts.length - 1];
    for (const a of attempts) {
      const rows = Math.ceil(n / a.cols);
      const listH = LIST_TITLE_H + rows * a.rowH;
      const remainingForChart = availableForListAndChart - listH - CHART_TITLE_H - 2;
      if (remainingForChart >= CHART_H_MIN) {
        chosen = a;
        chartH = Math.min(CHART_H_MAX, remainingForChart);
        break;
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK);
    doc.text("Pesos registrados (peso vivo):", 15, y);
    y += LIST_TITLE_H;

    const { cols, rowH, fontSize } = chosen;
    const colW = (W - 30) / cols;
    const rowsCount = Math.ceil(n / cols);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    for (let r = 0; r < rowsCount; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= n) break;
        const a = data.animais[idx];
        const label = `${idx + 1} - ${fmtNum(a.peso_kg, 0)} kg`;
        doc.text(label, 15 + c * colW, y);
      }
      y += rowH;
    }
  }


  // ===== Chart on same page 1 =====
  const pesosArr = data.animais.map((a) => a.peso_kg);
  const chartDataUrl = renderChartToDataUrl(pesosArr);
  if (chartDataUrl) {
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK);
    doc.text(`Gráfico de Pesos (1 a ${pesosArr.length})`, 15, y);
    y += 2;
    const imgW = W - 30;
    const imgH = Math.min(chartH, imgW * (600 / 1400));
    try { doc.addImage(chartDataUrl, "JPEG", 15, y, imgW, imgH); } catch { /* ignore */ }
  }

  // ===== Totais em nova página (sem cabeçalho) =====
  const tot = totalizar(data.animais);
  doc.addPage();

  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Totais do Lote", 15, 20);

  const tipo = cfg.tipo_preco;
  const body: [string, string][] = [];
  body.push(["Total de animais", String(tot.totalAnimais)]);
  body.push(["Peso total", `${fmtNum(tot.totalPeso, 2)} kg`]);
  body.push(["Peso médio", `${fmtNum(tot.mediaPeso, 2)} kg`]);

  if (semValores) {
    body.push(["Tipo", "Pesagem de rotina (sem valores)"]);
    if (data.rendimentoEstimado != null) {
      const arrobasEst = Math.floor((tot.totalPeso * data.rendimentoEstimado / 100 / 15) * 100) / 100;
      const mediaArrobaEst = tot.totalAnimais > 0
        ? Math.floor((arrobasEst / tot.totalAnimais) * 100) / 100
        : 0;
      body.push(["Rendimento estimado", `${fmtNum(data.rendimentoEstimado, 1)}%`]);
      body.push(["@ estimadas", fmtNum(arrobasEst, 2)]);
      body.push(["Média de @ por animal (estimada)", fmtNum(mediaArrobaEst, 2)]);
    }
  } else if (tipo === "arroba") {
    body.push(["Rendimento de carcaça", rendimentoLabel]);
    body.push(["@ pagáveis totais", fmtNum(tot.totalArroba, 2)]);
    body.push(["Média de @ por animal", fmtNum(tot.mediaArrobaPorAnimal, 2)]);
  } else if (tipo === "misto") {
    const nA = data.animais.filter((a) => a.tipo_preco_individual === "arroba").length;
    const nK = data.animais.filter((a) => a.tipo_preco_individual === "kg").length;
    const nF = data.animais.filter((a) => a.tipo_preco_individual === "fixo_animal").length;
    body.push(["Animais por @", String(nA)]);
    body.push(["Animais por kg", String(nK)]);
    body.push(["Animais preço fixo", String(nF)]);
    if (nA > 0) body.push(["@ pagáveis totais", fmtNum(tot.totalArroba, 2)]);
  } else if (tipo === "fixo_animal") {
    body.push(["Preço fixo por animal", fmtBRL(cfg.preco_valor)]);
  }

  autoTable(doc, {
    startY: 28,
    body,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 3, textColor: INK, lineColor: LINE },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [247, 244, 234] as any, cellWidth: 70 },
      1: { halign: "right" },
    },
    margin: { left: 15, right: 15 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 80;

  if (semValores) {
    if (data.rendimentoEstimado != null) {
      doc.setTextColor(INK_SOFT);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text(
        "@ estimadas: valor informativo, sem finalidade comercial.",
        15,
        finalY + 10
      );
    }
  } else {
    doc.setFillColor(20, 67, 43);
    doc.roundedRect(15, finalY + 8, W - 30, 22, 3, 3, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Valor total a pagar", 22, finalY + 17);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(fmtBRL(data.valorTotalOverride ?? tot.totalValor), 22, finalY + 26);
  }

  drawFooter(doc);
  return doc.output("blob");
}
