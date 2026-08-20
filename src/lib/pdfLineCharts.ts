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
  const chartW = pageW - 55;
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
    doc.text(String(Math.round((maxY * i) / 5)), chartX - 2, gy + 1, { align: "right" });
  }

  const px = (i: number) => (n === 1 ? chartX + chartW / 2 : chartX + (i * chartW) / (n - 1));
  const py = (v: number) => chartY + chartH - (chartH * Math.max(0, v)) / maxY;

  const fmt = (v: number) =>
    Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const drawSerie = (values: number[], color: string, above: boolean, other: number[]) => {
    doc.setDrawColor(color);
    doc.setLineWidth(0.7);
    for (let i = 0; i < n - 1; i++) doc.line(px(i), py(values[i]), px(i + 1), py(values[i + 1]));
    doc.setFillColor(color);
    for (let i = 0; i < n; i++) doc.circle(px(i), py(values[i]), 1.2, "F");
    // rótulos de valor em cada ponto
    doc.setFont("helvetica", "bold");
    doc.setFontSize(n > 8 ? 5 : 6);
    doc.setTextColor(color);
    for (let i = 0; i < n; i++) {
      const y0 = py(values[i]);
      const close = Math.abs(y0 - py(other[i])) < 6;
      const extra = close ? 3.5 : 0;
      const ly = above
        ? Math.max(chartY + 3, y0 - 2.6 - extra)
        : Math.min(chartY + chartH - 1, y0 + 4.4 + extra);
      doc.text(fmt(values[i]), px(i), ly, { align: "center" });
    }
  };
  drawSerie(serieA.values, GREEN_DARK, true, serieB.values);
  drawSerie(serieB.values, GOLD, false, serieA.values);

  // rótulos X (identificação do pasto)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(n > 8 ? 5.5 : 6.5);
  doc.setTextColor(INK);
  const rotate = n > 5 || labels.some(l => (l || "").length > 8);
  for (let i = 0; i < n; i++) {
    const txt = labels[i] || String(i + 1);
    if (rotate) {
      doc.text(txt, px(i) + 1.5, chartY + chartH + 4, { angle: 45, align: "right" });
    } else {
      doc.text(txt, px(i), chartY + chartH + 5, { align: "center" });
    }
  }

  const labelOffset = rotate ? 26 : 12;
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
