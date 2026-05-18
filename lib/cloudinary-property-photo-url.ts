import { isCloudinaryDeliveryUrl, transformCloudinaryUrl } from "@/lib/cloudinary";
import { isSupabasePublicStorageUrl } from "@/lib/supabase/public-storage-url";
import {
  isSupabaseRenderUrl,
  supabasePropertyPhotoDisplayUrl,
  supabasePropertyPhotoHeroUrl,
} from "@/lib/supabase-image-url";

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

/** Card/gallery thumb: Cloudinary transform, Supabase render, or passthrough. */
export function propertyPhotoDisplayUrl(url: string): string {
  const t = (url ?? "").trim();
  if (!t) return t;
  if (isCloudinaryDeliveryUrl(t)) return cloudinaryPropertyPhotoDisplayUrl(t);
  if (isSupabasePublicStorageUrl(t)) return supabasePropertyPhotoDisplayUrl(t);
  return t;
}

/** Featured hero: Cloudinary transform, Supabase render, or passthrough. */
export function propertyPhotoHeroUrl(url: string): string {
  const t = (url ?? "").trim();
  if (!t) return t;
  if (isCloudinaryDeliveryUrl(t)) return cloudinaryPropertyPhotoHeroUrl(t);
  if (isSupabasePublicStorageUrl(t)) return supabasePropertyPhotoHeroUrl(t);
  return t;
}

/** CDN/pre-sized URLs that should skip the Next.js image optimizer. */
export function isPreOptimizedPropertyPhotoUrl(url: string): boolean {
  const t = (url ?? "").trim();
  if (!t) return false;
  return isCloudinaryDeliveryUrl(t) || isSupabaseRenderUrl(t);
}
