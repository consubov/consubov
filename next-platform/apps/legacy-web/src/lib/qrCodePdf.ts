import QRCode from "qrcode";

/**
 * Generates a PNG data URI for a QR code that can be used as an
 * image source in @react-pdf/renderer's <Image /> component.
 */
export async function createQrCodeDataUri(value: string, size = 400): Promise<string> {
  return QRCode.toDataURL(value, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}
