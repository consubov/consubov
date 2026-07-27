import { compressImageFileToDataUrl, type ImageCompressionOptions } from "@/lib/imageCompression";

export interface BlobDiagnostic {
  kind: string;
  constructorName?: string;
  isBlob: boolean;
  isFile: boolean;
  size?: number;
  type?: string;
}

export interface PreparedConsultorPhoto {
  dataUrl: string;
  blob: Blob;
}

export function getBlobDiagnostic(value: unknown): BlobDiagnostic {
  const maybeBlob = value as Partial<Blob> | null | undefined;
  return {
    kind: Object.prototype.toString.call(value),
    constructorName: value && typeof value === "object" ? value.constructor?.name : undefined,
    isBlob: typeof Blob !== "undefined" && value instanceof Blob,
    isFile: typeof File !== "undefined" && value instanceof File,
    size: typeof maybeBlob?.size === "number" ? maybeBlob.size : undefined,
    type: typeof maybeBlob?.type === "string" ? maybeBlob.type : undefined,
  };
}

export function assertValidPhotoBlob(value: unknown, label = "foto"): asserts value is Blob {
  const diagnostic = getBlobDiagnostic(value);
  if (!diagnostic.isBlob || typeof (value as Blob).arrayBuffer !== "function") {
    throw new Error(`${label}: arquivo de imagem inválido para armazenamento local`);
  }
  if ((value as Blob).size <= 0) {
    throw new Error(`${label}: arquivo de imagem vazio`);
  }
}

export function dataUrlToPhotoBlob(dataUrl: string): Blob {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    throw new Error("Imagem processada em formato inválido");
  }
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Imagem processada sem dados");
  const meta = dataUrl.slice(0, comma);
  const b64 = dataUrl.slice(comma + 1);
  const mime = /data:(.*?);base64/.exec(meta)?.[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], { type: mime });
  assertValidPhotoBlob(blob, "foto processada");
  return blob;
}

export async function clonePhotoBlob(value: Blob, mimeFallback = "image/jpeg"): Promise<{ blob: Blob; buffer: ArrayBuffer }> {
  assertValidPhotoBlob(value);
  const buffer = await value.arrayBuffer();
  if (buffer.byteLength <= 0) throw new Error("foto: dados vazios após leitura local");
  const blob = new Blob([buffer.slice(0)], { type: value.type || mimeFallback });
  assertValidPhotoBlob(blob, "foto normalizada");
  return { blob, buffer };
}

export async function prepareConsultorPhotoFile(
  file: File,
  options: ImageCompressionOptions = { maxDimension: 1600, quality: 0.78, maxBytes: 900_000 },
): Promise<PreparedConsultorPhoto> {
  assertValidPhotoBlob(file, file.name || "foto selecionada");
  const dataUrl = await compressImageFileToDataUrl(file, options);
  if (!dataUrl) throw new Error("Falha ao processar imagem");
  const blob = dataUrlToPhotoBlob(dataUrl);
  await clonePhotoBlob(blob, blob.type || file.type || "image/jpeg");
  return { dataUrl, blob };
}