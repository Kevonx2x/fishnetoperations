import { isCloudinaryDeliveryUrl, transformCloudinaryUrl } from "@/lib/cloudinary";
import { isSupabasePublicStorageUrl } from "@/lib/supabase/public-storage-url";
import {
  isSupabaseRenderUrl,
  supabasePropertyPhotoDisplayUrl,
  supabasePropertyPhotoHeroUrl,
  supabasePropertyPhotoSpotlightUrl,
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

/** Spotlight hero — higher resolution for the large homepage feature card. */
export function cloudinaryPropertyPhotoSpotlightUrl(url: string): string {
  if (!url || typeof url !== "string") return url;
  return transformCloudinaryUrl(url.trim(), { width: 1600, height: 1000 });
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

/** Spotlight feature card — largest transform used on the homepage. */
export function propertyPhotoSpotlightUrl(url: string): string {
  const t = (url ?? "").trim();
  if (!t) return t;
  if (isCloudinaryDeliveryUrl(t)) return cloudinaryPropertyPhotoSpotlightUrl(t);
  if (isSupabasePublicStorageUrl(t)) return supabasePropertyPhotoSpotlightUrl(t);
  return t;
}

/** CDN/pre-sized URLs that should skip the Next.js image optimizer. */
export function isPreOptimizedPropertyPhotoUrl(url: string): boolean {
  const t = (url ?? "").trim();
  if (!t) return false;
  return isCloudinaryDeliveryUrl(t) || isSupabaseRenderUrl(t);
}
