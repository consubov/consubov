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
  legenda?: { letra: string; nome: string }[],
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
  // Mantém o conjunto gráfico + referência dentro de uma altura previsível.
  const chartH = 108;

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
    const tickVal = (maxY * i) / 5;
    const tickTxt = maxY >= 10
      ? String(Math.round(tickVal))
      : (Number.isInteger(Number(tickVal.toFixed(1))) ? String(Number(tickVal.toFixed(1))) : tickVal.toFixed(1).replace(".", ","));
    doc.text(tickTxt, chartX - 4, gy + 1, { align: "right" });
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

  const axisY = chartY + chartH;
  const letterY = axisY + 6;

  // Linhas guia tracejadas: de cada ponto até a letra, na cor da própria série.
  const drawLeaders = (values: number[], color: string) => {
    doc.setDrawColor(color);
    doc.setLineWidth(0.25);
    (doc as any).setLineDashPattern?.([0.8, 0.8], 0);
    for (let i = 0; i < n; i++) doc.line(px(i), py(values[i]) + 1.6, px(i), letterY - 3.4);
    (doc as any).setLineDashPattern?.([], 0);
  };
  drawLeaders(serieA.values, GREEN_DARK);
  drawLeaders(serieB.values, GOLD);

  // Rótulos de valor com halo branco, centralizados no ponto; maior acima, menor abaixo.
  const valFont = n > 8 ? 5 : 6;
  const drawValueLabel = (text: string, cx: number, cy: number, color: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(valFont);
    const w = doc.getTextWidth(text) + 2.4;
    const h = valFont * 0.5 + 1.8;
    doc.setFillColor("#FFFFFF");
    doc.rect(cx - w / 2, cy - h + 1.2, w, h, "F");
    doc.setTextColor(color);
    doc.text(text, cx, cy, { align: "center" });
  };

  for (let i = 0; i < n; i++) {
    const va = Number(serieA.values[i]);
    const vb = Number(serieB.values[i]);
    const aAbove = va >= vb;
    const posY = (y0: number, above: boolean) =>
      above ? Math.max(chartY + 3.5, y0 - 2.8) : Math.min(chartY + chartH - 0.8, y0 + 5);
    drawValueLabel(fmt(va), px(i), posY(py(va), aAbove), GREEN_DARK);
    drawValueLabel(fmt(vb), px(i), posY(py(vb), !aAbove), GOLD);
  }

  // Eixo X — apenas as letras
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(INK);
  for (let i = 0; i < n; i++) doc.text(labels[i] || String(i + 1), px(i), letterY, { align: "center" });

  const labelOffset = 13;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(INK);
  doc.text(axisLabel, pageW / 2, chartY + chartH + labelOffset, { align: "center" });

  // legenda das séries
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

  // Tabela de referência letra -> pasto
  const ref = (legenda || []).filter(r => r && r.letra);
  if (ref.length > 0) {
    let ty = legY + 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(GREEN_DARK);
    doc.text("Referência dos Pastos", 15, ty);
    ty += 5;

    // Acima de 16 pastos, usa três colunas para limitar o crescimento vertical.
    const columns = ref.length > 16 ? 3 : 2;
    const colW = (pageW - 30) / columns;
    const rows = Math.ceil(ref.length / columns);
    const rowH = 5;
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.2);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const idx = c * rows + r;
        if (idx >= ref.length) continue;
        const x = 15 + c * colW;
        const yy = ty + r * rowH;
        doc.setFillColor(r % 2 === 0 ? "#FAF8F2" : "#FFFFFF");
        doc.rect(x, yy - 3.8, colW - 3, 4.7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(columns === 3 ? 6.5 : 7.5);
        doc.setTextColor(GREEN_DARK);
        doc.text(ref[idx].letra, x + 2, yy);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(INK);
        const maxChars = columns === 3 ? 25 : 48;
        doc.text(String(ref[idx].nome || "").slice(0, maxChars), x + 8, yy);
      }
    }
  }
  return true;
}



/* ==========================================================================
 * Confinamento (Curral): página única com
 *  - Gráfico 1: linha da média do escore de fezes por curral
 *  - Gráfico 2: barras empilhadas horizontais (% escore 1..5 por curral)
 *  - Tabela de apoio (percentual e contagem por curral + total)
 * ========================================================================== */

