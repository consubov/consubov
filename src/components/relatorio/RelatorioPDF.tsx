import {
  Circle, Document, G, Line, Page, Rect, StyleSheet, Svg, Text, View,
} from "@react-pdf/renderer";

// ---------- Types ----------
export interface CatMetricsPDF {
  categoria: string;
  consumoMedio: number;
  totalAnimais: number;
  totalSacos: number;
  custoMedio: number;
  custoPorKgGanho: number;
  gmd: number;
  custoTotal: number;
}

export interface RelatorioPDFData {
  fazendaNome: string;
  periodo: string;
  dataGeracao: string;
  geradoPor: string;
  retiros: RetiroReportData[];
  categoriaMetrics?: CatMetricsPDF[];
}

export interface PastoReportData {
  nome: string;
  numAnimais: number;
  numSacos: number;
  consumoGCabDia: number;
  status: string;
  consumoRealGCabDia?: number;
  consumoEsperadoGCabDia?: number;
  statusReal?: string;
  pesoMedioKg: number;
  gmdKgDia: number;
  pesoAbateMetaKg: number;
  categoria?: string;
  diasConsiderados?: number;
  consumoPor100kg?: number;
  pesoSacoKg?: number;

  origemQr?: boolean;
}

export interface RetiroReportData {
  nome: string;
  capataz: string;
  totalAnimais: number;
  sacosUtilizados: number;
  consumoMedio: number;
  gmd: number;
  pesoMedioKg?: number;
  data: string;
  produtoNome: string;
  precoKg: number;
  eficiencia: number;
  custoDiario: number;
  score: number;
  scoreMeta: number;
  scoreCocho: number | null;
  scoreSalga: number;
  pesoMeta: number;
  pesoSalga: number;
  pesoCocho: number;
  detalheMeta: string;
  detalheSalga: string;
  detalheCocho: string;
  pastos: PastoReportData[];
  consumoIdeal?: number;
  consumoMaximo?: number;
  intervaloPadraoDias?: number;
}

// ---------- Styles ----------
const green = "#1B4332";
const gold = "#D4A017";
const lightGreen = "#E8F5E9";
const lightRed = "#FFEBEE";
const lightYellow = "#FFF8E1";
const lightBlue = "#E3F2FD";

const s = StyleSheet.create({
  page: { padding: 30, fontSize: 8, fontFamily: "Helvetica", color: "#333" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, borderBottom: `2 solid ${green}`, paddingBottom: 6 },
  headerLeft: {},
  headerTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: green },
  headerSub: { fontSize: 8, color: "#666", marginTop: 2 },
  headerRight: { textAlign: "right" },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: green, marginBottom: 4, marginTop: 10, borderBottom: `1 solid ${gold}`, paddingBottom: 2 },
  table: { marginBottom: 6 },
  tableHeader: { flexDirection: "row", backgroundColor: green, padding: 3 },
  tableHeaderCell: { color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 7 },
  tableRow: { flexDirection: "row", padding: 2, borderBottom: "0.5 solid #ddd" },
  tableRowAlt: { flexDirection: "row", padding: 2, borderBottom: "0.5 solid #ddd", backgroundColor: "#f9f9f9" },
  tableCell: { fontSize: 7 },
  footer: { position: "absolute", bottom: 16, left: 30, right: 30, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#999", borderTop: "0.5 solid #ccc", paddingTop: 3 },
  badge: { padding: "1 4", borderRadius: 3, fontSize: 7, fontFamily: "Helvetica-Bold" },
  retiroHeader: { backgroundColor: lightGreen, padding: 6, marginBottom: 4, borderRadius: 3, marginTop: 6 },
  retiroTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: green },
  retiroSub: { fontSize: 7, color: "#666", marginTop: 1 },
  cardsRow: { flexDirection: "row", gap: 4, marginBottom: 4, flexWrap: "wrap" },
  card: { backgroundColor: "#f5f5f5", padding: 4, borderRadius: 2, width: "15%", alignItems: "center" },
  cardLabel: { fontSize: 6, color: "#888", marginBottom: 1 },
  cardValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: green },
  alertBox: { backgroundColor: lightYellow, padding: 3, marginBottom: 2, borderRadius: 2, flexDirection: "row" },
  alertText: { fontSize: 7, color: "#B8860B" },
});

function statusColor(status: string) {
  if (status === "Baixo") return { bg: lightRed, color: "#C62828" };
  if (status === "Atenção" || status === "Atencao") return { bg: lightYellow, color: "#F9A825" };
  if (status === "Ideal") return { bg: lightGreen, color: "#2E7D32" };
  if (status === "Alto") return { bg: lightBlue, color: "#1565C0" };
  return { bg: "#f5f5f5", color: "#333" };
}

