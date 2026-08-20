import type jsPDF from "jspdf";

const GREEN_DARK = "#14432B";
const GOLD = "#C9A84C";
const INK = "#1C1C1A";
const INK_SOFT = "#767066";
const LINE = "#E7E3D6";

export type SampleChartKind = "lines" | "bars" | "pie" | "radar";

export interface SampleSeries {
  fezes: number[];
  corporal: number[];
  bebedouro: number[];
}

export interface SampleChartTypes {
  fezes?: SampleChartKind;
  corporal?: SampleChartKind;
  bebedouro?: SampleChartKind;
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

function drawYGrid(doc: jsPDF, chartX: number, chartY: number, chartW: number, chartH: number) {
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
}

function drawLegend(doc: jsPDF, pageW: number, chartY: number, chartH: number, kind: SampleChartKind) {
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const centerLabel =
    kind === "pie" || kind === "radar" ? "Distribuição das notas (1 a 5)" : "Amostra (nº sequencial)";
  doc.text(centerLabel, pageW / 2, chartY + chartH + 12, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  const hint =
    kind === "pie" || kind === "radar"
      ? "Cada segmento/vértice mostra quantas amostras receberam a nota indicada."
      : "Cada ponto/barra representa uma amostra individual, na ordem de lançamento.";
  doc.text(hint, pageW / 2, chartY + chartH + 20, { align: "center" });
}

function drawLinesChart(doc: jsPDF, chartX: number, chartY: number, chartW: number, chartH: number, values: number[]) {
  drawYGrid(doc, chartX, chartY, chartW, chartH);
  const n = values.length;
  const stepX = n > 1 ? chartW / (n - 1) : 0;
  const pointX = (i: number) => (n === 1 ? chartX + chartW / 2 : chartX + i * stepX);
  const pointY = (v: number) => chartY + chartH - (chartH * v) / 5;

  doc.setDrawColor(GREEN_DARK);
  doc.setLineWidth(0.6);
  for (let i = 0; i < n - 1; i++) {
    doc.line(pointX(i), pointY(values[i]), pointX(i + 1), pointY(values[i + 1]));
  }
  doc.setFillColor(GOLD);
  for (let i = 0; i < n; i++) doc.circle(pointX(i), pointY(values[i]), 1.2, "F");

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
  for (const i of labelIdx) doc.text(String(i + 1), pointX(i), chartY + chartH + 5, { align: "center" });
}

function drawBarsChart(doc: jsPDF, chartX: number, chartY: number, chartW: number, chartH: number, values: number[]) {
  drawYGrid(doc, chartX, chartY, chartW, chartH);
  const n = values.length;
  const gap = n <= 20 ? 2 : 0.6;
  const barW = Math.max(0.8, (chartW - gap * (n + 1)) / n);
  doc.setFillColor(GOLD);
  for (let i = 0; i < n; i++) {
    const bx = chartX + gap + i * (barW + gap);
    const bh = (chartH * values[i]) / 5;
    const by = chartY + chartH - bh;
    doc.rect(bx, by, barW, bh, "F");
  }
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
    const bx = chartX + gap + i * (barW + gap) + barW / 2;
    doc.text(String(i + 1), bx, chartY + chartH + 5, { align: "center" });
  }
}

function bucketByNota(values: number[]): number[] {
  const buckets = [0, 0, 0, 0, 0];
  for (const v of values) {
    const n = Math.round(v);
    if (n >= 1 && n <= 5) buckets[n - 1] += 1;
  }
  return buckets;
}

function drawPieChart(doc: jsPDF, pageW: number, chartY: number, chartH: number, values: number[]) {
  const cx = pageW / 2;
  const cy = chartY + chartH / 2;
  const r = Math.min(chartH / 2 - 6, 55);
  const buckets = bucketByNota(values);
  const total = buckets.reduce((s, v) => s + v, 0);
  const palette = ["#8A6D2E", "#C9A84C", "#1F7A4D", "#14432B", "#4C8C68"];
  if (total <= 0) {
    doc.setDrawColor(LINE);
    doc.circle(cx, cy, r, "S");
    return;
  }
  let acc = -Math.PI / 2;
  const steps = 60;
  buckets.forEach((count, idx) => {
    const frac = count / total;
    if (frac <= 0) return;
    const end = acc + frac * Math.PI * 2;
    const pts: [number, number][] = [[cx, cy]];
    const n = Math.max(2, Math.ceil(steps * frac));
    for (let i = 0; i <= n; i++) {
      const a = acc + (end - acc) * (i / n);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    doc.setFillColor(palette[idx % palette.length]);
    const lines: [number, number][] = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
    (doc as any).lines(lines, pts[0][0], pts[0][1], [1, 1], "F", true);
    const mid = (acc + end) / 2;
    const lx = cx + Math.cos(mid) * (r + 10);
    const ly = cy + Math.sin(mid) * (r + 10);
    doc.setFontSize(8);
    doc.setTextColor(INK);
    doc.setFont("helvetica", "bold");
    doc.text(`Nota ${idx + 1}: ${count}`, lx, ly, { align: "center" });
    acc = end;
  });
}

function drawRadarChart(doc: jsPDF, pageW: number, chartY: number, chartH: number, values: number[]) {
  const cx = pageW / 2;
  const cy = chartY + chartH / 2;
  const r = Math.min(chartH / 2 - 10, 55);
  const buckets = bucketByNota(values);
  const max = Math.max(1, ...buckets);
  const N = 5;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.3);
  for (let g = 1; g <= 5; g++) {
    const rr = (r * g) / 5;
    const pts: [number, number][] = [];
    for (let i = 0; i < N; i++) pts.push([cx + Math.cos(angle(i)) * rr, cy + Math.sin(angle(i)) * rr]);
    for (let i = 0; i < N; i++) {
      const a = pts[i]; const b = pts[(i + 1) % N];
      doc.line(a[0], a[1], b[0], b[1]);
    }
  }
  for (let i = 0; i < N; i++) {
    const ax = cx + Math.cos(angle(i)) * r;
    const ay = cy + Math.sin(angle(i)) * r;
    doc.line(cx, cy, ax, ay);
    const lx = cx + Math.cos(angle(i)) * (r + 10);
    const ly = cy + Math.sin(angle(i)) * (r + 10);
    doc.setFontSize(8);
    doc.setTextColor(INK);
    doc.setFont("helvetica", "bold");
    doc.text(`Nota ${i + 1} (${buckets[i]})`, lx, ly, { align: "center", baseline: "middle" });
  }
  const dpts: [number, number][] = buckets.map((v, i) => {
    const rr = (r * v) / max;
    return [cx + Math.cos(angle(i)) * rr, cy + Math.sin(angle(i)) * rr];
  });
  const rel: [number, number][] = dpts.slice(1).map((p, i) => [p[0] - dpts[i][0], p[1] - dpts[i][1]]);
  rel.push([dpts[0][0] - dpts[dpts.length - 1][0], dpts[0][1] - dpts[dpts.length - 1][1]]);
  doc.setFillColor(GOLD);
  (doc as any).lines(rel, dpts[0][0], dpts[0][1], [1, 1], "F", true);
}

export function drawSampleLineChartPage(
  doc: jsPDF, fazendaNome: string, title: string, samples: number[], kind: SampleChartKind = "lines",
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

  if (kind === "bars") drawBarsChart(doc, chartX, chartY, chartW, chartH, filtered);
  else if (kind === "pie") drawPieChart(doc, pageW, chartY, chartH, filtered);
  else if (kind === "radar") drawRadarChart(doc, pageW, chartY, chartH, filtered);
  else drawLinesChart(doc, chartX, chartY, chartW, chartH, filtered);

  drawLegend(doc, pageW, chartY, chartH, kind);
  return true;
}

/**
 * Cria até 3 páginas (uma para cada tipo com amostras).
 * Cada tipo pode ter seu próprio tipo de gráfico (bars/lines/pie/radar).
 */
export function drawAllSampleChartPages(
  doc: jsPDF,
  fazendaNome: string,
  series: SampleSeries,
  kinds?: SampleChartTypes,
  options?: { skipFezes?: boolean },
) {
  const specs: [string, number[], SampleChartKind][] = [
    ...(options?.skipFezes ? [] : ([["Escore de Fezes — Amostras Individuais", series.fezes || [], kinds?.fezes || "lines"]] as [string, number[], SampleChartKind][])),
    ["Escore Corporal — Amostras Individuais", series.corporal || [], kinds?.corporal || "lines"],
    ["Condição de Bebedouro — Amostras Individuais", series.bebedouro || [], kinds?.bebedouro || "lines"],
  ];
  for (const [title, samples, kind] of specs) {
    if ((samples || []).filter(n => Number.isFinite(n) && n > 0).length === 0) continue;
    doc.addPage();
    drawSampleLineChartPage(doc, fazendaNome, title, samples, kind);
  }
}

/**
 * Escore de fezes agrupado por categoria de dieta: um gráfico por categoria distinta.
 * O título do gráfico é o nome da categoria.
 */
export function drawFezesCategoriaChartPages(
  doc: jsPDF,
  fazendaNome: string,
  groups: { categoria: string; samples: number[] }[],
  kind: SampleChartKind = "lines",
) {
  for (const g of groups) {
    if ((g.samples || []).filter(n => Number.isFinite(n) && n > 0).length === 0) continue;
    doc.addPage();
    drawSampleLineChartPage(doc, fazendaNome, `Escore de Fezes - Amostras / ${g.categoria}`, g.samples, kind);
  }
}


/**
 * Gráfico de linha com DUAS séries (ex.: Consumo Real x Esperado por pasto).
 * Reaproveita o mesmo motor/estilo dos gráficos de amostras.
 * Retorna false se não houver pelo menos 2 pontos válidos.
 */
export function drawDualLineChartPage(
  doc: jsPDF,
  fazendaNome: string,
  title: string,
  labels: string[],
  serieA: { name: string; values: number[] },
  serieB: { name: string; values: number[] },
  axisLabel = "Pasto",
): boolean {
  const n = Math.min(labels.length, serieA.values.length, serieB.values.length);
  if (n < 2) return false;

  const pageW = doc.internal.pageSize.getWidth();
  drawPageHeader(doc, fazendaNome);

  doc.setTextColor(GREEN_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 15, 26);

  const chartX = 30;
  const chartY = 45;
  // margem direita maior para o último rótulo não ser cortado
  const chartW = pageW - 30 - 26;
  const chartH = 120;

  const all = [...serieA.values.slice(0, n), ...serieB.values.slice(0, n)];
  const rawMax = Math.max(...all, 1);
  const maxY = Math.ceil(rawMax / 5) * 5 || 5;

  // grade Y
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.3);
  doc.setFontSize(7);
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "normal");
  for (let i = 0; i <= 5; i++) {
    const gy = chartY + chartH - (chartH * i) / 5;
    doc.line(chartX, gy, chartX + chartW, gy);
    doc.text(String(Math.round((maxY * i) / 5)), chartX - 4, gy + 1, { align: "right" });
  }

  const px = (i: number) => (n === 1 ? chartX + chartW / 2 : chartX + (i * chartW) / (n - 1));
  const py = (v: number) => chartY + chartH - (chartH * Math.max(0, v)) / maxY;

  const fmt = (v: number) =>
    Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  // Desenha as linhas primeiro; os rótulos vêm DEPOIS (ficam na frente).
  const drawLine = (values: number[], color: string) => {
    doc.setDrawColor(color);
    doc.setLineWidth(0.7);
    for (let i = 0; i < n - 1; i++) doc.line(px(i), py(values[i]), px(i + 1), py(values[i + 1]));
    doc.setFillColor(color);
    for (let i = 0; i < n; i++) doc.circle(px(i), py(values[i]), 1.2, "F");
  };
  drawLine(serieA.values, GREEN_DARK);
  drawLine(serieB.values, GOLD);

  // Rótulos de valor com fundo branco (halo), sempre na frente das linhas.
  const valFont = n > 8 ? 5 : 6;
  const drawValueLabel = (text: string, cx: number, cy: number, color: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(valFont);
    const w = doc.getTextWidth(text) + 1.6;
    const h = valFont * 0.42 + 1.4;
    doc.setFillColor("#FFFFFF");
    doc.rect(cx - w / 2, cy - h + 1, w, h, "F");
    doc.setTextColor(color);
    doc.text(text, cx, cy, { align: "center" });
  };

  for (let i = 0; i < n; i++) {
    const ya = py(serieA.values[i]);
    const yb = py(serieB.values[i]);
    // alterna posição quando os dois rótulos ficariam muito próximos
    const close = Math.abs(ya - yb) < 7;
    const aAbove = close ? ya <= yb : true;
    const bAbove = close ? !aAbove : false;
    const posY = (y0: number, above: boolean) =>
      above ? Math.max(chartY + 3.5, y0 - 2.8) : Math.min(chartY + chartH - 0.8, y0 + 4.6);
    drawValueLabel(fmt(serieA.values[i]), px(i), posY(ya, aAbove), GREEN_DARK);
    drawValueLabel(fmt(serieB.values[i]), px(i), posY(yb, bAbove), GOLD);
  }

  // rótulos X — compactos, sem sobreposição, com linha conectora (leader line)
  const xFont = n > 10 ? 5 : n > 6 ? 5.5 : 6.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(xFont);
  const texts = Array.from({ length: n }, (_, i) => labels[i] || String(i + 1));
  const widths = texts.map(t => doc.getTextWidth(t));
  const spacing = n > 1 ? chartW / (n - 1) : chartW;
  const maxW = Math.max(...widths);
  // modo: 0 = uma linha, 1 = duas linhas alternadas, 2 = rotacionado 45°
  const mode = maxW + 1.5 <= spacing ? 0 : maxW + 1.5 <= spacing * 2 ? 1 : 2;
  const axisY = chartY + chartH;
  const rowGap = 4.2;

  doc.setDrawColor("#B9B3A5");
  doc.setLineWidth(0.2);
  for (let i = 0; i < n; i++) {
    const x = px(i);
    if (mode === 2) {
      doc.line(x, axisY, x, axisY + 3);
      doc.setTextColor(INK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(xFont);
      doc.text(texts[i], x + 1.2, axisY + 4.5, { angle: 45, align: "right" });
    } else {
      const row = mode === 1 ? i % 2 : 0;
      const ly = axisY + 4.5 + row * rowGap;
      doc.line(x, axisY, x, ly - 2.6); // conector do ponto até o rótulo
      doc.setTextColor(INK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(xFont);
      doc.text(texts[i], x, ly, { align: "center" });
    }
  }

  const labelOffset = mode === 2 ? 26 : mode === 1 ? 14 : 11;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(INK);
  doc.text(axisLabel, pageW / 2, chartY + chartH + labelOffset, { align: "center" });

  // legenda
  const legY = chartY + chartH + labelOffset + 10;
  const items: [string, string][] = [[serieA.name, GREEN_DARK], [serieB.name, GOLD]];
  const boxW = 60;
  const startX = pageW / 2 - (items.length * boxW) / 2;
  items.forEach(([label, color], i) => {
    const lx = startX + i * boxW;
    doc.setFillColor(color);
    doc.rect(lx, legY - 3, 6, 3, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(INK);
    doc.text(label, lx + 9, legY);
  });

  doc.setFontSize(7);
  doc.setTextColor(INK_SOFT);
  doc.text("Valores em g/cab/dia por pasto avaliado.", pageW / 2, legY + 7, { align: "center" });
  return true;
}

