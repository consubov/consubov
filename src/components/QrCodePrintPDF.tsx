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
  qrImageSrc: string;
  nome: string;
  retiro_nome?: string;
}

interface QrCodePrintPDFProps {
  items: QrCodePdfItem[];
}

const PAGE_SIZE = 4;

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingRight: 28,
    paddingBottom: 40,
    paddingLeft: 28,
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
  },
  grid: {
    flexDirection: "column",
    height: "100%",
  },
  row: {
    flexDirection: "row",
    flex: 1,
  },
  rowSpacing: {
    marginTop: 12,
  },
  slot: {
    flex: 1,
  },
  slotLeft: {
    marginRight: 6,
  },
  slotRight: {
    marginLeft: 6,
  },
  card: {
    height: "100%",
    border: "1 solid #D1D5DB",
    borderRadius: 10,
    paddingTop: 18,
    paddingRight: 16,
    paddingBottom: 18,
    paddingLeft: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  emptySlot: {
    height: "100%",
  },
  qrImage: {
    width: 150,
    height: 150,
    marginBottom: 14,
  },
  title: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: "#6B7280",
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#9CA3AF",
  },
});

export default function QrCodePrintPDF({ items }: QrCodePrintPDFProps) {
  const pages = buildFixedPages(items, PAGE_SIZE);

  return (
    <Document>
      {pages.map((pageItems, pageIndex) => (
        <Page key={`qr-page-${pageIndex}`} size="A4" orientation="portrait" style={styles.page}>
          <View style={styles.grid}>
            {[0, 1].map((rowIndex) => {
              const rowItems = pageItems.slice(rowIndex * 2, rowIndex * 2 + 2);

              return (
                <View
                  key={`row-${pageIndex}-${rowIndex}`}
                  style={rowIndex === 1 ? [styles.row, styles.rowSpacing] : styles.row}
                >
                  {rowItems.map((item, columnIndex) => (
                    <View
                      key={`slot-${pageIndex}-${rowIndex}-${columnIndex}`}
                      style={columnIndex === 0 ? [styles.slot, styles.slotLeft] : [styles.slot, styles.slotRight]}
                    >
                      {item ? (
                        <View style={styles.card}>
                          <Image src={item.qrImageSrc} style={styles.qrImage} />
                          <Text style={styles.title}>{item.nome}</Text>
                          <Text style={styles.subtitle}>{item.retiro_nome || "—"}</Text>
                        </View>
                      ) : (
                        <View style={styles.emptySlot} />
                      )}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>

          <View style={styles.footer} fixed>
            <Text>QR Codes para impressão</Text>
            <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
          </View>
        </Page>
      ))}
    </Document>
  );
}
