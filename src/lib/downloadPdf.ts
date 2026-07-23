// Baixa um PDF a partir de uma URL como arquivo (evita expor a URL bruta
// do Storage no navegador). Se falhar, cai para abrir a URL em nova aba.
export async function downloadPdfFromUrl(url: string, filename: string): Promise<void> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("fetch failed");
    const blob = await resp.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
