const CLOUDINARY_HOST = "res.cloudinary.com";
const IMAGE_UPLOAD_MARKER = "/image/upload/";

function isTransformPathSegment(segment: string): boolean {
  if (!segment) return false;
  if (segment.includes(",")) return true;
  return /^[a-z]{1,4}_/i.test(segment);
}

/**
 * Inserts or replaces Cloudinary delivery transformations for `res.cloudinary.com` URLs.
 * Non-Cloudinary URLs are returned unchanged (trimmed).
 */
export function transformCloudinaryUrl(
  url: string,
  opts: { width: number; height: number },
): string {
  if (!url || typeof url !== "string") return url;
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.hostname !== CLOUDINARY_HOST) return trimmed;
    if (u.pathname.includes("/s--")) return trimmed;
    const idx = u.pathname.indexOf(IMAGE_UPLOAD_MARKER);
    if (idx === -1) return trimmed;
    const prefix = u.pathname.slice(0, idx + IMAGE_UPLOAD_MARKER.length);
    let rest = u.pathname.slice(idx + IMAGE_UPLOAD_MARKER.length);
    const segment = `c_fill,w_${opts.width},h_${opts.height},q_auto,f_auto`;
    if (rest.startsWith(`${segment}/`) || rest === segment) return trimmed;

    while (rest.length > 0) {
      const slash = rest.indexOf("/");
      const head = slash === -1 ? rest : rest.slice(0, slash);
      if (!isTransformPathSegment(head)) break;
      rest = slash === -1 ? "" : rest.slice(slash + 1);
    }
    if (!rest) return trimmed;
    u.pathname = `${prefix}${segment}/${rest}`;
    return u.toString();
  } catch {
    return trimmed;
  }
}

export function isCloudinaryDeliveryUrl(url: string): boolean {
  const t = (url ?? "").trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.hostname === CLOUDINARY_HOST && u.pathname.includes(IMAGE_UPLOAD_MARKER);
  } catch {
    return false;
  }
}
