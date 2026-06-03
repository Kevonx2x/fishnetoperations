/** Defaults match dormspace listing photo compression (1600px edge, JPEG 0.8). */
export const CLIENT_IMAGE_MAX_EDGE_PX = 1600;
export const CLIENT_IMAGE_JPEG_QUALITY = 0.8;

export type CompressClientImageOptions = {
  maxEdgePx?: number;
  jpegQuality?: number;
};

/** Resize raster images in-browser; returns original file for non-raster / GIF. */
export async function compressClientImage(
  file: File,
  options?: CompressClientImageOptions,
): Promise<File> {
  const maxEdgePx = options?.maxEdgePx ?? CLIENT_IMAGE_MAX_EDGE_PX;
  const jpegQuality = options?.jpegQuality ?? CLIENT_IMAGE_JPEG_QUALITY;

  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read image"));
      el.src = blobUrl;
    });

    const longest = Math.max(img.width, img.height);
    const scale = longest > maxEdgePx ? maxEdgePx / longest : 1;
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", jpegQuality);
    });
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
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
