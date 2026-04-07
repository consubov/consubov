import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Falha ao carregar a imagem do QR Code."));
    image.src = src;
  });
}

export async function createQrCodePngDataUrl(value: string, size = 512) {
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

  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Falha ao preparar o canvas do QR Code.");
    }

    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, size, size);
    context.drawImage(image, 0, 0, size, size);

    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
