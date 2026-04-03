import {
  Document, Page, Text, View, StyleSheet,
} from "@react-pdf/renderer";
import { consumoStatusUnificado } from "@/lib/consumoCalc";

// ---------- Types ----------
export interface RelatorioPDFData {
  fazendaNome: string;
  periodo: string;
  dataGeracao: string;
  geradoPor: string;
  retiros: RetiroReportData[];
}

export interface PastoReportData {
  nome: string;
  numAnimais: number;
  numSacos: number;
  consumoGCabDia: number;
  status: string;
  pesoMedioKg: number;
  gmdKgDia: number;
  pesoAbateMetaKg: number;
}

export interface RetiroReportData {
  nome: string;
  capataz: string;
  totalAnimais: number;
  sacosUtilizados: number;
  consumoMedio: number;
  gmd: number;
  data: string;
  produtoNome: string;
  precoKg: number;
  eficiencia: number;
  custoDiario: number;
  score: number;
  scoreMeta: number;
  scoreCocho: number;
  scoreSalga: number;
  pastos: PastoReportData[];
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

function fmtNum(n: number, d = 0) {
  return n.toFixed(d).replace(".", ",");
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
  const cols = [
    { label: "#", width: "5%" },
    { label: "Retiro", width: "20%" },
    { label: "Capataz", width: "20%" },
    { label: "Score", width: "15%" },
    { label: "Meta", width: "13%" },
    { label: "Cocho", width: "13%" },
    { label: "Salga", width: "14%" },
  ];
  return (
    <View>
      <Text style={s.sectionTitle}>SEÇÃO 2 — SCORE DE EFICIÊNCIA</Text>
      <View style={s.table}>
        <View style={s.tableHeader}>
          {cols.map(c => <Text key={c.label} style={[s.tableHeaderCell, { width: c.width }]}>{c.label}</Text>)}
        </View>
        {sorted.map((r, i) => (
          <View key={r.nome} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
            <Text style={[s.tableCell, { width: cols[0].width }]}>{i + 1}</Text>
            <Text style={[s.tableCell, { width: cols[1].width }]}>{r.nome}</Text>
            <Text style={[s.tableCell, { width: cols[2].width }]}>{r.capataz}</Text>
            <Text style={[s.tableCell, { width: cols[3].width, fontFamily: "Helvetica-Bold" }]}>{fmtNum(r.score, 1)}</Text>
            <Text style={[s.tableCell, { width: cols[4].width }]}>{fmtNum(r.scoreMeta, 1)}</Text>
            <Text style={[s.tableCell, { width: cols[5].width }]}>{fmtNum(r.scoreCocho, 1)}</Text>
            <Text style={[s.tableCell, { width: cols[6].width }]}>{fmtNum(r.scoreSalga, 1)}</Text>
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

function DetalheRetiro({ r }: { r: RetiroReportData }) {
  const sortedPastos = [...r.pastos].sort((a, b) => b.consumoGCabDia - a.consumoGCabDia);
  const baixo = r.pastos.filter(p => consumoStatusUnificado(p.consumoGCabDia) === "Baixo");
  const atencao = r.pastos.filter(p => consumoStatusUnificado(p.consumoGCabDia) === "Atenção");
  const alto = r.pastos.filter(p => consumoStatusUnificado(p.consumoGCabDia) === "Alto");

  const cols = [
    { label: "Pasto", width: "22%" },
    { label: "Animais", width: "14%" },
    { label: "Sacos", width: "12%" },
    { label: "Consumo (g/cab/dia)", width: "26%" },
    { label: "Status", width: "26%" },
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
        <View style={s.card}><Text style={s.cardLabel}>Eficiência</Text><Text style={s.cardValue}>{fmtNum(r.eficiencia, 0)}%</Text></View>
        <View style={s.card}><Text style={s.cardLabel}>Custo R$/cab</Text><Text style={s.cardValue}>{fmtNum(r.custoDiario, 2)}</Text></View>
      </View>

      {baixo.length > 0 && (
        <View style={s.alertBox}>
          <Text style={[s.alertText, { color: "#C62828" }]}>[!] Baixo (&lt;70g): {baixo.map(p => p.nome).join(", ")}</Text>
        </View>
      )}
      {atencao.length > 0 && (
        <View style={s.alertBox}>
          <Text style={[s.alertText, { color: "#F9A825" }]}>[!] Atenção (70–80g): {atencao.map(p => p.nome).join(", ")}</Text>
        </View>
      )}
      {alto.length > 0 && (
        <View style={s.alertBox}>
          <Text style={[s.alertText, { color: "#1565C0" }]}>[!] Alto (&gt;120g): {alto.map(p => p.nome).join(", ")}</Text>
        </View>
      )}

      <View style={[s.table, { marginTop: 2 }]}>
        <View style={s.tableHeader}>
          {cols.map(c => <Text key={c.label} style={[s.tableHeaderCell, { width: c.width }]}>{c.label}</Text>)}
        </View>
        {sortedPastos.map((p, i) => {
          const st = consumoStatusUnificado(p.consumoGCabDia);
          const sc = statusColor(st);
          return (
            <View key={p.nome} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.tableCell, { width: cols[0].width }]}>{p.nome}</Text>
              <Text style={[s.tableCell, { width: cols[1].width }]}>{p.numAnimais}</Text>
              <Text style={[s.tableCell, { width: cols[2].width }]}>{p.numSacos}</Text>
              <Text style={[s.tableCell, { width: cols[3].width }]}>{fmtNum(p.consumoGCabDia, 1)}</Text>
              <Text style={[s.tableCell, { width: cols[4].width, color: sc.color, fontFamily: "Helvetica-Bold" }]}>{st}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ---------- Main Document (continuous layout) ----------
export default function RelatorioPDF({ data }: { data: RelatorioPDFData }) {
  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <Header data={data} />
        <ResumoGeral retiros={data.retiros} />
        <ScoreEficiencia retiros={data.retiros} />
        <RankingGMD retiros={data.retiros} />
        <PrevisaoAbate retiros={data.retiros} />

        <Text style={s.sectionTitle}>SEÇÃO 5 — DETALHE POR RETIRO</Text>
        {data.retiros.map(r => (
          <DetalheRetiro key={r.nome} r={r} />
        ))}

        <Footer fazendaNome={data.fazendaNome} />
      </Page>
    </Document>
  );
}