function barColor(status: string) {
  if (status === "Baixo") return "#E53935";
  if (status === "Atenção" || status === "Atencao") return "#FBC02D";
  if (status === "Ideal") return "#43A047";
  if (status === "Alto") return "#1E88E5";
  return "#9E9E9E";
}

function fmtNum(n: number, d = 0) {
  return n.toFixed(d).replace(".", ",");
}

function fmtBRL(n: number) {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

// ---------- Components ----------
function Header({ data }: { data: RelatorioPDFData }) {
  return (
    <View style={s.header}>
      <View style={s.headerLeft}>
        <Text style={s.headerTitle}>CONSUBOV — {data.fazendaNome}</Text>
        <Text style={s.headerSub}>Período: {data.periodo}</Text>
      </View>
      <View style={s.headerRight}>
        <Text style={s.headerSub}>Gerado em: {data.dataGeracao}</Text>
        <Text style={s.headerSub}>Por: {data.geradoPor}</Text>
      </View>
    </View>
  );
}

function Footer({ fazendaNome }: { fazendaNome: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{fazendaNome}</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

function ResumoGeral({ retiros }: { retiros: RetiroReportData[] }) {
  const cols = [
    { label: "#", width: "5%" },
    { label: "Retiro", width: "20%" },
    { label: "Capataz", width: "20%" },
    { label: "Animais", width: "12%" },
    { label: "Sacos", width: "10%" },
    { label: "Consumo (g/cab/dia)", width: "20%" },
    { label: "Data", width: "13%" },
  ];
  return (
    <View>
      <Text style={s.sectionTitle}>SEÇÃO 1 — RESUMO GERAL</Text>
      <View style={s.table}>
        <View style={s.tableHeader}>
          {cols.map(c => <Text key={c.label} style={[s.tableHeaderCell, { width: c.width }]}>{c.label}</Text>)}
        </View>
        {retiros.map((r, i) => (
          <View key={r.nome} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
            <Text style={[s.tableCell, { width: cols[0].width }]}>{i + 1}</Text>
            <Text style={[s.tableCell, { width: cols[1].width }]}>{r.nome}</Text>
            <Text style={[s.tableCell, { width: cols[2].width }]}>{r.capataz}</Text>
            <Text style={[s.tableCell, { width: cols[3].width }]}>{r.totalAnimais}</Text>
            <Text style={[s.tableCell, { width: cols[4].width }]}>{r.sacosUtilizados}</Text>
            <Text style={[s.tableCell, { width: cols[5].width }]}>{fmtNum(r.consumoMedio, 1)}</Text>
            <Text style={[s.tableCell, { width: cols[6].width }]}>{r.data}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ScoreEficiencia({ retiros }: { retiros: RetiroReportData[] }) {
  const sorted = [...retiros].sort((a, b) => b.score - a.score);
  return (
    <View>
      <Text style={s.sectionTitle}>SEÇÃO 2 — SCORE DE EFICIÊNCIA</Text>
      <View>
        {sorted.map((r, i) => (
          <View
            key={r.nome}
            style={{
              flexDirection: "row",
              padding: 6,
              marginBottom: 4,
              backgroundColor: i % 2 === 0 ? "#f9f9f9" : "#fff",
              border: "0.5 solid #ddd",
              borderRadius: 3,
            }}
            wrap={false}
          >
            <View style={{ width: "38%" }}>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: green }}>
                {i + 1}. {r.nome}
              </Text>
              <Text style={{ fontSize: 7, color: "#666", marginTop: 1 }}>
                Capataz: {r.capataz}
              </Text>
              <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: green, marginTop: 4 }}>
                {fmtNum(r.score, 1)}
                <Text style={{ fontSize: 8, color: "#888" }}> / 10</Text>
              </Text>
            </View>
            <View style={{ width: "62%", paddingLeft: 6 }}>
              <View style={{ marginBottom: 3 }}>
                <Text style={{ fontSize: 7, color: "#333" }}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>Meta: </Text>
                  {fmtNum(r.scoreMeta, 1)} / {fmtNum(r.pesoMeta, 0)}
                </Text>
                <Text style={{ fontSize: 6.5, color: "#888", marginTop: 0.5 }}>{r.detalheMeta}</Text>
              </View>
              <View style={{ marginBottom: 3 }}>
                <Text style={{ fontSize: 7, color: "#333" }}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>Salga: </Text>
                  {fmtNum(r.scoreSalga, 1)} / {fmtNum(r.pesoSalga, 0)}
                </Text>
                <Text style={{ fontSize: 6.5, color: "#888", marginTop: 0.5 }}>{r.detalheSalga}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 7, color: "#333" }}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>Cocho: </Text>
                  {r.scoreCocho != null ? `${fmtNum(r.scoreCocho, 1)} / ${fmtNum(r.pesoCocho, 0)}` : `— / ${fmtNum(r.pesoCocho, 0)}`}
                </Text>
                <Text style={{ fontSize: 6.5, color: "#888", marginTop: 0.5 }}>{r.detalheCocho}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function RankingGMD({ retiros }: { retiros: RetiroReportData[] }) {
  const sorted = [...retiros].sort((a, b) => b.gmd - a.gmd);
  const cols = [
    { label: "#", width: "8%" },
    { label: "Retiro", width: "25%" },
    { label: "Capataz", width: "27%" },
    { label: "GMD (kg/dia)", width: "20%" },
    { label: "Animais", width: "20%" },
  ];
  return (
    <View>
      <Text style={s.sectionTitle}>SEÇÃO 3 — RANKING GMD</Text>
      <View style={s.table}>
        <View style={s.tableHeader}>
          {cols.map(c => <Text key={c.label} style={[s.tableHeaderCell, { width: c.width }]}>{c.label}</Text>)}
        </View>
        {sorted.map((r, i) => (
          <View key={r.nome} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
            <Text style={[s.tableCell, { width: cols[0].width }]}>{i + 1}</Text>
            <Text style={[s.tableCell, { width: cols[1].width }]}>{r.nome}</Text>
            <Text style={[s.tableCell, { width: cols[2].width }]}>{r.capataz}</Text>
            <Text style={[s.tableCell, { width: cols[3].width, fontFamily: "Helvetica-Bold" }]}>{fmtNum(r.gmd, 3)}</Text>
            <Text style={[s.tableCell, { width: cols[4].width }]}>{r.totalAnimais}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PrevisaoAbate({ retiros }: { retiros: RetiroReportData[] }) {
  const allPastos = retiros.flatMap(r => r.pastos.map(p => ({ retiro: r.nome, ...p })));
  const cols = [
    { label: "Retiro", width: "16%" },
    { label: "Pasto", width: "16%" },
    { label: "Peso (kg)", width: "16%" },
    { label: "GMD", width: "14%" },
    { label: "Meta (kg)", width: "16%" },
    { label: "Previsão", width: "22%" },
  ];
  return (
    <View>
      <Text style={s.sectionTitle}>SEÇÃO 4 — PREVISÃO DE ABATE</Text>
      <View style={s.table}>
        <View style={s.tableHeader}>
          {cols.map(c => <Text key={c.label} style={[s.tableHeaderCell, { width: c.width }]}>{c.label}</Text>)}
        </View>
        {allPastos.map((p, i) => {
          const pronto = p.pesoMedioKg >= p.pesoAbateMetaKg;
          const diasAbate = !pronto && p.gmdKgDia > 0 ? Math.ceil((p.pesoAbateMetaKg - p.pesoMedioKg) / p.gmdKgDia) : null;
          const prevLabel = pronto ? "Pronto" : diasAbate != null ? `${diasAbate} dias` : "—";
          return (
            <View key={`${p.retiro}-${p.nome}`} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.tableCell, { width: cols[0].width }]}>{p.retiro}</Text>
              <Text style={[s.tableCell, { width: cols[1].width }]}>{p.nome}</Text>
              <Text style={[s.tableCell, { width: cols[2].width }]}>{fmtNum(p.pesoMedioKg, 1)}</Text>
              <Text style={[s.tableCell, { width: cols[3].width }]}>{fmtNum(p.gmdKgDia, 3)}</Text>
              <Text style={[s.tableCell, { width: cols[4].width }]}>{fmtNum(p.pesoAbateMetaKg, 0)}</Text>
              <Text style={[s.tableCell, { width: cols[5].width, color: pronto ? "#2E7D32" : "#333" }]}>{prevLabel}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ---------- NEW: Métricas por Categoria Animal ----------
function MetricasCategoria({ metrics }: { metrics: CatMetricsPDF[] }) {
  if (!metrics || metrics.length === 0) return null;
  const cols = [
    { label: "Categoria", width: "16%" },
    { label: "Animais", width: "12%" },
    { label: "Sacos", width: "10%" },
    { label: "Consumo (g/cab/dia)", width: "18%" },
    { label: "Custo Total", width: "14%" },
    { label: "R$/cab/mês", width: "12%" },
    { label: "R$/kg ganho", width: "10%" },
    { label: "GMD", width: "8%" },
  ];
  return (
    <View>
      <Text style={s.sectionTitle}>SEÇÃO 5 — MÉTRICAS POR CATEGORIA ANIMAL</Text>

      {/* Summary cards row — always same line */}
      <View style={{ flexDirection: "row", marginBottom: 6 }}>
        {metrics.map((m, i) => (
          <View key={m.categoria} style={{ backgroundColor: "#f5f5f5", padding: 5, borderRadius: 3, width: "32%", marginRight: i < metrics.length - 1 ? "2%" : 0 }}>
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: green, marginBottom: 2 }}>{m.categoria}</Text>
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#333" }}>{fmtNum(m.consumoMedio, 1)} <Text style={{ fontSize: 6, color: "#888" }}>g/cab/dia</Text></Text>
            <View style={{ marginTop: 2 }}>
              <Text style={{ fontSize: 6, color: "#666" }}>Animais: {fmtNum(m.totalAnimais)} · Sacos: {fmtNum(m.totalSacos)}</Text>
              <Text style={{ fontSize: 6, color: "#666" }}>R$/cab/mês: {fmtBRL(m.custoMedio)}</Text>
              <Text style={{ fontSize: 6, color: "#666" }}>R$/kg ganho: {m.custoPorKgGanho > 0 ? fmtBRL(m.custoPorKgGanho) : "—"}</Text>
              <Text style={{ fontSize: 6, color: "#666" }}>GMD: {m.gmd > 0 ? `${fmtNum(m.gmd, 3)} kg/dia` : "—"}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Table */}
      <View style={s.table}>
        <View style={s.tableHeader}>
          {cols.map(c => <Text key={c.label} style={[s.tableHeaderCell, { width: c.width }]}>{c.label}</Text>)}
        </View>
        {metrics.map((m, i) => (
          <View key={m.categoria} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
            <Text style={[s.tableCell, { width: cols[0].width, fontFamily: "Helvetica-Bold" }]}>{m.categoria}</Text>
            <Text style={[s.tableCell, { width: cols[1].width }]}>{fmtNum(m.totalAnimais)}</Text>
            <Text style={[s.tableCell, { width: cols[2].width }]}>{fmtNum(m.totalSacos)}</Text>
            <Text style={[s.tableCell, { width: cols[3].width }]}>{fmtNum(m.consumoMedio, 1)}</Text>
            <Text style={[s.tableCell, { width: cols[4].width }]}>{fmtBRL(m.custoTotal)}</Text>
            <Text style={[s.tableCell, { width: cols[5].width }]}>{fmtBRL(m.custoMedio)}</Text>
            <Text style={[s.tableCell, { width: cols[6].width }]}>{m.custoPorKgGanho > 0 ? fmtBRL(m.custoPorKgGanho) : "—"}</Text>
            <Text style={[s.tableCell, { width: cols[7].width }]}>{m.gmd > 0 ? fmtNum(m.gmd, 3) : "—"}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------- NEW: Gráfico de Consumo por Pasto (react-pdf drawn) ----------
function ConsumoPorPastoChart({ r }: { r: RetiroReportData }) {
  const pastos = [...r.pastos].filter(p => p.consumoGCabDia > 0).sort((a, b) => b.consumoGCabDia - a.consumoGCabDia);
  if (pastos.length === 0) return null;

  const chartWidth = 530;
  const chartHeight = 140;
  const leftMargin = 40;
  const bottomMargin = 30;
  const plotWidth = chartWidth - leftMargin - 10;
  const plotHeight = chartHeight - bottomMargin - 10;

  const maxVal = Math.max(...pastos.map(p => p.consumoGCabDia), r.consumoMaximo ?? 0, r.consumoIdeal ?? 0) * 1.15;
  const barWidth = Math.min(28, (plotWidth / pastos.length) * 0.7);
  const barGap = plotWidth / pastos.length;

  const idealY = r.consumoIdeal && r.consumoIdeal > 0 ? plotHeight - (r.consumoIdeal / maxVal) * plotHeight : null;
  const maxY = r.consumoMaximo && r.consumoMaximo > 0 ? plotHeight - (r.consumoMaximo / maxVal) * plotHeight : null;

  return (
    <View style={{ marginTop: 6, marginBottom: 6 }} wrap={false}>
      <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: green, marginBottom: 4 }}>
        Consumo por Pasto — {r.nome}
      </Text>
      <View style={{ width: chartWidth, height: chartHeight, position: "relative" }}>
        {/* Y axis */}
        <View style={{ position: "absolute", left: 0, top: 0, width: leftMargin, height: plotHeight }}>
          {[0, 0.25, 0.5, 0.75, 1].map(frac => (
            <Text key={frac} style={{
              position: "absolute",
              right: 2,
              top: plotHeight - frac * plotHeight - 4,
              fontSize: 5,
              color: "#999",
            }}>
              {fmtNum(frac * maxVal, 0)}
            </Text>
          ))}
        </View>

        {/* Plot area */}
        <View style={{
          position: "absolute",
          left: leftMargin,
          top: 0,
          width: plotWidth,
          height: plotHeight,
          borderBottom: "0.5 solid #ccc",
          borderLeft: "0.5 solid #ccc",
        }}>
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map(frac => (
            <View key={frac} style={{
              position: "absolute",
              left: 0,
              top: plotHeight - frac * plotHeight,
              width: plotWidth,
              height: 0,
              borderBottom: "0.3 solid #eee",
            }} />
          ))}

          {/* Ideal line */}
          {idealY != null && (
            <>
              <View style={{
                position: "absolute", left: 0, top: idealY,
                width: plotWidth, height: 0,
                borderBottom: "0.8 dashed #43A047",
              }} />
              <Text style={{ position: "absolute", right: 0, top: idealY - 7, fontSize: 5, color: "#43A047" }}>
                Ideal ({fmtNum(r.consumoIdeal!, 0)})
              </Text>
            </>
          )}

          {/* Max line */}
          {maxY != null && (
            <>
              <View style={{
                position: "absolute", left: 0, top: maxY,
                width: plotWidth, height: 0,
                borderBottom: "0.8 dashed #E53935",
              }} />
              <Text style={{ position: "absolute", right: 0, top: maxY - 7, fontSize: 5, color: "#E53935" }}>
                Máximo ({fmtNum(r.consumoMaximo!, 0)})
              </Text>
            </>
          )}

          {/* Bars */}
          {pastos.map((p, i) => {
            const barH = (p.consumoGCabDia / maxVal) * plotHeight;
            const x = i * barGap + (barGap - barWidth) / 2;
            const color = barColor(p.status);
            return (
              <View key={p.nome}>
                {/* Bar */}
                <View style={{
                  position: "absolute",
                  left: x,
                  top: plotHeight - barH,
                  width: barWidth,
                  height: barH,
                  backgroundColor: color,
                  borderRadius: 1,
                }} />
                {/* Value label */}
                <Text style={{
                  position: "absolute",
                  left: x,
                  top: plotHeight - barH - 8,
                  width: barWidth,
                  textAlign: "center",
                  fontSize: 5,
                  fontFamily: "Helvetica-Bold",
                  color: "#333",
                }}>
                  {fmtNum(p.consumoGCabDia, 1)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* X labels */}
        <View style={{ position: "absolute", left: leftMargin, top: plotHeight + 2, width: plotWidth, flexDirection: "row" }}>
          {pastos.map((p, i) => (
            <Text key={p.nome} style={{
              position: "absolute",
              left: i * barGap,
              width: barGap,
              textAlign: "center",
              fontSize: 5,
              color: "#666",
            }}>
              {p.nome.length > 10 ? p.nome.slice(0, 9) + "…" : p.nome}
            </Text>
          ))}
        </View>

        {/* Legend */}
        <View style={{ position: "absolute", left: leftMargin, top: plotHeight + 14, flexDirection: "row", gap: 8 }}>
          {[
            { label: "Ideal", color: "#43A047" },
            { label: "Atenção", color: "#FBC02D" },
            { label: "Baixo", color: "#E53935" },
            { label: "Alto", color: "#1E88E5" },
          ].map(l => (
            <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <View style={{ width: 6, height: 6, backgroundColor: l.color, borderRadius: 1 }} />
              <Text style={{ fontSize: 5, color: "#666" }}>{l.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function DetalheRetiro({ r }: { r: RetiroReportData }) {
  const sortedPastos = [...r.pastos].sort((a, b) => b.consumoGCabDia - a.consumoGCabDia);
  const baixo = r.pastos.filter(p => p.status === "Baixo");
  const alto = r.pastos.filter(p => p.status === "Alto");
  const limiteDias = r.intervaloPadraoDias != null ? r.intervaloPadraoDias + 1 : null;

  const cols = [
    { label: "Pasto", width: "14%" },
    { label: "Categoria", width: "11%" },
    { label: "Animais", width: "8%" },
    { label: "Peso Médio (kg)", width: "10%" },
    { label: "Consumo/100kg", width: "11%" },
    { label: "Peso Saco (kg)", width: "10%" },
    { label: "Sacos", width: "7%" },
    { label: "Dias do Ciclo", width: "9%" },
    { label: "Consumo Médio do Mês", width: "10%" },
    { label: "Status Real", width: "10%" },
  ];


  return (
    <View>
      <View style={s.retiroHeader}>
        <Text style={s.retiroTitle}>{r.nome}</Text>
        <Text style={s.retiroSub}>Capataz: {r.capataz} · Produto: {r.produtoNome} · R$ {fmtNum(r.precoKg, 2)}/kg</Text>
      </View>

      <View style={s.cardsRow}>
        <View style={s.card}><Text style={s.cardLabel}>Pastos</Text><Text style={s.cardValue}>{r.pastos.length}</Text></View>
        <View style={s.card}><Text style={s.cardLabel}>Animais</Text><Text style={s.cardValue}>{r.totalAnimais}</Text></View>
        <View style={s.card}><Text style={s.cardLabel}>Sacos</Text><Text style={s.cardValue}>{r.sacosUtilizados}</Text></View>
        <View style={s.card}><Text style={s.cardLabel}>Consumo</Text><Text style={s.cardValue}>{fmtNum(r.consumoMedio, 1)}</Text></View>
        <View style={s.card}><Text style={s.cardLabel}>Peso Médio</Text><Text style={s.cardValue}>{r.pesoMedioKg ? fmtNum(r.pesoMedioKg, 1) : "—"}</Text></View>
        <View style={s.card}><Text style={s.cardLabel}>Eficiência</Text><Text style={s.cardValue}>{fmtNum(r.eficiencia, 0)}%</Text></View>
        <View style={s.card}><Text style={s.cardLabel}>Custo R$/cab/dia</Text><Text style={s.cardValue}>{fmtNum(r.custoDiario, 2)}</Text></View>
      </View>

      {baixo.length > 0 && (
        <View style={s.alertBox}>
          <Text style={[s.alertText, { color: "#C62828" }]}>[!] Consumo Real Baixo: {baixo.map(p => p.nome).join(", ")}</Text>
        </View>
      )}
      {alto.length > 0 && (
        <View style={s.alertBox}>
          <Text style={[s.alertText, { color: "#1565C0" }]}>[!] Consumo Real Alto: {alto.map(p => p.nome).join(", ")}</Text>
        </View>
      )}

      {/* Bar chart */}
      <ConsumoPorPastoChart r={r} />

      <View style={[s.table, { marginTop: 2 }]}>
        <View style={s.tableHeader}>
          {cols.map(c => <Text key={c.label} style={[s.tableHeaderCell, { width: c.width, fontSize: 6 }]}>{c.label}</Text>)}
        </View>
        {sortedPastos.map((p, i) => {
          const stReal = p.statusReal ?? p.status;
          const scReal = statusColor(stReal);
          const consumoReal = p.consumoRealGCabDia ?? p.consumoGCabDia;
          const diasExcedido = limiteDias != null && p.diasConsiderados != null && p.diasConsiderados > limiteDias;
          return (
            <View key={p.nome} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.tableCell, { fontSize: 6, width: cols[0].width }]}>{p.origemQr ? `\u2713 ${p.nome}` : p.nome}</Text>
              <Text style={[s.tableCell, { fontSize: 6, width: cols[1].width }]}>{p.categoria ?? "—"}</Text>
              <Text style={[s.tableCell, { fontSize: 6, width: cols[2].width }]}>{p.numAnimais}</Text>
              <Text style={[s.tableCell, { fontSize: 6, width: cols[3].width }]}>{fmtNum(p.pesoMedioKg, 1)}</Text>
              <Text style={[s.tableCell, { fontSize: 6, width: cols[4].width }]}>{p.consumoPor100kg ? fmtNum(p.consumoPor100kg, 3) : "—"}</Text>
              <Text style={[s.tableCell, { fontSize: 6, width: cols[5].width }]}>{p.pesoSacoKg ? fmtNum(p.pesoSacoKg, 1) : "—"}</Text>
              <Text style={[s.tableCell, { fontSize: 6, width: cols[6].width }]}>{p.numSacos}</Text>
              <Text style={[s.tableCell, { fontSize: 6, width: cols[7].width }, diasExcedido ? { color: "#C62828", fontFamily: "Helvetica-Bold" } : {}]}>{p.diasConsiderados != null ? fmtNum(p.diasConsiderados, 0) : "—"}</Text>
              <Text style={[s.tableCell, { fontSize: 6, width: cols[8].width }]}>{fmtNum(consumoReal, 1)}</Text>
              <Text style={[s.tableCell, { fontSize: 6, width: cols[9].width, color: scReal.color, fontFamily: "Helvetica-Bold" }]}>{stReal}</Text>
            </View>
          );
        })}
      </View>

      <Text style={{ fontSize: 6, color: "#888", marginTop: 2 }}>
        {"\u2713 = lançado via QR Code"}
        {" · Consumo Médio do Mês = média de todas as salgas do mês (g/cab/dia), diferente do Consumo Real pontual das telas"}
        {" · Dias do Ciclo = dias do ciclo do retiro, não o intervalo de consumo de cada pasto"}
        {limiteDias != null ? ` (em vermelho = acima do intervalo padrão de ${limiteDias} dias)` : ""}
      </Text>
    </View>
  );
}

interface DualChartPoint {
  letra: string;
  nome: string;
  real: number;
  esperado: number;
}

const CHART_PASTOS_PER_PAGE = 15;

function indexToLetter(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function ReferenceTable({ pontos, columns }: { pontos: DualChartPoint[]; columns: number }) {
  const rows = Math.ceil(pontos.length / columns);
  return (
    <View>
      <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: green, marginBottom: 5 }}>
        Referência dos Pastos
      </Text>
      <View style={{ flexDirection: "row" }}>
        {Array.from({ length: columns }, (_, columnIndex) => (
          <View key={`ref-col-${columnIndex}`} style={{ width: `${100 / columns}%`, paddingRight: columnIndex < columns - 1 ? 5 : 0 }}>
            {Array.from({ length: rows }, (_, rowIndex) => {
              const point = pontos[columnIndex * rows + rowIndex];
              if (!point) return null;
              return (
                <View
                  key={`${point.letra}-${point.nome}`}
                  style={{
                    height: 14,
                    paddingHorizontal: 4,
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: rowIndex % 2 === 0 ? "#FAF8F2" : "#FFFFFF",
                  }}
                >
                  <Text style={{ width: 22, fontSize: columns === 3 ? 6.5 : 7.5, fontFamily: "Helvetica-Bold", color: green }}>
                    {point.letra}
                  </Text>
                  <Text style={{ flex: 1, fontSize: columns === 3 ? 6.5 : 7.5, color: "#333" }}>
                    {point.nome}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function DualLineChart({ pontos }: { pontos: DualChartPoint[] }) {
  const width = 535;
  const height = 300;
  const left = 38;
  const top = 28;
  const right = 18;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxRaw = Math.max(...pontos.flatMap(p => [p.real, p.esperado]), 1);
  const maxY = Math.ceil(maxRaw / 5) * 5 || 5;
  const x = (index: number) => pontos.length === 1 ? left + plotWidth / 2 : left + (index * plotWidth) / (pontos.length - 1);
  const y = (value: number) => top + plotHeight - (Math.max(0, value) / maxY) * plotHeight;
  const valueFontSize = pontos.length > 8 ? 5 : 6;
  const formatValue = (value: number) => fmtNum(value, 1);

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {Array.from({ length: 6 }, (_, index) => {
        const gridY = top + plotHeight - (plotHeight * index) / 5;
        return (
          <G key={`grid-${index}`}>
            <Line x1={left} y1={gridY} x2={left + plotWidth} y2={gridY} stroke="#E7E3D6" strokeWidth={0.5} />
            <Text x={left - 5} y={gridY + 2} textAnchor="end" style={{ fontSize: 7, fill: "#767066" }}>
              {fmtNum((maxY * index) / 5, maxY >= 10 ? 0 : 1)}
            </Text>
          </G>
        );
      })}

      {pontos.slice(0, -1).map((point, index) => (
        <G key={`segments-${point.letra}`}>
          <Line x1={x(index)} y1={y(point.real)} x2={x(index + 1)} y2={y(pontos[index + 1].real)} stroke={green} strokeWidth={2} />
          <Line x1={x(index)} y1={y(point.esperado)} x2={x(index + 1)} y2={y(pontos[index + 1].esperado)} stroke={gold} strokeWidth={2} />
        </G>
      ))}

      {pontos.map((point, index) => {
        const pointX = x(index);
        const realY = y(point.real);
        const esperadoY = y(point.esperado);
        const realAbove = point.real >= point.esperado;
        const realLabelY = realAbove ? Math.max(top + 5, realY - 7) : Math.min(top + plotHeight - 1, realY + 12);
        const esperadoLabelY = realAbove ? Math.min(top + plotHeight - 1, esperadoY + 12) : Math.max(top + 5, esperadoY - 7);
        const realText = formatValue(point.real);
        const esperadoText = formatValue(point.esperado);
        const labelWidth = Math.max(realText.length, esperadoText.length) * valueFontSize * 0.62 + 5;
        return (
          <G key={`point-${point.letra}`}>
            <Line x1={pointX} y1={realY + 3} x2={pointX} y2={top + plotHeight + 5} stroke={green} strokeWidth={0.5} strokeDasharray="3,3" />
            <Line x1={pointX} y1={esperadoY + 3} x2={pointX} y2={top + plotHeight + 5} stroke={gold} strokeWidth={0.5} strokeDasharray="3,3" />
            <Circle cx={pointX} cy={realY} r={3} fill={green} />
            <Circle cx={pointX} cy={esperadoY} r={3} fill={gold} />
            <Rect x={pointX - labelWidth / 2} y={realLabelY - valueFontSize + 1} width={labelWidth} height={valueFontSize + 3} fill="#FFFFFF" />
            <Text x={pointX} y={realLabelY} textAnchor="middle" style={{ fontSize: valueFontSize, fontFamily: "Helvetica-Bold", fill: green }}>
              {realText}
            </Text>
            <Rect x={pointX - labelWidth / 2} y={esperadoLabelY - valueFontSize + 1} width={labelWidth} height={valueFontSize + 3} fill="#FFFFFF" />
            <Text x={pointX} y={esperadoLabelY} textAnchor="middle" style={{ fontSize: valueFontSize, fontFamily: "Helvetica-Bold", fill: gold }}>
              {esperadoText}
            </Text>
            <Text x={pointX} y={top + plotHeight + 14} textAnchor="middle" style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", fill: "#1C1C1A" }}>
              {point.letra}
            </Text>
          </G>
        );
      })}
      <Text x={width / 2} y={height - 5} textAnchor="middle" style={{ fontSize: 8, fontFamily: "Helvetica-Bold", fill: "#1C1C1A" }}>Pasto</Text>
    </Svg>
  );
}

function RealEsperadoPages({ data }: { data: RelatorioPDFData }) {
  const retiroPages = data.retiros.flatMap(retiro => {
    const pontos = retiro.pastos
      .filter(pasto => (pasto.consumoRealGCabDia ?? 0) > 0 && (pasto.consumoEsperadoGCabDia ?? 0) > 0)
      .map((pasto, index) => ({
        letra: indexToLetter(index),
        nome: pasto.nome,
        real: Number(pasto.consumoRealGCabDia),
        esperado: Number(pasto.consumoEsperadoGCabDia),
      }));

    if (pontos.length === 0) return [];

    const partes = chunk(pontos, CHART_PASTOS_PER_PAGE);
    return partes.map((pontosParte, parteIndex) => ({
      retiroNome: retiro.nome,
      pontos: pontosParte,
      parte: parteIndex + 1,
      totalPartes: partes.length,
    }));
  });

  if (retiroPages.length === 0) return null;

  return (
    <>
      {retiroPages.map(({ retiroNome, pontos, parte, totalPartes }) => (
        <Page key={`${retiroNome}-${parte}`} size="A4" style={s.page}>
          <Header data={data} />
          <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: green, marginBottom: 4 }}>
            {`${retiroNome} - Real x Esperado (${parte}/${totalPartes})`}
          </Text>
          <DualLineChart pontos={pontos} />
          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 2, marginBottom: 5 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginRight: 24 }}>
              <View style={{ width: 18, height: 3, backgroundColor: green, marginRight: 5 }} />
              <Text style={{ fontSize: 8 }}>Consumo Real</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 18, height: 3, backgroundColor: gold, marginRight: 5 }} />
              <Text style={{ fontSize: 8 }}>Consumo Esperado</Text>
            </View>
          </View>
          <Text style={{ fontSize: 7, color: "#767066", textAlign: "center", marginBottom: 8 }}>
            Valores em g/cab/dia por pasto avaliado.
          </Text>
          <ReferenceTable pontos={pontos} columns={pontos.length > 16 ? 3 : 2} />
          <Footer fazendaNome={data.fazendaNome} />
        </Page>
      ))}
    </>
  );
}

// ---------- Main Document ----------
export default function RelatorioPDF({ data }: { data: RelatorioPDFData }) {
  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <Header data={data} />
        <ResumoGeral retiros={data.retiros} />
        <ScoreEficiencia retiros={data.retiros} />
        <RankingGMD retiros={data.retiros} />
        <PrevisaoAbate retiros={data.retiros} />

        {data.categoriaMetrics && data.categoriaMetrics.length > 0 && (
          <MetricasCategoria metrics={data.categoriaMetrics} />
        )}

        <Text style={s.sectionTitle}>SEÇÃO 6 — DETALHE POR RETIRO</Text>
        {data.retiros.map(r => (
          <DetalheRetiro key={r.nome} r={r} />
        ))}

        <Footer fazendaNome={data.fazendaNome} />
      </Page>
      <RealEsperadoPages data={data} />
    </Document>
  );
}
