/** Defaults match dormspace listing photo compression (1600px edge, JPEG 0.8). */
export const CLIENT_IMAGE_MAX_EDGE_PX = 1600;
export const CLIENT_IMAGE_JPEG_QUALITY = 0.8;

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|bmp|heic|heif|avif)$/i;

export type CompressClientImageOptions = {
  maxEdgePx?: number;
  jpegQuality?: number;
};

export function isPdfClientFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "application/pdf") return true;
  return /\.pdf$/i.test(file.name);
}

export function isGifClientFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/gif") return true;
  return /\.gif$/i.test(file.name);
}

function hasImageLikeExtension(file: File): boolean {
  return IMAGE_EXTENSIONS.test(file.name);
}

/** True when the file should be compressed to JPEG (not PDF/GIF and plausibly an image). */
export function shouldCompressClientImage(file: File): boolean {
  if (isPdfClientFile(file) || isGifClientFile(file)) return false;

  const type = file.type.toLowerCase();
  if (type.startsWith("image/")) return true;
  if (!type || type === "application/octet-stream") return true;
  if (hasImageLikeExtension(file)) return true;

  return false;
}

async function loadImageElement(blobUrl: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not read image"));
    el.src = blobUrl;
  });
}

async function encodeJpegFile(
  file: File,
  img: HTMLImageElement,
  maxEdgePx: number,
  jpegQuality: number,
): Promise<File | null> {
  const longest = Math.max(img.width, img.height);
  const scale = longest > maxEdgePx ? maxEdgePx / longest : 1;
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", jpegQuality);
  });
  if (!blob) return null;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

/**
 * Resize raster images in-browser; returns original file for PDF/GIF or when decode fails.
 * Empty/missing MIME (common on mobile) is still attempted via canvas decode.
 */
export async function compressClientImage(
  file: File,
  options?: CompressClientImageOptions,
): Promise<File> {
  if (!shouldCompressClientImage(file)) return file;

  const maxEdgePx = options?.maxEdgePx ?? CLIENT_IMAGE_MAX_EDGE_PX;
  const jpegQuality = options?.jpegQuality ?? CLIENT_IMAGE_JPEG_QUALITY;

  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(blobUrl);
    const compressed = await encodeJpegFile(file, img, maxEdgePx, jpegQuality);
    return compressed ?? file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export async function compressClientImages(
  files: File[],
  options?: CompressClientImageOptions,
): Promise<File[]> {
  return Promise.all(files.map((file) => compressClientImage(file, options)));
}