const ESC_COLORS: Record<number, string> = {
  1: "#8E44AD",
  2: "#2F6FB2",
  3: "#1F7A4D",
  4: "#D98324",
  5: "#B03A2E",
};
const ESC_ALL = [1, 2, 3, 4, 5];

export interface CurralFezesInput {
  num_curral: string;
  samples: number[];
}

const fmt1 = (v: number) =>
  Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function drawCurralFezesDistribuicaoPage(
  doc: jsPDF,
  fazendaNome: string,
  currais: CurralFezesInput[],
): boolean {
  const rows = currais
    .map(c => {
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const s of c.samples || []) {
        const n = Math.round(Number(s));
        if (n >= 1 && n <= 5) counts[n] += 1;
      }
      const total = ESC_ALL.reduce((a, k) => a + counts[k], 0);
      const media = total > 0 ? ESC_ALL.reduce((a, k) => a + counts[k] * k, 0) / total : 0;
      return { label: c.num_curral || "?", counts, total, media };
    })
    .filter(r => r.total > 0);

  if (rows.length === 0) return false;

  // escores presentes em pelo menos uma amostra da visita
  const escoresAtivos = ESC_ALL.filter(k => rows.some(r => r.counts[k] > 0));

  const pageW = doc.internal.pageSize.getWidth();
  drawPageHeader(doc, fazendaNome);

  doc.setTextColor(GREEN_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Média do escore de fezes por curral", 15, 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.text(
    `Média do escore de fezes (${escoresAtivos.join(", ")}) em cada curral`,
    15,
    31.5,
  );

  // ---------- Gráfico 1: linha ----------
  const chartX = 24;
  const chartY = 40;
  const chartW = pageW - 24 - 18;
  const chartH = 62;

  const medias = rows.map(r => r.media);
  let minY = Math.floor(Math.min(...medias, 3) * 2) / 2 - 0.5;
  let maxY = Math.ceil(Math.max(...medias, 3) * 2) / 2 + 0.5;
  minY = Math.max(1, minY);
  maxY = Math.min(5, Math.max(maxY, minY + 1));

  doc.setDrawColor(LINE);
  doc.setLineWidth(0.3);
  doc.setFontSize(7);
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "normal");
  const TICKS = 4;
  for (let i = 0; i <= TICKS; i++) {
    const gy = chartY + chartH - (chartH * i) / TICKS;
    doc.line(chartX, gy, chartX + chartW, gy);
    doc.text(fmt1(minY + ((maxY - minY) * i) / TICKS), chartX - 3, gy + 1, { align: "right" });
  }

  const n = rows.length;
  const px = (i: number) => (n === 1 ? chartX + chartW / 2 : chartX + (i * chartW) / (n - 1));
  const py = (v: number) => chartY + chartH - (chartH * (v - minY)) / (maxY - minY);

  doc.setDrawColor(GREEN_DARK);
  doc.setLineWidth(0.7);
  for (let i = 0; i < n - 1; i++) doc.line(px(i), py(rows[i].media), px(i + 1), py(rows[i + 1].media));
  doc.setFillColor(GOLD);
  for (let i = 0; i < n; i++) doc.circle(px(i), py(rows[i].media), 1.3, "F");

  const valFont = n > 10 ? 5.5 : 6.5;
  for (let i = 0; i < n; i++) {
    const t = fmt1(rows[i].media);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(valFont);
    const w = doc.getTextWidth(t) + 2;
    const yy = Math.max(chartY + 4, py(rows[i].media) - 3);
    doc.setFillColor("#FFFFFF");
    doc.rect(px(i) - w / 2, yy - valFont * 0.42 - 1, w, valFont * 0.5 + 1.6, "F");
    doc.setTextColor(GREEN_DARK);
    doc.text(t, px(i), yy, { align: "center" });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(INK);
  for (let i = 0; i < n; i++) doc.text(rows[i].label, px(i), chartY + chartH + 5, { align: "center" });
  doc.setFontSize(8);
  doc.text("Curral", pageW / 2, chartY + chartH + 12, { align: "center" });

  // ---------- Gráfico 2: barras empilhadas horizontais ----------
  let y = chartY + chartH + 22;
  doc.setTextColor(GREEN_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Distribuição do escore de fezes por curral", 15, y);
  y += 6;

  // legenda no topo
  const legendItems: [string, string][] = escoresAtivos.map(k => [`Escore ${k}`, ESC_COLORS[k]]);
  let lx = 15;
  legendItems.forEach(([label, color]) => {
    doc.setFillColor(color);
    doc.rect(lx, y - 3, 5, 3, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(INK);
    doc.text(label, lx + 7, y);
    lx += 30;
  });
  y += 6;

  const labelW = 20;
  const barX = 15 + labelW;
  const barW = pageW - 15 - barX;
  const barH = Math.min(9, Math.max(4.5, 60 / rows.length));
  const barGap = barH * 0.35;

  rows.forEach(r => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(INK);
    doc.text(r.label, barX - 2, y + barH / 2 + 1.2, { align: "right" });
    let cx = barX;
    escoresAtivos.forEach(k => {
      const frac = r.counts[k] / r.total;
      if (frac <= 0) return;
      const w = barW * frac;
      doc.setFillColor(ESC_COLORS[k]);
      doc.rect(cx, y, w, barH, "F");
      const pct = Math.round(frac * 100);
      const txt = `${pct}%`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(barH >= 7 ? 7 : 6);
      if (w > doc.getTextWidth(txt) + 2) {
        doc.setTextColor("#FFFFFF");
        doc.text(txt, cx + w / 2, y + barH / 2 + 1.2, { align: "center" });
      }
      cx += w;
    });
    y += barH + barGap;
  });

  // ---------- Tabela de apoio ----------
  y += 6;
  const cols = rows.length + 1;
  const firstColW = 26;
  const colW = (pageW - 30 - firstColW) / cols;
  const rowH = 6;
  const headers = [...rows.map(r => r.label), "Total"];

  const cell = (text: string, cxi: number, cy: number, bold: boolean, color = INK) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(cols > 8 ? 5.8 : 7);
    doc.setTextColor(color);
    doc.text(text, cxi, cy, { align: "center" });
  };

  doc.setFillColor("#FAF8F2");
  doc.rect(15, y, pageW - 30, rowH, "F");
  cell("Escore", 15 + firstColW / 2, y + 4, true, GREEN_DARK);
  headers.forEach((h, i) => cell(h, 15 + firstColW + colW * (i + 0.5), y + 4, true, GREEN_DARK));
  y += rowH;

  const totals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  rows.forEach(r => { ESC_ALL.forEach(k => { totals[k] += r.counts[k]; }); });
  const grandTotal = ESC_ALL.reduce((a, k) => a + totals[k], 0);

  doc.setDrawColor(LINE);
  doc.setLineWidth(0.2);
  escoresAtivos.forEach((k, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor("#FFFFFF");
    } else {
      doc.setFillColor("#FAF8F2");
    }
    doc.rect(15, y, pageW - 30, rowH, "F");
    doc.setFillColor(ESC_COLORS[k]);
    doc.rect(16, y + rowH / 2 - 1.5, 3, 3, "F");
    cell(`Escore ${k}`, 15 + firstColW / 2 + 2, y + 4, false);
    rows.forEach((r, i) => {
      const pct = r.total ? Math.round((r.counts[k] / r.total) * 100) : 0;
      cell(`${pct}% (${r.counts[k]})`, 15 + firstColW + colW * (i + 0.5), y + 4, false);
    });
    const gp = grandTotal ? Math.round((totals[k] / grandTotal) * 100) : 0;
    cell(`${gp}% (${totals[k]})`, 15 + firstColW + colW * (rows.length + 0.5), y + 4, true);
    y += rowH;
  });

  doc.setFillColor("#F0EDE2");
  doc.rect(15, y, pageW - 30, rowH, "F");
  cell("Total de amostras", 15 + firstColW / 2, y + 4, true, GREEN_DARK);
  rows.forEach((r, i) => cell(String(r.total), 15 + firstColW + colW * (i + 0.5), y + 4, true));
  cell(String(grandTotal), 15 + firstColW + colW * (rows.length + 0.5), y + 4, true, GREEN_DARK);

  return true;
}
