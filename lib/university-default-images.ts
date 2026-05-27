/** Verified Unsplash URLs for university avatars (Next.js image optimizer tested). */
const U = (photoId: string, size = 400) =>
  `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${size}&h=${size}&q=80`;

/** Stable ids from 20260529120000_create_universities_table.sql */
export const UNIVERSITY_IMAGE_URL_BY_ID: Record<string, string> = {
  "a8000000-0000-0000-0000-000000000001": U("1562774053-701939374585"), // DLSU
  "a8000000-0000-0000-0000-000000000002": U("1529156069898-49953e39b3ac"), // Benilde
  "a8000000-0000-0000-0000-000000000003": U("1541339907198-e08756dedf3f"), // UST
  "a8000000-0000-0000-0000-000000000004": U("1498243691581-b145c3f54a5a"), // PUP
  "a8000000-0000-0000-0000-000000000005": U("1486325212027-8081e485255e"), // Mapúa
  "a8000000-0000-0000-0000-000000000006": U("1523240795612-9a054b0db644"), // FEU
  "a8000000-0000-0000-0000-000000000007": U("1501854140801-50d01698950b"), // Ateneo
  "a8000000-0000-0000-0000-000000000008": U("1564013799919-ab600027ffc6"), // UP Diliman
  "a8000000-0000-0000-0000-000000000009": U("1522708323590-d24dbb6b0267"), // DLSU-D
  "a8000000-0000-0000-0000-000000000010": U("1560448204-e02f11c3d0e2"), // Adamson
};

/** Legacy seed URLs that return 404 from Unsplash — replace at read time until DB is patched. */
const BROKEN_UNIVERSITY_IMAGE_URLS = new Set([
  "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1607237138185-eedd9c632b59?w=400&h=400&fit=crop",
]);

export function getUniversityImageUrl(universityId: string, imageUrl: string | null): string | null {
  const curated = UNIVERSITY_IMAGE_URL_BY_ID[universityId];
  if (curated) return curated;
  if (!imageUrl) return null;
  if (BROKEN_UNIVERSITY_IMAGE_URLS.has(imageUrl)) return null;
  return imageUrl;
}

export function withUniversityImageDefaults<T extends { id: string; image_url: string | null }>(
  universities: T[],
): T[] {
  return universities.map((university) => ({
    ...university,
    image_url: getUniversityImageUrl(university.id, university.image_url),
  }));
}
