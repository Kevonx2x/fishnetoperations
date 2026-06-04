import {
  dormspaceLocationLine,
  dormspaceListingPhotoSrc,
  dormspacePrimaryPhotoUrl,
  formatDormspacePrice,
  sortedDormspacePhotos,
  type DormspacePhotoRow,
  type DormspaceRoomType,
} from "@/lib/dormspaces";

export type SearchMapDormspace = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  location: string;
  city: string | null;
  neighborhood: string | null;
  monthly_price: number | string;
  room_type: DormspaceRoomType;
  landlord_user_id: string | null;
  total_beds: number | null;
  available_beds: number | null;
  dormspace_photos?: DormspacePhotoRow[];
};

type DormspaceMapPhotoRow = Pick<DormspacePhotoRow, "id" | "url" | "display_order" | "created_at">;

type DormspaceMapRow = {
  id: string;
  title?: string | null;
  address?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  monthly_price?: number | string | null;
  room_type?: DormspaceRoomType | null;
  landlord_user_id?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  total_beds?: number | null;
  available_beds?: number | null;
  dormspace_photos?: DormspaceMapPhotoRow[];
};

export function searchMapDormspaceLocationLine(dormspace: SearchMapDormspace): string {
  return dormspaceLocationLine({
    city: dormspace.city,
    neighborhood: dormspace.neighborhood,
    address: dormspace.location,
  });
}

export function searchMapDormspacePriceLabel(dormspace: SearchMapDormspace): string {
  return formatDormspacePrice(dormspace.monthly_price);
}

export function searchMapDormspacePhotoUrl(dormspace: SearchMapDormspace): string {
  const raw = dormspacePrimaryPhotoUrl(dormspace.dormspace_photos ?? null);
  return raw ? dormspaceListingPhotoSrc(raw) : "";
}

export function dormspaceRowsToSearchMapDormspaces(rows: DormspaceMapRow[]): SearchMapDormspace[] {
  const dormspaces: SearchMapDormspace[] = [];

  for (const row of rows) {
    const lat =
      typeof row.latitude === "number" ? row.latitude : row.latitude != null ? Number(row.latitude) : NaN;
    const lng =
      typeof row.longitude === "number" ? row.longitude : row.longitude != null ? Number(row.longitude) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!row.room_type) continue;

    const address = row.address?.trim() || "";
    dormspaces.push({
      id: row.id,
      lat,
      lng,
      title: row.title?.trim() || "Dorm listing",
      location: address,
      city: row.city?.trim() || null,
      neighborhood: row.neighborhood?.trim() || null,
      monthly_price: row.monthly_price ?? "",
      room_type: row.room_type,
      landlord_user_id: row.landlord_user_id ?? null,
      total_beds: row.total_beds ?? null,
      available_beds: row.available_beds ?? null,
      dormspace_photos: sortedDormspacePhotos(
        (row.dormspace_photos ?? null) as DormspacePhotoRow[] | null,
      ),
    });
  }

  return dormspaces;
}
