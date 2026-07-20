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

function drawHeader(
  doc: jsPDF,
  nomeEmpresa: string,
  pesadorNome: string | null,
  rightLogo: { dataUrl: string; w: number; h: number } | null,
) {
  const W = doc.internal.pageSize.getWidth();
  const topY = 14;
  // Left: nome_empresa + pesador nome + subtitle
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(nomeEmpresa || "PESADOR", 15, topY + 6);
  let subY = topY + 12;
  if (pesadorNome) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.text(pesadorNome, 15, subY);
    subY += 5;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(INK_SOFT);
  doc.text("RELATÓRIO DE PESAGEM", 15, subY);

  // Right: pesador logo (proportional)
  if (rightLogo) {
    const boxH = 16;
    const ratio = rightLogo.w / rightLogo.h;
    const h = boxH;
    const wDraw = Math.min(45, h * ratio);
    try { doc.addImage(rightLogo.dataUrl, "JPEG", W - 15 - wDraw, topY, wDraw, h); } catch { /* ignore */ }
  }

  // Green stripe
  const stripeY = topY + 16;
  doc.setFillColor(GREEN_STRIPE);
  doc.rect(0, stripeY, W, 2.5, "F");
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
    doc.text("Gerado por: Consubov.com.br", 15, H - 8);
  }
}

function renderChartToDataUrl(pesos: number[]): string | null {
  try {
    const n = pesos.length;
    if (n === 0) return null;
    // High-res canvas
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
    // Y scale: nice bounds
    const yMax = Math.ceil(max / 50) * 50;
    const yMin = Math.max(0, Math.floor(min / 50) * 50 - 50);
    const yRange = yMax - yMin || 1;

    // Axes
    ctx.strokeStyle = "#CCCCCC";
    ctx.lineWidth = 1;
    ctx.font = "16px Helvetica";
    ctx.fillStyle = "#666666";
    // Y grid + labels
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

    // Bars
    const barSlot = chartW / n;
    const barW = Math.max(1, barSlot * 0.7);
    const showLabels = barSlot >= 22; // ~22px per slot before labels get illegible

    ctx.fillStyle = GREEN_STRIPE;
    for (let i = 0; i < n; i++) {
      const v = pesos[i];
      const h = ((v - yMin) / yRange) * chartH;
      const x = padL + i * barSlot + (barSlot - barW) / 2;
      const y = padT + chartH - h;
      ctx.fillRect(x, y, barW, h);
    }

    // Line overlay (orange)
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
    // Line points
    ctx.fillStyle = "#E8863A";
    for (let i = 0; i < n; i++) {
      const v = pesos[i];
      const h = ((v - yMin) / yRange) * chartH;
      const x = padL + i * barSlot + barSlot / 2;
      const y = padT + chartH - h;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Labels above bars (only if fits)
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

    // X axis ticks (indices)
    ctx.fillStyle = "#666666";
    ctx.font = "14px Helvetica";
    ctx.textAlign = "center";
    const tickStep = Math.max(1, Math.ceil(n / 20));
    for (let i = 0; i < n; i += tickStep) {
      const x = padL + i * barSlot + barSlot / 2;
      ctx.fillText(`${i + 1}`, x, padT + chartH + 20);
    }
    // Always draw last index
    if ((n - 1) % tickStep !== 0) {
      const x = padL + (n - 1) * barSlot + barSlot / 2;
      ctx.fillText(`${n}`, x, padT + chartH + 20);
    }

    // Baseline
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

  drawHeader(doc, nomeEmpresa, rightLogo);

  // Info block
  let y = 42;
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Informações da pesagem", 15, y);
  y += 6;

  const cfg = data.cfg;
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

  if (cfg.tipo_preco === "arroba") {
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
    y += 6;
  }

  // Divider
  y += 2;
  doc.setDrawColor(LINE); doc.setLineWidth(0.4);
  doc.line(15, y, W - 15, y);
  y += 8;

  // Pesos registrados
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK);
  doc.text("Pesos registrados (peso vivo):", 15, y);
  y += 6;

  const cols = 3;
  const colW = (W - 30) / cols;
  const rowH = 5.5;
  const lines = data.animais.map((a) => `${a.ordem}. ${fmtNum(a.peso_kg, 0)} kg`);
  const rowsCount = Math.ceil(lines.length / cols);
  const listMaxY = H - 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (let r = 0; r < rowsCount; r++) {
    if (y + rowH > listMaxY) {
      doc.addPage();
      drawHeader(doc, nomeEmpresa, rightLogo);
      y = 42;
    }
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= lines.length) break;
      doc.text(lines[idx], 15 + c * colW, y);
    }
    y += rowH;
  }

  // ===== Chart page =====
  const pesosArr = data.animais.map((a) => a.peso_kg);
  const chartDataUrl = renderChartToDataUrl(pesosArr);
  if (chartDataUrl) {
    doc.addPage();
    drawHeader(doc, nomeEmpresa, rightLogo);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(INK);
    doc.text(`Gráfico de Pesos (1 a ${pesosArr.length})`, 15, 42);
    const imgW = W - 30;
    const imgH = imgW * (600 / 1400);
    try { doc.addImage(chartDataUrl, "JPEG", 15, 48, imgW, imgH); } catch { /* ignore */ }
  }

  // ===== Totais em nova página =====
  const tot = totalizar(data.animais);
  doc.addPage();
  drawHeader(doc, nomeEmpresa, rightLogo);

  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Totais do Lote", 15, 44);

  const tipo = cfg.tipo_preco;
  const body: [string, string][] = [];
  body.push(["Total de animais", String(tot.totalAnimais)]);
  body.push(["Peso total", `${fmtNum(tot.totalPeso, 2)} kg`]);
  body.push(["Peso médio", `${fmtNum(tot.mediaPeso, 2)} kg`]);

  if (tipo === "arroba") {
    body.push(["Rendimento de carcaça", rendimentoLabel]);
    body.push(["@ pagáveis totais", fmtNum(tot.totalArroba, 3)]);
    body.push(["Média de @ por animal", fmtNum(tot.mediaArrobaPorAnimal, 3)]);
  } else if (tipo === "misto") {
    const nA = data.animais.filter((a) => a.tipo_preco_individual === "arroba").length;
    const nK = data.animais.filter((a) => a.tipo_preco_individual === "kg").length;
    const nF = data.animais.filter((a) => a.tipo_preco_individual === "fixo_animal").length;
    body.push(["Animais por @", String(nA)]);
    body.push(["Animais por kg", String(nK)]);
    body.push(["Animais preço fixo", String(nF)]);
    if (nA > 0) body.push(["@ pagáveis totais", fmtNum(tot.totalArroba, 3)]);
  } else if (tipo === "fixo_animal") {
    body.push(["Preço fixo por animal", fmtBRL(cfg.preco_valor)]);
  }

  autoTable(doc, {
    startY: 52,
    body,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 3, textColor: INK, lineColor: LINE },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [247, 244, 234] as any, cellWidth: 70 },
      1: { halign: "right" },
    },
    margin: { left: 15, right: 15 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 100;

  doc.setFillColor(20, 67, 43);
  doc.roundedRect(15, finalY + 8, W - 30, 22, 3, 3, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Valor total a pagar", 22, finalY + 17);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(fmtBRL(tot.totalValor), 22, finalY + 26);

  drawFooter(doc);
  return doc.output("blob");
}
