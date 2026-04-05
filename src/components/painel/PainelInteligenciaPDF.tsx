import {
  Document, Page, Text, View, StyleSheet,
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

export interface RankingFazendaPDF {
  nome: string;
  estado: string;
  consumoMedio: number;
  desvio: number;
  intervaloMedio: number;
  lancamentos: number;
}

export interface TendenciaPDF {
  periodo: string;
  consumo: number;
}

export interface AlertaPDF {
  tipo: "warning" | "info";
  texto: string;
}

export interface PainelPDFData {
  fazendaNome: string; // "Todas" or specific
  periodo: string;
  dataGeracao: string;
  filtros: { label: string; valor: string }[];
  // KPIs
  consumoMedioReal: number;
  consumoEsperado: number;
  desvioPercent: number;
  intervaloMedio: number;
  // Alerts
  alertas: AlertaPDF[];
  // Metrics by category
  metricas: CatMetricsPDF[];
  // Trend data
  tendencia: TendenciaPDF[];
  // Ranking
  ranking: RankingFazendaPDF[];
}

// ---------- Styles ----------
const green = "#1B4332";
const gold = "#D4A017";
const lightGreen = "#E8F5E9";
const lightYellow = "#FFF8E1";

const s = StyleSheet.create({
  page: { padding: 30, fontSize: 8, fontFamily: "Helvetica", color: "#333" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, borderBottom: `2 solid ${green}`, paddingBottom: 6 },
  headerTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: green },
  headerSub: { fontSize: 8, color: "#666", marginTop: 2 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: green, marginBottom: 4, marginTop: 12, borderBottom: `1 solid ${gold}`, paddingBottom: 2 },
  kpiRow: { flexDirection: "row", gap: 6, marginBottom: 8, flexWrap: "wrap" },
  kpiCard: { backgroundColor: "#f5f5f5", padding: 6, borderRadius: 3, width: "23%", borderLeft: `3 solid ${green}` },
  kpiLabel: { fontSize: 7, color: "#888", marginBottom: 2 },
  kpiValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: green },
  kpiUnit: { fontSize: 7, color: "#666", marginTop: 1 },
  table: { marginBottom: 6, marginTop: 4 },
  tableHeader: { flexDirection: "row", backgroundColor: green, padding: 3 },
  tableHeaderCell: { color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 7 },
  tableRow: { flexDirection: "row", padding: 3, borderBottom: "0.5 solid #ddd" },
  tableRowAlt: { flexDirection: "row", padding: 3, borderBottom: "0.5 solid #ddd", backgroundColor: "#f9f9f9" },
  tableCell: { fontSize: 7 },
  footer: { position: "absolute", bottom: 16, left: 30, right: 30, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#999", borderTop: "0.5 solid #ccc", paddingTop: 3 },
  alertBox: { padding: 4, marginBottom: 2, borderRadius: 2, flexDirection: "row" },
  alertText: { fontSize: 7 },
  catCard: { backgroundColor: "#f5f5f5", padding: 6, borderRadius: 3, width: "31%", marginBottom: 4, borderTop: `2 solid ${gold}` },
  catTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: green, marginBottom: 3 },
  catValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: green },
  catUnit: { fontSize: 7, color: "#888" },
  catRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  catLabel: { fontSize: 6.5, color: "#888" },
  catData: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#333" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 8 },
  filterChip: { backgroundColor: lightGreen, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, fontSize: 7, color: green },
  barRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 6, marginBottom: 4, height: 80 },
  barContainer: { alignItems: "center", width: "30%" },
  bar: { width: 30, borderRadius: 2 },
  barLabel: { fontSize: 7, color: "#666", marginTop: 2 },
  barValue: { fontSize: 7, fontFamily: "Helvetica-Bold", color: green, marginTop: 1 },
  trendRow: { flexDirection: "row", flexWrap: "wrap", gap: 2, marginTop: 4 },
  trendCell: { backgroundColor: "#f0f0f0", padding: 3, borderRadius: 2, width: "15%", alignItems: "center", marginBottom: 2 },
  trendPeriodo: { fontSize: 6, color: "#888" },
  trendConsumo: { fontSize: 7, fontFamily: "Helvetica-Bold", color: green },
});

function fmtNum(n: number, d = 0) {
  return n.toFixed(d).replace(".", ",");
}

