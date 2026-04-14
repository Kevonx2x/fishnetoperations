/** Transform segment inserted after `/image/upload/` for listing photos from `property_photos`. */
const CLOUDINARY_LISTING_TRANSFORM = "w_800,q_auto,f_auto";

/**
 * For Cloudinary URLs only: inserts `w_800,q_auto,f_auto` after `/upload/` so images are served at 800px width with automatic quality/format.
 * Supabase and other URLs are returned unchanged.
 */
export function cloudinaryPropertyPhotoDisplayUrl(url: string): string {
  if (!url || typeof url !== "string") return url;
  const trimmed = url.trim();
  if (!/res\.cloudinary\.com/.test(trimmed)) return trimmed;
  if (trimmed.includes(`/${CLOUDINARY_LISTING_TRANSFORM}/`)) return trimmed;
  try {
    const u = new URL(trimmed);
    const path = u.pathname;
    let m = path.match(/^(.*\/image\/upload\/)(v\d+\/.+)$/);
    if (m) {
      u.pathname = `${m[1]}${CLOUDINARY_LISTING_TRANSFORM}/${m[2]}`;
      return u.toString();
    }
    m = path.match(/^(.*\/image\/upload\/)([^/]+\/)(v\d+\/.+)$/);
    if (m) {
      u.pathname = `${m[1]}${CLOUDINARY_LISTING_TRANSFORM}/${m[3]}`;
      return u.toString();
    }
  } catch {
    /* keep original */
  }
  return trimmed;
}
