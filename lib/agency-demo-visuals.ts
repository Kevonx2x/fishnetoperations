/** Deterministic demo visuals from agency id — varied covers/cities, no invented performance stats. */

const COVER_POOL = [
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=700&fit=crop",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=700&fit=crop",
  "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&h=700&fit=crop",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&h=700&fit=crop",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&h=700&fit=crop",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&h=700&fit=crop",
  "https://images.unsplash.com/photo-1600047509807-ba8f99d2cd66?w=1200&h=700&fit=crop",
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&h=700&fit=crop",
] as const;

const LISTING_IMAGE_POOL = [
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=450&fit=crop",
  "https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=600&h=450&fit=crop",
  "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=600&h=450&fit=crop",
  "https://images.unsplash.com/photo-1600047509358-9dc75507daeb?w=600&h=450&fit=crop",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=450&fit=crop",
  "https://images.unsplash.com/photo-1605276374101-deef2240e9b3?w=600&h=450&fit=crop",
] as const;

const CITIES = ["Makati", "BGC", "Ortigas", "Quezon City", "Cebu City", "Davao City", "Clark"] as const;

const LISTING_PREVIEWS = [
  { tag: "For Rent", title: "2BR residence · BGC", beds: 2, baths: 2, area: "86 sqm", location: "Taguig" },
  { tag: "For Sale", title: "Family home · Makati", beds: 3, baths: 2, area: "142 sqm", location: "Makati" },
  { tag: "For Rent", title: "Studio · Ortigas", beds: 1, baths: 1, area: "42 sqm", location: "Pasig" },
  { tag: "For Rent", title: "Penthouse suite · QC", beds: 3, baths: 3, area: "210 sqm", location: "Quezon City" },
] as const;

export const DIRECTORY_CITY_CHIPS = ["All", ...CITIES] as const;

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 9973;
  return h;
}

export function agencyCoverUrl(id: string): string {
  return COVER_POOL[hashId(id) % COVER_POOL.length]!;
}

export function agencyCityLabel(id: string): string {
  return CITIES[hashId(id + ":city") % CITIES.length]!;
}

export function agencyListingPreviews(id: string, count = 4) {
  const base = hashId(id + ":listings");
  return Array.from({ length: count }, (_, i) => {
    const p = LISTING_PREVIEWS[(base + i) % LISTING_PREVIEWS.length]!;
    return {
      ...p,
      image: LISTING_IMAGE_POOL[(base + i) % LISTING_IMAGE_POOL.length]!,
      priceLabel: "Price on request",
    };
  });
}

export function agencyMemberSince(createdAt: string | null): string | null {
  if (!createdAt) return null;
  const y = new Date(createdAt).getFullYear();
  const now = new Date().getFullYear();
  if (y > now || y < 1990) return null;
  return `Partner since ${y}`;
}
