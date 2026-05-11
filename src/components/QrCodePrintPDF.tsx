import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { buildFixedPages } from "@/lib/qrCodeLayout";

export interface QrCodePdfItem {
  id: string;
  qrDataUri: string;
  nome: string;
  retiro_nome?: string;
}

interface QrCodePrintPDFProps {
  items: QrCodePdfItem[];
  fazendaNome?: string;
  logoUrl?: string;
}

const PAGE_SIZE = 4;

const s = StyleSheet.create({
  page: {
    padding: 30,
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
  },
  grid: {
    flexDirection: "column",
    height: "100%",
    gap: 14,
  },
  row: {
    flexDirection: "row",
    flex: 1,
    gap: 14,
  },
  slot: {
    flex: 1,
  },
  card: {
    height: "100%",
    border: "1 solid #D1D5DB",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 8,
    backgroundColor: "#FFFFFF",
  },
  cardHeader: {
    alignItems: "center",
  },
  cardLogo: {
    width: 130,
    height: 32,
    objectFit: "contain",
  },
  cardFazenda: {
    fontSize: 5.5,
    color: "#555555",
    textAlign: "center",
    marginTop: 1,
    marginBottom: 0,
  },
  emptySlot: {
    height: "100%",
  },
  qrImage: {
    width: 81,
    height: 81,
    flexShrink: 0,
    marginTop: 4,
    marginBottom: 4,
  },
  title: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 7.5,
    color: "#6B7280",
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    left: 30,
    right: 30,
    bottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#9CA3AF",
  },
});

export default function QrCodePrintPDF({ items, fazendaNome, logoUrl }: QrCodePrintPDFProps) {
  const pages = buildFixedPages(items, PAGE_SIZE);
  const resolvedLogo =
    logoUrl ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/logo-consubov-print.png`
      : "/logo-consubov-print.png");

  const renderCard = (item: QrCodePdfItem) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Image src={resolvedLogo} style={s.cardLogo} />
        {fazendaNome ? <Text style={s.cardFazenda}>{fazendaNome}</Text> : null}
      </View>
      <Image src={item.qrDataUri} style={s.qrImage} />
      <Text style={s.title}>{item.nome}</Text>
      <Text style={s.subtitle}>{item.retiro_nome || "—"}</Text>
    </View>
  );

  return (
    <Document>
      {pages.map((pageItems, pageIndex) => (
        <Page
          key={`qr-page-${pageIndex}`}
          size="A4"
          orientation="portrait"
          style={s.page}
        >
          <View style={s.grid}>
            {[0, 1].map((rowIndex) => {
              const first = pageItems[rowIndex * 2];
              const second = pageItems[rowIndex * 2 + 1];

              return (
                <View key={`row-${rowIndex}`} style={s.row}>
                  <View style={s.slot}>
                    {first ? renderCard(first) : <View style={s.emptySlot} />}
                  </View>
                  <View style={s.slot}>
                    {second ? renderCard(second) : <View style={s.emptySlot} />}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={s.footer} fixed>
            <Text>QR Codes para impressão</Text>
            <Text
              render={({ pageNumber, totalPages }) =>
                `Página ${pageNumber} de ${totalPages}`
              }
            />
          </View>
        </Page>
      ))}
    </Document>
  );
}
