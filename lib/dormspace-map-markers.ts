import {
  formatDormspacePrice,
  sortedDormspacePhotos,
  type DormspaceWithPhotos,
} from "@/lib/dormspaces";

export type DormspaceMapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  title: string;
  imageUrl?: string;
  href: string;
};

/** Metro Manila default — used until listing markers are wired in. */
export const DORMSPACE_MAP_DEFAULT_CENTER = { lat: 14.5995, lng: 120.9842 };
export const DORMSPACE_MAP_DEFAULT_ZOOM = 11;

export function dormspaceListingMapMarkers(
  listings: DormspaceWithPhotos[],
): DormspaceMapMarker[] {
  const markers: DormspaceMapMarker[] = [];

  for (const listing of listings) {
    const lat = listing.latitude != null ? Number(listing.latitude) : NaN;
    const lng = listing.longitude != null ? Number(listing.longitude) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const photos = sortedDormspacePhotos(listing.dormspace_photos ?? null);
    const imageUrl = photos.map((photo) => photo.url).find(Boolean);

    markers.push({
      id: listing.id,
      lat,
      lng,
      label: formatDormspacePrice(listing.monthly_price),
      title: listing.title,
      imageUrl,
      href: `/dormspaces/${listing.id}`,
    });
  }

  return markers;
}
