import { transformCloudinaryUrl } from "@/lib/cloudinary";

/** Listing card / carousel thumbnails (~4:3 crop). */
export function cloudinaryPropertyPhotoDisplayUrl(url: string): string {
  if (!url || typeof url !== "string") return url;
  return transformCloudinaryUrl(url.trim(), { width: 640, height: 480 });
}

/** Larger homepage “featured property” hero image. */
export function cloudinaryPropertyPhotoHeroUrl(url: string): string {
  if (!url || typeof url !== "string") return url;
  return transformCloudinaryUrl(url.trim(), { width: 1280, height: 720 });
}
