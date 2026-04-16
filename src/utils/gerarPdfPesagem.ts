import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface AnimalPesagem {
  id: string;
  numero: number;
  pesoKg: number;
}

export interface PesagemPdfData {
  pesagemId: string;
  fazendaNome: string;
  retiroNome: string;
  pastoNome: string;
  dataPesagem: string; // ISO
  horaFinalizacao: string; // HH:mm
  responsavelNome: string;
  animais: AnimalPesagem[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
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

export function gerarPdfPesagem(data: PesagemPdfData): { blob: Blob; fileName: string } {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // --- Calculations ---
  const pesoTotalKg = data.animais.reduce((sum, a) => sum + a.pesoKg, 0);
  const totalAnimais = data.animais.length;
  const pesoMedioKg = totalAnimais > 0 ? pesoTotalKg / totalAnimais : 0;
  const pesoMedioArroba = pesoMedioKg / 30;
  const pesoTotalArroba = pesoTotalKg / 30;

  // --- Header ---
  doc.setFillColor(27, 67, 50); // #1B4332
  doc.rect(0, 0, pageWidth, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("CONSUBOV", pageWidth / 2, 16, { align: "center" });
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório de Pesagem", pageWidth / 2, 28, { align: "center" });

  // --- Identification Block ---
  let y = 46;
  doc.setFillColor(249, 250, 251); // #F9FAFB
  doc.roundedRect(margin, y, pageWidth - margin * 2, 42, 2, 2, "F");
  doc.setTextColor(55, 65, 81);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const colLeft = margin + 5;
  const colRight = pageWidth / 2 + 5;
  const lineH = 6;

  const labels = [
    { label: "Fazenda:", value: data.fazendaNome, x: colLeft },
    { label: "Retiro:", value: data.retiroNome, x: colRight },
    { label: "Pasto:", value: data.pastoNome, x: colLeft },
    { label: "Data:", value: formatDate(data.dataPesagem), x: colRight },
    { label: "Hora Finalização:", value: data.horaFinalizacao, x: colLeft },
    { label: "Responsável:", value: data.responsavelNome, x: colRight },
  ];

  let row = 0;
  for (let i = 0; i < labels.length; i += 2) {
    const yLine = y + 8 + row * lineH;
    for (let j = 0; j < 2 && i + j < labels.length; j++) {
      const item = labels[i + j];
      doc.setFont("helvetica", "bold");
      doc.text(item.label, item.x, yLine);
      doc.setFont("helvetica", "normal");
      doc.text(item.value, item.x + doc.getTextWidth(item.label) + 2, yLine);
    }
    row++;
  }

  // --- Summary Block (2x2 grid) ---
  y += 50;
  const boxW = (pageWidth - margin * 2 - 6) / 2;
  const boxH = 20;

  const summaryItems = [
    { label: "Qtd. Animais", value: String(totalAnimais) },
    { label: "Peso Médio", value: `${pesoMedioKg.toFixed(1)} kg (${pesoMedioArroba.toFixed(2)} @)` },
    { label: "Peso Total", value: `${pesoTotalKg.toFixed(1)} kg (${pesoTotalArroba.toFixed(2)} @)` },
    { label: "Média por Arroba", value: `${pesoMedioArroba.toFixed(2)} @` },
  ];

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const rowIdx = Math.floor(i / 2);
    const bx = margin + col * (boxW + 6);
    const by = y + rowIdx * (boxH + 4);
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(bx, by, boxW, boxH, 1, 1, "FD");
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(summaryItems[i].label, bx + 4, by + 7);
    doc.setTextColor(27, 67, 50);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(summaryItems[i].value, bx + 4, by + 15);
  }

  // --- Animals Table ---
  y += 2 * (boxH + 4) + 8;

  const tableBody = data.animais.map((a) => [
    String(a.numero),
    `${a.pesoKg.toFixed(1)}`,
    `${(a.pesoKg / 30).toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Nº Animal", "Peso (kg)", "Peso (@)"]],
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
      // Footer on every page
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "normal");
      doc.text("Gerado por: Consubov", margin, pageHeight - 8);
      doc.text(nowFormatted(), pageWidth - margin, pageHeight - 8, { align: "right" });
    },
  });

  // Sanitize filename
  const safePastoNome = data.pastoNome.replace(/[^a-zA-Z0-9]/g, "_");
  const dateStr = formatDate(data.dataPesagem).replace(/\//g, "-");
  const fileName = `pesagem_${safePastoNome}_${dateStr}.pdf`;

  const blob = doc.output("blob");
  return { blob, fileName };
}
