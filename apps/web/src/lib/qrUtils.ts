/**
 * QR utilities used across the web app.
 * Provides helpers for extracting resource identifiers from raw scanner input.
 */

/**
 * Extracts a UUID-shaped identifier from a raw string that may be a plain value
 * or a URL containing it. Authorization is not derived from QR contents.
 */
export function extractQrUuid(raw: string): string | null {
  const trimmed = raw.trim();
  // UUID regex (case‑insensitive)
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = trimmed.match(uuidRegex);
  return match ? match[0] : null;
}

/**
 * Generate a QR code data URI using the external qrcode library.
 * This function is a thin wrapper around `qrCodePdf.createQrCodeDataUri`.
 * It is kept here for convenience and to centralise QR generation.
 */
export async function generateQrDataUri(value: string, size = 400): Promise<string> {
  // Lazy‑load the qrcode library to avoid importing it in environments where not needed.
  const { default: QRCode } = await import("qrcode");
  return QRCode.toDataURL(value, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}