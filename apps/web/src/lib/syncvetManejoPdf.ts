import jsPDF from "jspdf";

const GREEN_DARK = "#14432B";
const GOLD = "#C9A84C";
const INK = "#1C1C1A";
const INK_SOFT = "#767066";
const LINE = "#E7E3D6";

export interface ManejoPdfAnimal {
  numero: string;
  categoria?: string | null;
  diagnostico?: "prenha" | "vazia" | "realizado" | null;
}

export interface ManejoPdfData {
  tipo: "dg_us" | "iatf" | "retirada";
  data: string; // yyyy-mm-dd
  empresa: string;
  fazenda: string;
  lote: string;
  responsavel: string;
  protocolo?: string | null;
  semen?: string | null;
  observacoes?: string | null;
  animais: ManejoPdfAnimal[];
}

function fmtDate(iso: string) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const TIPO_LABEL: Record<string, string> = {
  dg_us: "Diagnóstico de Gestação (DG/US)",
  iatf: "IATF",
  retirada: "Retirada de Protocolo",
};

export async function gerarManejoPDF(data: ManejoPdfData): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  let y = 40;

  const totalP = data.animais.filter(a => a.diagnostico === "prenha").length;
  const totalV = data.animais.filter(a => a.diagnostico === "vazia").length;
  const totalD = totalP + totalV;
  const taxa = totalD > 0 ? (totalP / totalD) * 100 : 0;

  // Cabeçalho
  doc.setFillColor(GREEN_DARK);
  doc.rect(0, 0, pageW, 90, "F");
  doc.setFillColor(GOLD);
  doc.rect(0, 90, pageW, 4, "F");

  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Relatório de Manejo", marginX, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(TIPO_LABEL[data.tipo] ?? data.tipo, marginX, 58);
  doc.text(`Data: ${fmtDate(data.data)}`, marginX, 74);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.empresa || "", pageW - marginX, 40, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Responsável: ${data.responsavel || "-"}`, pageW - marginX, 58, { align: "right" });

  y = 120;
  doc.setTextColor(INK);

  // Bloco de dados
  const rows: [string, string][] = [
    ["Fazenda", data.fazenda || "-"],
    ["Lote", data.lote || "-"],
  ];
  if (data.protocolo) rows.push(["Protocolo", data.protocolo]);
  if (data.semen) rows.push(["Sêmen", data.semen]);

  doc.setDrawColor(LINE);
  doc.setLineWidth(0.5);
  for (const [k, v] of rows) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(INK_SOFT);
    doc.text(k.toUpperCase(), marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(INK);
    doc.text(v, marginX + 90, y);
    y += 18;
  }

  y += 8;

  // Taxa de prenhez (DG/US)
  if (data.tipo === "dg_us") {
    doc.setFillColor(GREEN_DARK);
    doc.roundedRect(marginX, y, pageW - marginX * 2, 60, 6, 6, "F");
    doc.setTextColor("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("TAXA DE PRENHEZ", marginX + 16, y + 20);
    doc.setFontSize(28);
    doc.text(`${taxa.toFixed(1)}%`, marginX + 16, y + 48);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      `${totalP} prenhas / ${totalD} diagnosticadas`,
      pageW - marginX - 16,
      y + 34,
      { align: "right" }
    );
    y += 76;
  } else {
    doc.setFillColor(GREEN_DARK);
    doc.roundedRect(marginX, y, pageW - marginX * 2, 44, 6, 6, "F");
    doc.setTextColor("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("ANIMAIS ATENDIDOS", marginX + 16, y + 18);
    doc.setFontSize(22);
    doc.text(String(data.animais.length), marginX + 16, y + 38);
    y += 60;
  }

  // Tabela de animais
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("ANIMAIS", marginX, y);
  y += 14;

  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.text("Nº", marginX, y);
  doc.text("Categoria", marginX + 60, y);
  doc.text("Resultado", pageW - marginX, y, { align: "right" });
  y += 6;
  doc.setDrawColor(LINE);
  doc.line(marginX, y, pageW - marginX, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const a of data.animais) {
    if (y > pageH - 60) {
      doc.addPage();
      y = 40;
    }
    doc.setTextColor(INK);
    doc.text(a.numero || "-", marginX, y);
    doc.text(a.categoria || "-", marginX + 60, y);
    const label =
      a.diagnostico === "prenha" ? "Prenha" :
      a.diagnostico === "vazia" ? "Vazia" :
      a.diagnostico === "realizado" ? "Realizado" : "-";
    if (a.diagnostico === "prenha") doc.setTextColor(GREEN_DARK);
    else if (a.diagnostico === "vazia") doc.setTextColor("#B03A2E");
    else doc.setTextColor(INK);
    doc.text(label, pageW - marginX, y, { align: "right" });
    y += 14;
  }

  if (data.observacoes) {
    if (y > pageH - 100) { doc.addPage(); y = 40; }
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.text("OBSERVAÇÕES", marginX, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(data.observacoes, pageW - marginX * 2);
    doc.text(lines, marginX, y);
  }

  // Rodapé
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(INK_SOFT);
    doc.text("Gerado por Consubov.com.br", marginX, pageH - 20);
    doc.text(`Página ${i} de ${pages}`, pageW - marginX, pageH - 20, { align: "right" });
  }

  return doc.output("blob");
}
