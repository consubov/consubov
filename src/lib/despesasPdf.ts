import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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

const GREEN = [31, 122, 77] as const;
const GOLD = [201, 168, 76] as const;

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function urlToJpeg(url: string, maxDim = 900, quality = 0.72): Promise<string | null> {
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
    ctx.drawImage(bmp, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
}

export async function gerarDespesasPdf(data: DespesasPdfData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Cover
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.rect(0, 0, W, 55, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RELATÓRIO DE DESPESAS", 15, 22);
  doc.setFontSize(20);
  doc.text("Combustível", 15, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(data.consultor_nome || "", 15, 44);

  doc.setTextColor(30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Período", 15, 70);
  doc.setFont("helvetica", "normal");
  doc.text(`${fmtDate(data.data_inicio)} até ${fmtDate(data.data_fim)}`, 15, 76);
  doc.text(`Tipo: ${data.tipo_periodo}`, 15, 82);

  doc.setDrawColor(220);
  doc.line(15, 90, W - 15, 90);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Resumo", 15, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Total de cupons: ${data.despesas.length}`, 15, 108);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.setFontSize(14);
  doc.text(`Valor total: ${fmtBRL(data.valor_total)}`, 15, 118);

  // Detail table
  doc.setTextColor(30);
  autoTable(doc, {
    startY: 130,
    head: [["#", "Data", "Valor"]],
    body: data.despesas.map((d, i) => [String(i + 1), fmtDate(d.data_despesa), fmtBRL(d.valor)]),
    headStyles: { fillColor: [GREEN[0], GREEN[1], GREEN[2]] as any, textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });

  // Photos: 2 per page
  const perPage = 2;
  for (let i = 0; i < data.despesas.length; i++) {
    if (i % perPage === 0) {
      doc.addPage();
      doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
      doc.rect(0, 0, W, 12, "F");
      doc.setTextColor(255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Cupons Fiscais", 15, 8);
      doc.setTextColor(30);
    }
    const slot = i % perPage;
    const yTop = 20 + slot * ((H - 30) / perPage);
    const d = data.despesas[i];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`#${i + 1} — ${fmtDate(d.data_despesa)} — ${fmtBRL(d.valor)}`, 15, yTop);
    const jpeg = await urlToJpeg(d.foto_cupom_url);
    if (jpeg) {
      const imgH = (H - 30) / perPage - 15;
      const imgW = W - 30;
      try {
        doc.addImage(jpeg, "JPEG", 15, yTop + 4, imgW, imgH, undefined, "FAST");
      } catch { /* ignore */ }
    }
  }

  // Footer on all pages
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${p} de ${total}`, W - 15, H - 8, { align: "right" });
    doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.text("Consubov · Consultoria", 15, H - 8);
  }

  return doc.output("blob");
}
