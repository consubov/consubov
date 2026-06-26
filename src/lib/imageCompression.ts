export interface ImageCompressionOptions {
  maxDimension?: number;
  quality?: number;
  maxBytes?: number;
}

function dataUrlByteSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.ceil((payload.length * 3) / 4);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível processar a foto'));
    img.src = src;
  });
}

export async function compressImageDataUrl(
  dataUrl: string | null | undefined,
  options: ImageCompressionOptions = {},
): Promise<string | null> {
  if (!dataUrl) return null;
  if (!dataUrl.startsWith('data:image/')) return dataUrl;

  const maxBytes = options.maxBytes ?? 450_000;
  const baseMaxDimension = options.maxDimension ?? 1024;
  const baseQuality = options.quality ?? 0.7;

  try {
    if (dataUrlByteSize(dataUrl) <= maxBytes) return dataUrl;

    const img = await loadImage(dataUrl);
    let maxDimension = baseMaxDimension;
    let quality = baseQuality;
    let best = dataUrl;

    for (let attempt = 0; attempt < 5; attempt++) {
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return best;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const compressed = canvas.toDataURL('image/jpeg', quality);
      best = compressed;
      canvas.width = 0;
      canvas.height = 0;

      if (dataUrlByteSize(compressed) <= maxBytes) return compressed;
      maxDimension = Math.max(480, Math.floor(maxDimension * 0.8));
      quality = Math.max(0.45, quality - 0.08);
    }

    return best;
  } catch (err) {
    console.warn('[imageCompression] falha ao comprimir foto:', err);
    return dataUrl;
  }
}