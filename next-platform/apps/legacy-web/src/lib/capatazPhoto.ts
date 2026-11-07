import { compressImageDataUrl, compressImageFileToDataUrl } from "@/lib/imageCompression";

const MAX_DATA_URL_LENGTH = 1_600_000;
const PREVIEW_TIMEOUT_MS = 15_000;

/** Wait for the same image decoder used by the on-screen preview before accepting a photo. */
function checkPreview(dataUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error("A foto demorou para carregar. Tire outra foto."));
    }, PREVIEW_TIMEOUT_MS);
    image.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("O aparelho não conseguiu exibir a foto. Tente novamente em JPG."));
    };
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a foto. Tente novamente."));
    reader.onabort = () => reject(new Error("A leitura da foto foi interrompida. Tente novamente."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("A câmera não devolveu uma foto válida."));
        return;
      }
      resolve(reader.result);
    };
    try {
      reader.readAsDataURL(file);
    } catch {
      reject(new Error("Não foi possível iniciar a leitura da foto."));
    }
  });
}

/**
 * Native Android/iOS camera pickers can return a JPEG/PNG with an empty MIME type
 * or application/octet-stream. Detect only trusted file signatures so images
 * aren't rejected, without accepting arbitrary files as photographs.
 */
async function normalizeCameraFile(file: File): Promise<File> {
  if (file.size === 0) {
    throw new Error("A câmera não devolveu uma foto. Tire novamente. [F01]");
  }

  if (file.type.startsWith("image/")) return file;
  if (file.type !== "" && file.type !== "application/octet-stream") {
    throw new Error("O arquivo selecionado não é uma imagem. [F02]");
  }

  const header = file.slice(0, 32);
  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(new Uint8Array(reader.result));
      else reject(new Error("Não foi possível identificar o formato da foto. [F05]"));
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo da câmera. [F05]"));
    reader.onabort = () => reject(new Error("A leitura do arquivo foi interrompida. [F05]"));
    reader.readAsArrayBuffer(header);
  });
  let mime: string | null = null;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) mime = "image/jpeg";
  else if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((b, i) => bytes[i] === b)) mime = "image/png";
  else if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8,12)) === "WEBP") mime = "image/webp";
  else if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4,8)) === "ftyp") {
    const brand = String.fromCharCode(...bytes.slice(8,12));
    if (["heic","heix","hevc","hevx","mif1","msf1"].includes(brand)) mime = "image/heic";
    if (brand === "avif") mime = "image/avif";
  }

  if (!mime) throw new Error("Formato da câmera não reconhecido. Tire a foto novamente. [F03]");
  // Retain the native camera bytes; the wrapper adds only missing MIME metadata.
  return new File([file], file.name || "foto-camera", { type: mime, lastModified: file.lastModified });
}

/**
 * Process JPEG frames produced by the in-app camera without converting them
 * back to a File and decoding with createImageBitmap a second time.
 *
 * Mirrors the deployed legacy's reliable FileReader -> data URL -> compression
 * path, while retaining our stricter preview and offline size protections.
 */
export async function prepareCapatazCameraBlob(blob: Blob): Promise<string> {
  if (!blob || blob.size === 0 || blob.type !== "image/jpeg") {
    throw new Error("A câmera não produziu uma foto JPEG válida. Tire novamente. [CAM08]");
  }
  const original = await readFileAsDataUrl(blob);
  const dataUrl = await compressImageDataUrl(original, {
    maxBytes: 380_000,
    maxDimension: 960,
    quality: 0.68,
  });
  if (!dataUrl || !/^data:image\/jpeg;base64,/i.test(dataUrl)
    || dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new Error("Não foi possível preparar a foto da câmera. Tire novamente. [CAM09]");
  }
  await checkPreview(dataUrl);
  return dataUrl;
}

/** Keep failures visible and never persist an undecodable camera result. */
export async function prepareCapatazPhoto(file: File): Promise<string> {
  const cameraFile = await normalizeCameraFile(file);
  let dataUrl: string | null = null;
  try {
    // Convert directly from File when supported, avoiding a huge base64 image on Android.
    dataUrl = await compressImageFileToDataUrl(cameraFile);
  } catch {
    // Older WebViews cannot always decode with createImageBitmap; retain FileReader fallback.
    const original = await readFileAsDataUrl(cameraFile);
    dataUrl = await compressImageDataUrl(original);
  }

  if (!dataUrl || !/^data:image\/[a-z0-9.+-]+;base64,/i.test(dataUrl)
    || dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new Error("Não foi possível preparar a foto para exibição. Tente novamente em JPG.");
  }

  await checkPreview(dataUrl);
  return dataUrl;
}
