import { propertyPhotoHeroUrl } from "@/lib/cloudinary-property-photo-url";
import { pickMobileCarouselListings } from "@/lib/homepage-listing-dedupe";
import type { HomepagePropertiesResult } from "@/lib/marketplace-home-fetchers";
import { firstRawPropertyPhotoUrl, type DbProperty } from "@/lib/marketplace-property";

/** First mobile trending slide — matches BahayGoHomeMobileTop heroSlides ordering. */
export function pickMobileHomepageTrendingLead(
  data: HomepagePropertiesResult,
): DbProperty | null {
  const ordered: DbProperty[] = [];
  if (data.featured) ordered.push(data.featured);
  for (const p of data.list) {
    if (p.id !== data.featured?.id) ordered.push(p);
  }
  return pickMobileCarouselListings(ordered, { limit: 1 })[0] ?? null;
}

/** Hero URL for LCP preload — Cloudinary/Supabase transform, not next/image proxy. */
export function resolveMobileHomepageLcpImageUrl(data: HomepagePropertiesResult): string | null {
  const lead = pickMobileHomepageTrendingLead(data);
  if (!lead) return null;
  const raw = firstRawPropertyPhotoUrl(lead);
  return raw ? propertyPhotoHeroUrl(raw) : null;
}
