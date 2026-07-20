import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import logoAsset from "@/assets/consubov-logo-preta.jpeg.asset.json";
import type { AnimalCalc, PesagemCompraCfg } from "./pesagemCompra";
import { totalizar } from "./pesagemCompra";

const GREEN_DARK = "#14432B";
const GOLD = "#C9A84C";
const INK = "#1C1C1A";
const INK_SOFT = "#767066";
const LINE = "#E7E3D6";

export interface PesagemPdfHeader {
  produtor: string;
  fazenda: string;
  cidade: string;
  data: string; // ISO
  categoriaLabel: string; // ex "Boi Gordo" / "Aleatória"
  formaPagamento: string; // ex "@ R$ 300,00" / "kg R$ 12,00" / "Fixo R$ 3.000/animal" / "Aleatória (@/kg/fixo)"
}

export interface PesagemPdfData {
  header: PesagemPdfHeader;
  cfg: PesagemCompraCfg;
  animais: AnimalCalc[];
  pesadorLogoUrl?: string | null;
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtNum(v: number, decimals = 2) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

async function urlToJpeg(url: string, maxDim = 800, quality = 0.85): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    let { width, height } = bmp;
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bmp, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL("image/jpeg", quality), w: width, h: height };
  } catch {
    return null;
  }
}

function drawHeader(
  doc: jsPDF,
  leftLogo: { dataUrl: string; w: number; h: number } | null,
  rightLogo: { dataUrl: string; w: number; h: number } | null,
) {
  const w = doc.internal.pageSize.getWidth();
  const boxH = 16;
  const boxY = 10;
  // Left logo (Consubov) — mantém proporção
  if (leftLogo) {
    const ratio = leftLogo.w / leftLogo.h;
    const h = boxH;
    const wDraw = Math.min(50, h * ratio);
    try { doc.addImage(leftLogo.dataUrl, "JPEG", 15, boxY, wDraw, h); } catch { /* ignore */ }
  }
  // Right logo (pesador) — mantém proporção
  if (rightLogo) {
    const ratio = rightLogo.w / rightLogo.h;
    const h = boxH;
    const wDraw = Math.min(50, h * ratio);
    try { doc.addImage(rightLogo.dataUrl, "JPEG", w - 15 - wDraw, boxY, wDraw, h); } catch { /* ignore */ }
  }
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.line(15, boxY + boxH + 6, w - 15, boxY + boxH + 6);
}

function drawFooter(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(INK_SOFT);
    doc.text(`Página ${p} de ${total}`, W - 15, H - 8, { align: "right" });
    doc.setTextColor(GOLD);
    doc.text("Gerado por Consubov.com.br", 15, H - 8);
  }
}

export async function gerarPesagemPdf(data: PesagemPdfData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const leftLogo = await urlToJpeg(logoAsset.url);
  const rightLogo = data.pesadorLogoUrl ? await urlToJpeg(data.pesadorLogoUrl) : null;

  drawHeader(doc, leftLogo, rightLogo);

  // Título
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Relatório de Pesagem", 15, 44);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(INK_SOFT);
  doc.text("Consubov • Pesador", 15, 51);

  // Header info block (2 colunas)
  const infoY = 60;
  const lineGap = 6;
  const col1X = 15;
  const col2X = W / 2 + 5;

  const rows: [string, string][] = [
    ["Produtor", data.header.produtor || "—"],
    ["Fazenda", data.header.fazenda || "—"],
    ["Cidade", data.header.cidade || "—"],
    ["Data", fmtDate(data.header.data)],
    ["Categoria", data.header.categoriaLabel],
    ["Forma de pagamento", data.header.formaPagamento],
  ];

  doc.setFontSize(9);
  rows.forEach((r, i) => {
    const isLeft = i % 2 === 0;
    const x = isLeft ? col1X : col2X;
    const y = infoY + Math.floor(i / 2) * (lineGap * 2);
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "bold");
    doc.text(r[0].toUpperCase(), x, y);
    doc.setTextColor(INK);
    doc.setFont("helvetica", "normal");
    doc.text(String(r[1]).slice(0, 60), x, y + lineGap);
  });

  const afterInfoY = infoY + Math.ceil(rows.length / 2) * (lineGap * 2) + 4;

  // Divider
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.line(15, afterInfoY, W - 15, afterInfoY);

  // Lista de pesos em colunas
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Pesos registrados", 15, afterInfoY + 8);

  const startListY = afterInfoY + 14;
  const cols = 3;
  const colW = (W - 30) / cols;
  const rowH = 6;
  const linesList = data.animais.map(
    (a) => `${a.ordem} - ${fmtNum(a.peso_kg, 0)} kg`,
  );
  const rowsCount = Math.ceil(linesList.length / cols);
  const listMaxY = H - 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(INK);
  let cursorY = startListY;
  for (let r = 0; r < rowsCount; r++) {
    if (cursorY + rowH > listMaxY) {
      doc.addPage();
      drawHeader(doc, leftLogo, rightLogo);
      cursorY = 40;
    }
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= linesList.length) break;
      doc.text(linesList[idx], 15 + c * colW, cursorY);
    }
    cursorY += rowH;
  }

  // ===== Totais em nova página =====
  const tot = totalizar(data.animais);
  doc.addPage();
  drawHeader(doc, leftLogo, rightLogo);

  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Totais do Lote", 15, 44);

  // Monta linhas conforme forma de pagamento
  const tipo = data.cfg.tipo_preco;
  const rendimentoLabel =
    data.cfg.modo_percentual === "fixo" && data.cfg.percentual_fixo != null
      ? `${fmtNum(data.cfg.percentual_fixo, 1)} %`
      : "Variável por animal";

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
    body.push(["Preço fixo por animal", fmtBRL(data.cfg.preco_valor)]);
  }
  // kg: nada adicional

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

  // Valor a pagar (destaque)
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
