import { fetchPdfBinaryWithTimeout, downloadGeneratedPdf } from "@/lib/reportPdfExport";
// Baixa um PDF como arquivo local (blob) para evitar mostrar a URL bruta do
// Storage na barra de navegação. Fluxos sensíveis podem desativar o fallback
// remoto para garantir que a URL técnica nunca seja aberta no navegador.
export async function downloadPdfFromUrl(
  url: string,
  filename: string,
  options: { allowRemoteFallback?: boolean } = {},
): Promise<void> {
  const name = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;

  const clickAnchor = (href: string, useDownload: boolean) => {
    const a = document.createElement("a");
    a.href = href;
    if (useDownload) a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  try {
    const blob = await fetchPdfBinaryWithTimeout(url);
    if ((await blob.slice(0, 5).text()) !== "%PDF-") throw new Error("Arquivo retornado não é um PDF");
    downloadGeneratedPdf(blob, name);
  } catch (error) {
    if (options.allowRemoteFallback === false) throw error;
    // Fallback: força download via query param sem navegar para a URL bruta.
    const sep = url.includes("?") ? "&" : "?";
    const dl = `${url}${sep}download=${encodeURIComponent(name)}`;
    clickAnchor(dl, true);
  }
}
