import { supabase } from "@/integrations/supabase/client";
import { fetchWithConsultorTimeout, withConsultorTimeout } from "@/lib/consultorOffline/network";

/**
 * Pré-processamento de imagens para embutir no PDF.
 * Afeta APENAS a cópia embutida no PDF — o arquivo no Storage nunca é alterado.
 */
export const PDF_PHOTO_MAX_DIM = 1280;
/** Qualidade JPEG usada no PDF (20% abaixo do valor anterior de 0.6). */
export const PDF_PHOTO_QUALITY = 0.48;
/** Abaixo desse tamanho a foto já é pequena o bastante: recomprimir só gastaria CPU. */
const SKIP_RECOMPRESS_BYTES = 120 * 1024;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } catch { /* fallback abaixo */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** Redimensiona + comprime um blob de imagem para data URL JPEG. */
export async function compressImageBlobForPdf(
  blob: Blob,
  maxDim = PDF_PHOTO_MAX_DIM,
  quality = PDF_PHOTO_QUALITY,
): Promise<string> {
  if (blob.size <= SKIP_RECOMPRESS_BYTES) return blobToDataUrl(blob);
  let src: ImageBitmap | HTMLImageElement | null = null;
  try {
    src = await decode(blob);
    const sw = "width" in src ? src.width : 1;
    const sh = "height" in src ? src.height : 1;
    const scale = Math.min(1, maxDim / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));

    let out: Blob | null = null;
    if (typeof OffscreenCanvas !== "undefined") {
      const oc = new OffscreenCanvas(w, h);
      const ctx = oc.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
        out = await oc.convertToBlob({ type: "image/jpeg", quality });
      }
    }
    if (out) return await blobToDataUrl(out);

    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blobToDataUrl(blob);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return blobToDataUrl(blob);
  } finally {
    if (src && "close" in src) (src as ImageBitmap).close();
  }
}

/** Executa tarefas com concorrência limitada (evita travar a UI e saturar a rede). */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Baixa e pré-processa em paralelo todas as fotos da visita.
 * Assina as URLs em lote e comprime as imagens antes da montagem do documento.
 */
export async function prefetchFotosDataUrls(
  bucket: string,
  fotos: { id: string; url: string }[],
  concurrency = 2,
): Promise<Record<string, string | null>> {
  const cache: Record<string, string | null> = {};
  if (!fotos.length) return cache;

  // Deduplica por path — a mesma foto pode aparecer em mais de um bloco.
  const paths = Array.from(new Set(fotos.map(f => f.url)));
  const signedByPath = new Map<string, string>();
  try {
    const { data } = await withConsultorTimeout(
      supabase.storage.from(bucket).createSignedUrls(paths, 60 * 60),
      "assinatura das fotos do relatório",
    );
    for (const item of data ?? []) {
      const p = (item as { path?: string | null }).path;
      if (p && item.signedUrl) signedByPath.set(p, item.signedUrl);
    }
  } catch { /* fallback individual abaixo */ }

  const byPath: Record<string, string | null> = {};
  await mapWithConcurrency(paths, concurrency, async (path) => {
    try {
      let signed = signedByPath.get(path);
      if (!signed) {
        const { data } = await withConsultorTimeout(
          supabase.storage.from(bucket).createSignedUrl(path, 60 * 60),
          "assinatura da foto do relatório",
        );
        signed = data?.signedUrl ?? undefined;
      }
      if (!signed) { byPath[path] = null; return; }
      const res = await fetchWithConsultorTimeout(signed, "download da foto do relatório");
      const blob = await res.blob();
      byPath[path] = await compressImageBlobForPdf(blob);
    } catch {
      byPath[path] = null;
    }
  });

  for (const f of fotos) cache[f.id] = byPath[f.url] ?? null;
  return cache;
}
