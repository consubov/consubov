import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import logoAsset from "@/assets/consubov-logo-preta.jpeg.asset.json";

export interface DespesaItem {
  data_despesa: string; // YYYY-MM-DD
  valor: number;
  foto_cupom_url: string;
}

export interface DespesasPdfData {
  consultor_nome: string;
  data_inicio: string; // YYYY-MM-DD
  data_fim: string;
  tipo_periodo: string;
  despesas: DespesaItem[];
  valor_total: number;
}

const GREEN_DARK = "#14432B";
const GOLD = "#C9A84C";
const INK = "#1C1C1A";
const INK_SOFT = "#767066";
const LINE = "#E7E3D6";

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

async function urlToJpeg(url: string, maxDim = 1400, quality = 0.78): Promise<string | null> {
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
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
}

function drawCoverHeader(doc: jsPDF, logoDataUrl: string | null, subtitle: string) {
  const w = doc.internal.pageSize.getWidth();
  const logoH = 16;
  const logoW = 44;
  const logoX = 15;
  const logoY = 10;
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "JPEG", logoX, logoY, logoW, logoH); } catch { /* ignore */ }
  }
  const dividerX = logoX + logoW + 6;
  doc.setDrawColor(GREEN_DARK);
  doc.setLineWidth(0.8);
  doc.line(dividerX, logoY, dividerX, logoY + logoH);

  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("RELATÓRIO CONSUBOV", dividerX + 4, logoY + 6);
  doc.setTextColor(INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(subtitle, dividerX + 4, logoY + 14);

  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.line(15, 32, w - 15, 32);
}

function drawPageHeader(doc: jsPDF, title: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setDrawColor(GREEN_DARK);
  doc.setLineWidth(1.2);
  doc.line(15, 12, 15 + 22, 12);
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, 15, 20);
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.line(15, 24, w - 15, 24);
}

export async function gerarDespesasPdf(data: DespesasPdfData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const logoDataUrl = await fetchAssetDataUrl(logoAsset.url);

  // ===== COVER =====
  drawCoverHeader(doc, logoDataUrl, "Relatório de Despesas — Consubov");

  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Despesas de Combustível", 15, 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(INK_SOFT);
  doc.text(data.consultor_nome || "", 15, 62);

  // Info blocks
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.line(15, 72, W - 15, 72);

  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Período", 15, 82);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${fmtDate(data.data_inicio)} até ${fmtDate(data.data_fim)}`, 15, 89);
  doc.text(`Tipo: ${data.tipo_periodo}`, 15, 95);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Resumo", 15, 110);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Total de cupons: ${data.despesas.length}`, 15, 117);

  // Total destaque
  doc.setFillColor(20, 67, 43);
  doc.roundedRect(15, 124, W - 30, 22, 3, 3, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Valor total do período", 22, 133);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(fmtBRL(data.valor_total), 22, 142);

  // Detail table
  doc.setTextColor(INK);
  autoTable(doc, {
    startY: 158,
    head: [["#", "Data", "Valor"]],
    body: data.despesas.map((d, i) => [String(i + 1), fmtDate(d.data_despesa), fmtBRL(d.valor)]),
    headStyles: { fillColor: [20, 67, 43] as any, textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });

  // ===== One cupom per page =====
  for (let i = 0; i < data.despesas.length; i++) {
    doc.addPage();
    drawPageHeader(doc, "Cupom Fiscal");

    const d = data.despesas[i];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(INK);
    doc.text(`#${i + 1} — ${fmtDate(d.data_despesa)} — ${fmtBRL(d.valor)}`, 15, 34);

    const jpeg = await urlToJpeg(d.foto_cupom_url);
    if (jpeg) {
      const areaTop = 40;
      const areaBottom = H - 18;
      const areaW = W - 30;
      const areaH = areaBottom - areaTop;
      // Get natural size to fit inside area
      try {
        const props = (doc as any).getImageProperties?.(jpeg);
        let iw = props?.width ?? areaW;
        let ih = props?.height ?? areaH;
        const scale = Math.min(areaW / iw, areaH / ih);
        const drawW = iw * scale;
        const drawH = ih * scale;
        const drawX = 15 + (areaW - drawW) / 2;
        const drawY = areaTop + (areaH - drawH) / 2;
        doc.addImage(jpeg, "JPEG", drawX, drawY, drawW, drawH, undefined, "FAST");
      } catch { /* ignore */ }
    }
  }

  // Footer on all pages
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

  return doc.output("blob");
}
