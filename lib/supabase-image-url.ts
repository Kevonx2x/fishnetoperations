import { isSupabasePublicStorageUrl } from "@/lib/supabase/public-storage-url";

const OBJECT_PUBLIC_PREFIX = "/storage/v1/object/public/";
const RENDER_PUBLIC_PREFIX = "/storage/v1/render/image/public/";

export type SupabaseRenderOpts = {
  width: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
};

/** True when `url` uses Supabase Storage image rendering (`/render/image/public/`). */
export function isSupabaseRenderUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const u = new URL(url.trim());
    return (
      u.protocol === "https:" &&
      u.hostname.endsWith(".supabase.co") &&
      u.pathname.startsWith(RENDER_PUBLIC_PREFIX)
    );
  } catch {
    return false;
  }
}

/**
 * Build a Supabase Storage render URL from a public object URL.
 * Non-Supabase URLs are returned unchanged (trimmed).
 */
export function supabaseRenderUrl(originalUrl: string, opts: SupabaseRenderOpts): string {
  if (!originalUrl || typeof originalUrl !== "string") return originalUrl;
  const trimmed = originalUrl.trim();
  if (!trimmed) return trimmed;

  if (isSupabaseRenderUrl(trimmed)) {
    try {
      const u = new URL(trimmed);
      u.searchParams.set("width", String(opts.width));
      if (opts.height != null) u.searchParams.set("height", String(opts.height));
      u.searchParams.set("resize", opts.resize ?? "cover");
      u.searchParams.set("quality", String(opts.quality ?? 80));
      if (!u.searchParams.has("format")) u.searchParams.set("format", "webp");
      return u.toString();
    } catch {
      return trimmed;
    }
  }

  if (!isSupabasePublicStorageUrl(trimmed)) return trimmed;

  try {
    const u = new URL(trimmed);
    if (!u.pathname.startsWith(OBJECT_PUBLIC_PREFIX)) return trimmed;
    u.pathname = RENDER_PUBLIC_PREFIX + u.pathname.slice(OBJECT_PUBLIC_PREFIX.length);
    u.searchParams.set("width", String(opts.width));
    if (opts.height != null) u.searchParams.set("height", String(opts.height));
    u.searchParams.set("resize", opts.resize ?? "cover");
    u.searchParams.set("quality", String(opts.quality ?? 80));
    if (!u.searchParams.has("format")) u.searchParams.set("format", "webp");
    return u.toString();
  } catch {
    return trimmed;
  }
}

/** ~28–80px avatars @2x — 200×200 cover. */
export function supabaseAvatarRenderUrl(url: string): string {
  return supabaseRenderUrl(url, { width: 200, height: 200, quality: 80, resize: "cover" });
}

/** Listing card thumb — mirrors Cloudinary 640×480 c_fill. */
export function supabasePropertyPhotoDisplayUrl(url: string): string {
  return supabaseRenderUrl(url, { width: 640, height: 480, quality: 75, resize: "cover" });
}

/** Homepage featured property hero. */
export function supabasePropertyPhotoHeroUrl(url: string): string {
  return supabaseRenderUrl(url, { width: 1280, height: 720, quality: 80, resize: "cover" });
}

/** Homepage spotlight listing — larger hero for the feature card. */
export function supabasePropertyPhotoSpotlightUrl(url: string): string {
  return supabaseRenderUrl(url, { width: 1600, height: 1000, quality: 85, resize: "cover" });
}

let loggedRenderFallbackWarning = false;

/** Log once when falling back to the original object URL (e.g. render API unavailable). */
export function warnSupabaseRenderFallback(context: string): void {
  if (loggedRenderFallbackWarning) return;
  loggedRenderFallbackWarning = true;
  console.warn(
    `[BahayGo] Supabase image render URL could not be used (${context}). ` +
      "Serving original storage URL — enable Image Transformations in Supabase Storage settings.",
  );
}

/**
 * Prefer render URL; on failure signal, return original public object URL.
 * Used by avatars so a broken render path does not blank the image.
 */
export function supabaseAvatarImageSrc(originalUrl: string): string {
  const trimmed = originalUrl.trim();
  if (!isSupabasePublicStorageUrl(trimmed)) return trimmed;
  return supabaseAvatarRenderUrl(trimmed);
}

/** Undo render URL → original public object URL (fallback when render API fails). */
export function supabaseObjectUrlFromRenderUrl(renderUrl: string): string | null {
  if (!isSupabaseRenderUrl(renderUrl)) return null;
  try {
    const u = new URL(renderUrl.trim());
    if (!u.pathname.startsWith(RENDER_PUBLIC_PREFIX)) return null;
    u.pathname = OBJECT_PUBLIC_PREFIX + u.pathname.slice(RENDER_PUBLIC_PREFIX.length);
    u.search = "";
    return u.toString();
  } catch {
    return null;
  }
}
