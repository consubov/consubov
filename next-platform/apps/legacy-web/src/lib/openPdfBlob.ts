import { fetchPdfBinaryWithTimeout } from "@/lib/reportPdfExport";
// Abre um PDF do Consultor via blob URL, escondendo a URL técnica do Supabase.
export async function openPdfBlobUrl(url: string) {
  try {
    const blob = await fetchPdfBinaryWithTimeout(url);
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank", "noopener");
    // Revoga depois de alguns minutos para liberar memória.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
