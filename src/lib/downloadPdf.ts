// Baixa um PDF como arquivo local (blob) para evitar mostrar a URL bruta do
// Storage na barra de navegação. Em caso de falha, usa fallback com `?download=`
// (aceito pelo Supabase Storage) — que envia Content-Disposition: attachment.
export async function downloadPdfFromUrl(url: string, filename: string): Promise<void> {
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
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("fetch failed");
    const blob = await resp.blob();
    const objUrl = URL.createObjectURL(blob);
    clickAnchor(objUrl, true);
    setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
  } catch {
    // Fallback: força download via query param sem navegar para a URL bruta.
    const sep = url.includes("?") ? "&" : "?";
    const dl = `${url}${sep}download=${encodeURIComponent(name)}`;
    clickAnchor(dl, true);
  }
}
