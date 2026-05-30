import { propertyPhotoHeroUrl } from "@/lib/cloudinary-property-photo-url";
import { pickMobileCarouselListings } from "@/lib/homepage-listing-dedupe";
import type { HomepagePropertiesResult } from "@/lib/marketplace-home-fetchers";
import { firstRawPropertyPhotoUrl } from "@/lib/marketplace-property";

/** First trending carousel slide photo URL — matches `BahayGoHomeMobileTop` hero ordering. */
export function homepageFirstHeroImageUrl(data: HomepagePropertiesResult): string | null {
  const ordered = [];
  if (data.featured) ordered.push(data.featured);
  for (const p of data.list) {
    if (p.id !== data.featured?.id) ordered.push(p);
  }
  const first = pickMobileCarouselListings(ordered, { limit: 1 })[0];
  if (!first) return null;
  const raw = firstRawPropertyPhotoUrl(first);
  return raw ? propertyPhotoHeroUrl(raw) : null;
}