function fmtBRL(n: number) {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

// ---------- Components ----------
function Header({ data }: { data: PainelPDFData }) {
  return (
    <View style={s.header}>
      <View>
        <Text style={s.headerTitle}>CONSUBOV — Painel de Inteligência Nutricional</Text>
        <Text style={s.headerSub}>{data.fazendaNome} · {data.periodo}</Text>
      </View>
      <View style={{ textAlign: "right" }}>
        <Text style={s.headerSub}>Gerado em: {data.dataGeracao}</Text>
        <Text style={s.headerSub}>Relatório automático</Text>
      </View>
    </View>
  );
}

function Filtros({ filtros }: { filtros: PainelPDFData["filtros"] }) {
  if (filtros.length === 0) return null;
  return (
    <View style={s.filterRow}>
      {filtros.map((f, i) => (
        <Text key={i} style={s.filterChip}>{f.label}: {f.valor}</Text>
      ))}
    </View>
  );
}

function KPIs({ data }: { data: PainelPDFData }) {
  return (
    <View>
      <Text style={s.sectionTitle}>RESUMO GERAL</Text>
      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Consumo Real Médio</Text>
          <Text style={s.kpiValue}>{fmtNum(data.consumoMedioReal, 1)}</Text>
          <Text style={s.kpiUnit}>g/cab/dia</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Consumo Esperado</Text>
          <Text style={s.kpiValue}>{data.consumoEsperado > 0 ? fmtNum(data.consumoEsperado, 1) : "—"}</Text>
          <Text style={s.kpiUnit}>g/cab/dia</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Desvio</Text>
          <Text style={s.kpiValue}>
            {data.consumoEsperado > 0 ? `${data.desvioPercent > 0 ? "+" : ""}${fmtNum(data.desvioPercent, 1)}%` : "—"}
          </Text>
          <Text style={s.kpiUnit}>vs esperado</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Intervalo Médio</Text>
          <Text style={s.kpiValue}>{data.intervaloMedio > 0 ? fmtNum(data.intervaloMedio, 1) : "—"}</Text>
          <Text style={s.kpiUnit}>dias entre salgas</Text>
        </View>
      </View>
    </View>
  );
}

function Alertas({ alertas }: { alertas: AlertaPDF[] }) {
  if (alertas.length === 0) return null;
  return (
    <View style={{ marginBottom: 4 }}>
      {alertas.map((a, i) => (
        <View key={i} style={[s.alertBox, { backgroundColor: a.tipo === "warning" ? "#FFEBEE" : lightYellow }]}>
          <Text style={[s.alertText, { color: a.tipo === "warning" ? "#C62828" : "#B8860B" }]}>
            {a.tipo === "warning" ? "[!] " : "[i] "}{a.texto}
          </Text>
        </View>
      ))}
    </View>
  );
}

function MetricasCategoria({ metricas }: { metricas: CatMetricsPDF[] }) {
  if (metricas.length === 0) return null;

  const maxConsumo = Math.max(...metricas.map(m => m.consumoMedio), 1);

  return (
    <View>
      <Text style={s.sectionTitle}>MÉTRICAS POR CATEGORIA ANIMAL</Text>

      {/* Cards */}
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {metricas.map(m => (
          <View key={m.categoria} style={s.catCard}>
            <Text style={s.catTitle}>{m.categoria}</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
              <Text style={s.catValue}>{fmtNum(m.consumoMedio, 1)}</Text>
              <Text style={s.catUnit}>g/cab/dia</Text>
            </View>
            <View style={s.catRow}>
              <Text style={s.catLabel}>Animais</Text>
              <Text style={s.catData}>{fmtNum(m.totalAnimais)}</Text>
            </View>
            <View style={s.catRow}>
              <Text style={s.catLabel}>Sacos</Text>
              <Text style={s.catData}>{fmtNum(m.totalSacos)}</Text>
            </View>
            <View style={s.catRow}>
              <Text style={s.catLabel}>R$/cab/mês</Text>
              <Text style={s.catData}>{fmtBRL(m.custoMedio)}</Text>
            </View>
            <View style={s.catRow}>
              <Text style={s.catLabel}>R$/kg ganho</Text>
              <Text style={s.catData}>{m.custoPorKgGanho > 0 ? fmtBRL(m.custoPorKgGanho) : "—"}</Text>
            </View>
            <View style={s.catRow}>
              <Text style={s.catLabel}>GMD</Text>
              <Text style={s.catData}>{m.gmd > 0 ? `${fmtNum(m.gmd, 3)} kg/dia` : "—"}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Simple bar chart representation */}
      <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: green, marginBottom: 2 }}>Consumo por Categoria (g/cab/dia)</Text>
      <View style={s.barRow}>
        {metricas.map(m => {
          const height = maxConsumo > 0 ? Math.max(4, (m.consumoMedio / maxConsumo) * 70) : 4;
          return (
            <View key={m.categoria} style={s.barContainer}>
              <View style={[s.bar, { height, backgroundColor: green }]} />
              <Text style={s.barLabel}>{m.categoria}</Text>
              <Text style={s.barValue}>{fmtNum(m.consumoMedio, 1)}</Text>
            </View>
          );
        })}
      </View>

      {/* Table */}
      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, { width: "16%" }]}>Categoria</Text>
          <Text style={[s.tableHeaderCell, { width: "12%" }]}>Animais</Text>
          <Text style={[s.tableHeaderCell, { width: "16%" }]}>Consumo Médio</Text>
          <Text style={[s.tableHeaderCell, { width: "16%" }]}>Custo Total</Text>
          <Text style={[s.tableHeaderCell, { width: "14%" }]}>Custo/Animal</Text>
          <Text style={[s.tableHeaderCell, { width: "14%" }]}>Custo/kg</Text>
          <Text style={[s.tableHeaderCell, { width: "12%" }]}>GMD</Text>
        </View>
        {metricas.map((m, i) => (
          <View key={m.categoria} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
            <Text style={[s.tableCell, { width: "16%", fontFamily: "Helvetica-Bold" }]}>{m.categoria}</Text>
            <Text style={[s.tableCell, { width: "12%" }]}>{fmtNum(m.totalAnimais)}</Text>
            <Text style={[s.tableCell, { width: "16%" }]}>{fmtNum(m.consumoMedio, 1)} g/cab/dia</Text>
            <Text style={[s.tableCell, { width: "16%" }]}>{fmtBRL(m.custoTotal)}</Text>
            <Text style={[s.tableCell, { width: "14%" }]}>{fmtBRL(m.custoMedio)}</Text>
            <Text style={[s.tableCell, { width: "14%" }]}>{m.custoPorKgGanho > 0 ? fmtBRL(m.custoPorKgGanho) : "—"}</Text>
            <Text style={[s.tableCell, { width: "12%" }]}>{m.gmd > 0 ? fmtNum(m.gmd, 3) : "—"}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Tendencia({ tendencia }: { tendencia: TendenciaPDF[] }) {
  if (tendencia.length === 0) return null;
  return (
    <View>
      <Text style={s.sectionTitle}>TENDÊNCIA DE CONSUMO</Text>
      <View style={s.trendRow}>
        {tendencia.map((t, i) => (
          <View key={i} style={s.trendCell}>
            <Text style={s.trendPeriodo}>{t.periodo}</Text>
            <Text style={s.trendConsumo}>{fmtNum(t.consumo, 1)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Ranking({ ranking }: { ranking: RankingFazendaPDF[] }) {
  if (ranking.length === 0) return null;
  const cols = [
    { label: "#", width: "6%" },
    { label: "Fazenda", width: "24%" },
    { label: "Estado", width: "10%" },
    { label: "Consumo Médio", width: "18%" },
    { label: "Desvio", width: "14%" },
    { label: "Intervalo", width: "14%" },
    { label: "Lançamentos", width: "14%" },
  ];
  return (
    <View>
      <Text style={s.sectionTitle}>RANKING DE EFICIÊNCIA POR FAZENDA</Text>
      <View style={s.table}>
        <View style={s.tableHeader}>
          {cols.map(c => <Text key={c.label} style={[s.tableHeaderCell, { width: c.width }]}>{c.label}</Text>)}
        </View>
        {ranking.map((f, i) => (
          <View key={f.nome} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
            <Text style={[s.tableCell, { width: cols[0].width, fontFamily: "Helvetica-Bold" }]}>{i + 1}º</Text>
            <Text style={[s.tableCell, { width: cols[1].width }]}>{f.nome}</Text>
            <Text style={[s.tableCell, { width: cols[2].width }]}>{f.estado}</Text>
            <Text style={[s.tableCell, { width: cols[3].width }]}>{fmtNum(f.consumoMedio, 1)} g/cab/dia</Text>
            <Text style={[s.tableCell, { width: cols[4].width }]}>{fmtNum(f.desvio, 0)}%</Text>
            <Text style={[s.tableCell, { width: cols[5].width }]}>{fmtNum(f.intervaloMedio, 1)} dias</Text>
            <Text style={[s.tableCell, { width: cols[6].width }]}>{f.lancamentos}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text>CONSUBOV — Painel de Inteligência Nutricional</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

// ---------- Main Document ----------
export default function PainelInteligenciaPDF({ data }: { data: PainelPDFData }) {
  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <Header data={data} />
        <Filtros filtros={data.filtros} />
        <KPIs data={data} />
        <Alertas alertas={data.alertas} />
        <MetricasCategoria metricas={data.metricas} />
        <Tendencia tendencia={data.tendencia} />
        <Ranking ranking={data.ranking} />
        <Footer />
      </Page>
    </Document>
  );
}
