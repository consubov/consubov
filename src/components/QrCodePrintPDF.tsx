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
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  cardLogo: {
    height: 32,
    width: "auto",
    objectFit: "contain",
    marginBottom: 4,
  },
  cardFazenda: {
    fontSize: 10,
    color: "#555555",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySlot: {
    height: "100%",
  },
  qrImage: {
    width: 160,
    height: 160,
    marginBottom: 12,
  },
  title: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 9,
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
      <Image src={resolvedLogo} style={s.cardLogo} />
      {fazendaNome ? <Text style={s.cardFazenda}>{fazendaNome}</Text> : null}
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
                    {first ? (
                      <View style={s.card}>
                        <Image src={first.qrDataUri} style={s.qrImage} />
                        <Text style={s.title}>{first.nome}</Text>
                        <Text style={s.subtitle}>
                          {first.retiro_nome || "—"}
                        </Text>
                      </View>
                    ) : (
                      <View style={s.emptySlot} />
                    )}
                  </View>
                  <View style={s.slot}>
                    {second ? (
                      <View style={s.card}>
                        <Image src={second.qrDataUri} style={s.qrImage} />
                        <Text style={s.title}>{second.nome}</Text>
                        <Text style={s.subtitle}>
                          {second.retiro_nome || "—"}
                        </Text>
                      </View>
                    ) : (
                      <View style={s.emptySlot} />
                    )}
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
