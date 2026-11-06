import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { translatePdfLabel } from "@/lib/pdfUiLabels";
import type { SiteLanguage } from "@/lib/siteLanguage";

export interface PastoSalgaRow {
  nome: string;
  numAnimais: number;
  pesoMedioKg: number;
  sacosUtilizados: number;
  /** Number of "cocho cheio" launches (no salga) in the period */
  cochoCheio?: number;
  /** True when at least one launch in the period came from a QR Code scan */
  origemQr?: boolean;
  /** Optional consumption status: ABAIXO | IDEAL | ACIMA */
  status?: "ABAIXO" | "IDEAL" | "ACIMA" | string;
}

export interface SalgaPdfData {
  /** App display language; pt-BR is the compatible default. */
  language?: SiteLanguage;
  fazendaNome: string;
  retiroNome: string;
  periodoLabel: string;
  pastos: PastoSalgaRow[];
  /** Optional ISO range to display under the period label */
  rangeStartIso?: string | null;
  rangeEndIso?: string | null;
  /** Optional responsável (capataz/gerente nome) */
  responsavel?: string | null;
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

function fmtDate(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

/** Translate only known, author-controlled reporting periods. Keep file names and IDs unchanged. */
export function localizeSalgaPeriod(language: SiteLanguage, period: string): string {
  if (language !== "en-US") return period;
  const tr = (source: string) => translatePdfLabel(language, source);
  if (period === "Últimos 7 dias") return tr(period);
  if (period.startsWith("Última salga: ")) return `${tr("Última salga:")} ${period.slice("Última salga: ".length)}`;
  const month = /^(Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro) ([0-9]{4})$/.exec(period);
  return month ? `${tr(month[1])} ${month[2]}` : period;
}

export function gerarPdfSalga(data: SalgaPdfData): { blob: Blob; fileName: string } {
  const language = data.language ?? "pt-BR";
  const tr = (source: string) => translatePdfLabel(language, source);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // --- Header ---
  let y = 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(27, 67, 50); // #1B4332
  doc.text(`CONSUBOV — ${data.fazendaNome}`, margin, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(102, 102, 102);
  doc.text(`${tr("Retiro:")} ${data.retiroNome}`, margin, y);

  y += 5;
  doc.setFontSize(8);
  doc.text(`${tr("Período:")} ${localizeSalgaPeriod(language, data.periodoLabel)}`, margin, y);

  // Date range (since last sync)
  const startFmt = fmtDate(data.rangeStartIso);
  const endFmt = fmtDate(data.rangeEndIso);
  if (startFmt || endFmt) {
    y += 4;
    const rangeText = startFmt && endFmt
      ? `${tr("Intervalo:")} ${startFmt} → ${endFmt}`
      : startFmt
        ? `${tr("Desde:")} ${startFmt}`
        : `${tr("Até:")} ${endFmt}`;
    doc.text(rangeText, margin, y);
  }

  if (data.responsavel) {
    y += 4;
    doc.text(`${tr("Responsável:")} ${data.responsavel}`, margin, y);
  }

  y += 4;
  doc.text(`${tr("Gerado em:")} ${nowFormatted()}`, margin, y);

  y += 3;
  doc.setDrawColor(27, 67, 50);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);

  // --- Table ---
  y += 6;

  const totalAnimais = data.pastos.reduce((sum, p) => sum + p.numAnimais, 0);
  const totalSacos = data.pastos.reduce((sum, p) => sum + p.sacosUtilizados, 0);
  const totalCochoCheio = data.pastos.reduce((sum, p) => sum + (p.cochoCheio ?? 0), 0);
  const fmtSacos = (p: PastoSalgaRow) => {
    const c = p.cochoCheio ?? 0;
    if (c > 0 && p.sacosUtilizados === 0) return "C";
    if (c > 0) return `${p.sacosUtilizados} + C`;
    return String(p.sacosUtilizados);
  };

  const hasStatusCol = data.pastos.some((p) => !!p.status);

  const headColumns = ["Pasto", "Nº Animais", "Peso Médio (kg)", "Sacos"].map(tr);
  const head = hasStatusCol ? [[...headColumns, tr("Status")]] : [headColumns];

  const tableBody = data.pastos.map((p) => {
    const base = [
      p.origemQr ? `\u2713 ${p.nome}` : p.nome,
      String(p.numAnimais),
      `${p.pesoMedioKg.toFixed(1)}`,
      fmtSacos(p),
    ];
    if (hasStatusCol) base.push(p.status ? tr(p.status) : "—");
    return base;
  });

  // Totals row
  const totalRow = [
    "TOTAL",
    String(totalAnimais),
    "—",
    totalCochoCheio > 0 ? `${totalSacos}${tr(" sacos · ")}${totalCochoCheio}${tr(" cocho cheio")}` : String(totalSacos),
  ];
  if (hasStatusCol) totalRow.push("—");
  tableBody.push(totalRow);

  autoTable(doc, {
    startY: y,
    head,
    body: tableBody,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [22, 101, 52],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    bodyStyles: { fontSize: 9, halign: "center" },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    didParseCell: (hookData) => {
      const { row, cell, column } = hookData;
      const isLastRow = row.section === "body" && row.index === tableBody.length - 1;
      if (isLastRow) {
        cell.styles.fillColor = [27, 67, 50];
        cell.styles.textColor = [255, 255, 255];
        cell.styles.fontStyle = "bold";
        cell.styles.halign = "center";
        return;
      }
      // Color status cell
      if (hasStatusCol && row.section === "body" && column.index === 4) {
        // Colors must use the original business status, not its translated display copy.
        const txt = String(data.pastos[row.index]?.status || "").toUpperCase();
        if (txt === "ABAIXO") {
          cell.styles.fillColor = [254, 226, 226]; // light red
          cell.styles.textColor = [153, 27, 27];
          cell.styles.fontStyle = "bold";
        } else if (txt === "IDEAL") {
          cell.styles.fillColor = [220, 252, 231];
          cell.styles.textColor = [22, 101, 52];
          cell.styles.fontStyle = "bold";
        } else if (txt === "ACIMA") {
          cell.styles.fillColor = [254, 243, 199];
          cell.styles.textColor = [146, 64, 14];
          cell.styles.fontStyle = "bold";
        }
      }
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
      doc.text(`${tr("Gerado por: Consubov")}  |  \u2713 = ${tr("lancado via QR Code")}`, margin, pageHeight - 8);
      doc.text(nowFormatted(), pageWidth - margin, pageHeight - 8, { align: "right" });
    },
  });

  // Filename
  const safeFazenda = data.fazendaNome.replace(/\s+/g, "_").toUpperCase().replace(/[^A-Z0-9_]/g, "");
  const safePeriodo = data.periodoLabel.replace(/[^a-zA-Z0-9-]/g, "_");
  const fileName = `SALGA_${safeFazenda}_${safePeriodo}.pdf`;

  const blob = doc.output("blob");
  return { blob, fileName };
}
