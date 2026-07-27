import type jsPDF from "jspdf";

const GREEN_DARK = "#14432B";
const GOLD = "#C9A84C";
const INK = "#1C1C1A";
const INK_SOFT = "#767066";
const LINE = "#E7E3D6";

export interface SampleSeries {
  fezes: number[];
  corporal: number[];
  bebedouro: number[];
}

function drawPageHeader(doc: jsPDF, fazendaNome: string) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(fazendaNome || "", 15, 12);
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.3);
  doc.line(15, 16, pageW - 15, 16);
}

/**
 * Desenha um gráfico de linha (amostras individuais 1..N no eixo X, notas 1..5 no eixo Y)
 * em sua própria página. Retorna false se não houver amostras — caller pula addPage.
 */
export function drawSampleLineChartPage(
  doc: jsPDF, fazendaNome: string, title: string, samples: number[],
): boolean {
  const filtered = samples.filter(n => Number.isFinite(n) && n > 0);
  if (filtered.length === 0) return false;

  const pageW = doc.internal.pageSize.getWidth();
  drawPageHeader(doc, fazendaNome);

  doc.setTextColor(GREEN_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 15, 26);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.text(`Total de amostras: ${filtered.length}`, 15, 32);

  const chartX = 25;
  const chartY = 45;
  const chartW = pageW - 50;
  const chartH = 130;

  // Y grid + labels (0..5)
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.3);
  doc.setFontSize(7);
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "normal");
  for (let n = 0; n <= 5; n++) {
    const gy = chartY + chartH - (chartH * n) / 5;
    doc.line(chartX, gy, chartX + chartW, gy);
    doc.text(String(n), chartX - 2, gy + 1, { align: "right" });
  }

  // Eixo X — se poucos pontos, distribui; se muitos, ainda ocupa toda largura
  const n = filtered.length;
  const stepX = n > 1 ? chartW / (n - 1) : 0;
  const pointX = (i: number) => n === 1 ? chartX + chartW / 2 : chartX + i * stepX;
  const pointY = (v: number) => chartY + chartH - (chartH * v) / 5;

  // Linha
  doc.setDrawColor(GREEN_DARK);
  doc.setLineWidth(0.6);
  for (let i = 0; i < n - 1; i++) {
    doc.line(pointX(i), pointY(filtered[i]), pointX(i + 1), pointY(filtered[i + 1]));
  }

  // Pontos
  doc.setFillColor(GOLD);
  for (let i = 0; i < n; i++) {
    doc.circle(pointX(i), pointY(filtered[i]), 1.2, "F");
  }

  // Marcações no eixo X — mostra alguns rótulos (1, N/4, N/2, 3N/4, N)
  const labelIdx = new Set<number>();
  labelIdx.add(0);
  labelIdx.add(n - 1);
  if (n >= 5) {
    labelIdx.add(Math.floor(n / 4));
    labelIdx.add(Math.floor(n / 2));
    labelIdx.add(Math.floor((3 * n) / 4));
  }
  doc.setFontSize(7);
  doc.setTextColor(INK_SOFT);
  for (const i of labelIdx) {
    doc.text(String(i + 1), pointX(i), chartY + chartH + 5, { align: "center" });
  }

  // Legenda
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Amostra (nº sequencial)", pageW / 2, chartY + chartH + 12, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.text(
    "Cada ponto representa uma amostra individual registrada durante a visita, na ordem de lançamento.",
    pageW / 2, chartY + chartH + 20, { align: "center" },
  );
  return true;
}

/**
 * Cria até 3 páginas (uma para cada tipo com amostras).
 */
export function drawAllSampleChartPages(doc: jsPDF, fazendaNome: string, series: SampleSeries) {
  const specs: [string, number[]][] = [
    ["Escore de Fezes — Amostras Individuais", series.fezes || []],
    ["Escore Corporal — Amostras Individuais", series.corporal || []],
    ["Condição de Bebedouro — Amostras Individuais", series.bebedouro || []],
  ];
  for (const [title, samples] of specs) {
    if ((samples || []).filter(n => Number.isFinite(n) && n > 0).length === 0) continue;
    doc.addPage();
    drawSampleLineChartPage(doc, fazendaNome, title, samples);
  }
}
