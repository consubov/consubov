import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";

/**
 * Generates a data URI for a QR code SVG that can be used as an
 * image source in @react-pdf/renderer's <Image /> component.
 */
export function createQrCodeDataUri(value: string, size = 400): string {
  const svgMarkup = renderToStaticMarkup(
    <QRCodeSVG
      value={value}
      size={size}
      level="H"
      includeMargin
      bgColor="#FFFFFF"
      fgColor="#000000"
    />,
  );

  // Encode as a data URI for @react-pdf/renderer
  const encoded = encodeURIComponent(svgMarkup);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}
