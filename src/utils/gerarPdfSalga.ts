import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PastoSalgaRow {
  nome: string;
  numAnimais: number;
  pesoMedioKg: number;
  sacosUtilizados: number;
}

export interface SalgaPdfData {
  fazendaNome: string;
  retiroNome: string;
  periodoLabel: string;
  pastos: PastoSalgaRow[];
}

function nowFormatted(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export function gerarPdfSalga(data: SalgaPdfData): { blob: Blob; fileName: string } {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // --- Header (same pattern as pesagem/consumo) ---
  let y = 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(27, 67, 50); // #1B4332
  doc.text(`CONSUBOV — ${data.fazendaNome}`, margin, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(102, 102, 102);
  doc.text(`Retiro: ${data.retiroNome}`, margin, y);

  y += 5;
  doc.setFontSize(8);
  doc.text(`Período: ${data.periodoLabel}`, margin, y);

  y += 4;
  doc.text(`Gerado em: ${nowFormatted()}`, margin, y);

  y += 3;
  doc.setDrawColor(27, 67, 50);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);

  // --- Table ---
  y += 6;

  const tableBody = data.pastos.map((p) => [
    p.nome,
    String(p.numAnimais),
    `${p.pesoMedioKg.toFixed(1)}`,
    String(p.sacosUtilizados),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Pasto", "Nº de Animais", "Peso Médio (kg)", "Sacos Utilizados"]],
    body: tableBody,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [22, 101, 52], // #166534
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 9,
      halign: "center",
    },
    alternateRowStyles: {
      fillColor: [240, 253, 244], // #F0FDF4
    },
    styles: {
      cellPadding: 3,
      lineWidth: 0.1,
      lineColor: [200, 200, 200],
    },
    didDrawPage: () => {
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "normal");
      doc.text("Gerado por: Consubov", margin, pageHeight - 8);
      doc.text(nowFormatted(), pageWidth - margin, pageHeight - 8, { align: "right" });
    },
  });

  // Build filename
  const safeFazenda = data.fazendaNome.replace(/\s+/g, "_").toUpperCase().replace(/[^A-Z0-9_]/g, "");
  const fileName = `SALGA_${safeFazenda}_${data.periodoLabel.replace(/[^a-zA-Z0-9\-]/g, "_")}.pdf`;

  const blob = doc.output("blob");
  return { blob, fileName };
}
