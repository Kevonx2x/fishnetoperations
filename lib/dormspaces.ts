/** Dormspace listing types and display helpers. */

export type DormspaceRoomType = "private" | "shared_2" | "shared_4" | "shared_6_plus";
export type DormspaceGenderPreference = "any" | "male" | "female";
export type DormspaceStatus = "pending" | "approved" | "rejected" | "archived";

export type DormspaceRow = {
  id: string;
  created_at: string;
  updated_at: string;
  landlord_user_id: string | null;
  landlord_name: string;
  landlord_email: string;
  landlord_phone: string | null;
  landlord_id_url: string | null;
  proof_of_billing_url: string | null;
  title: string;
  description: string | null;
  monthly_price: number | string;
  deposit_months: number | string | null;
  room_type: DormspaceRoomType;
  gender_preference: DormspaceGenderPreference | null;
  address: string;
  city: string | null;
  neighborhood: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  near_school: string | null;
  has_wifi: boolean | null;
  has_aircon: boolean | null;
  has_kitchen: boolean | null;
  has_laundry: boolean | null;
  has_water_included: boolean | null;
  has_electricity_included: boolean | null;
  has_security: boolean | null;
  curfew: string | null;
  rules_notes: string | null;
  status: DormspaceStatus;
  rejection_reason: string | null;
  approved_at: string | null;
  approved_by: string | null;
};

export type DormspacePhotoRow = {
  id: string;
  dormspace_id: string;
  url: string;
  display_order: number;
  created_at: string;
};

export type DormspaceWithPhotos = DormspaceRow & {
  dormspace_photos?: DormspacePhotoRow[] | null;
};

export const DORMSPACE_ROOM_TYPE_OPTIONS: { value: DormspaceRoomType; label: string }[] = [
  { value: "private", label: "Private room" },
  { value: "shared_2", label: "Shared (2 beds)" },
  { value: "shared_4", label: "Shared (4 beds)" },
  { value: "shared_6_plus", label: "Shared (6+ beds)" },
];

export const DORMSPACE_GENDER_OPTIONS: { value: DormspaceGenderPreference; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "male", label: "Male only" },
  { value: "female", label: "Female only" },
];

export const METRO_MANILA_CITIES = [
  "Taguig",
  "Makati",
  "Manila",
  "Quezon City",
  "Pasig",
  "Mandaluyong",
  "Pasay",
  "Parañaque",
  "Las Piñas",
  "Muntinlupa",
  "Caloocan",
  "Marikina",
  "San Juan",
] as const;

export function dormspaceRoomTypeLabel(roomType: DormspaceRoomType): string {
  return DORMSPACE_ROOM_TYPE_OPTIONS.find((o) => o.value === roomType)?.label ?? roomType;
}

export function dormspaceGenderLabel(g: DormspaceGenderPreference | null | undefined): string {
  if (!g || g === "any") return "Any gender";
  return g === "male" ? "Male only" : "Female only";
}

export function formatDormspacePrice(monthly: number | string | null | undefined): string {
  const n = typeof monthly === "number" ? monthly : Number.parseFloat(String(monthly ?? ""));
  if (!Number.isFinite(n)) return "—";
  const formatted = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(Math.round(n));
  return `₱${formatted}/mo`;
}

export function dormspaceLocationLine(row: Pick<DormspaceRow, "city" | "neighborhood" | "address">): string {
  const city = row.city?.trim();
  const hood = row.neighborhood?.trim();
  if (city && hood) return `${hood}, ${city}`;
  if (city) return city;
  if (hood) return hood;
  return row.address?.trim() || "Metro Manila";
}

export function sortedDormspacePhotos(photos: DormspacePhotoRow[] | null | undefined): DormspacePhotoRow[] {
  return [...(photos ?? [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
}

export function dormspacePrimaryPhotoUrl(photos: DormspacePhotoRow[] | null | undefined): string | null {
  const first = sortedDormspacePhotos(photos).find((p) => p.url?.trim());
  return first?.url.trim() ?? null;
}

export type DormspaceAmenityKey =
  | "has_wifi"
  | "has_aircon"
  | "has_kitchen"
  | "has_laundry"
  | "has_water_included"
  | "has_electricity_included"
  | "has_security";

export const DORMSPACE_AMENITIES: { key: DormspaceAmenityKey; label: string }[] = [
  { key: "has_wifi", label: "Wi-Fi" },
  { key: "has_aircon", label: "Aircon" },
  { key: "has_kitchen", label: "Kitchen" },
  { key: "has_laundry", label: "Laundry" },
  { key: "has_water_included", label: "Water included" },
  { key: "has_electricity_included", label: "Electricity included" },
  { key: "has_security", label: "Security" },
];

export function activeDormspaceAmenities(row: DormspaceRow): { key: DormspaceAmenityKey; label: string }[] {
  return DORMSPACE_AMENITIES.filter((a) => Boolean(row[a.key]));
}

/** Hero image — generic modern dorm/bedspace interior (Unsplash, no people). */
export const DORMSPACE_HERO_IMAGE =
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1920&q=80";
