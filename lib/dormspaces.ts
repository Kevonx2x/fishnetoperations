import type { DormspaceBedTypeEntry } from "@/lib/dormspace-bed-types";
import {
  dormspaceCardAvailabilityText,
  isDormspaceFullyBooked,
  resolveDormspaceGenderBedCounts,
  type DormspaceGenderBedInput,
} from "@/lib/dormspace-gender-beds";
import { isSupabaseRenderUrl, supabaseObjectUrlFromRenderUrl } from "@/lib/supabase-image-url";

export type DormspaceRoomType =
  | "private"
  | "shared_2"
  | "shared_4"
  | "shared_6_plus"
  | "mixed";
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
  total_beds: number | null;
  available_beds: number | null;
  vacancy_notes: string | null;
  male_beds_total: number | null;
  male_beds_available: number | null;
  female_beds_total: number | null;
  female_beds_available: number | null;
  male_monthly_price: number | string | null;
  female_monthly_price: number | string | null;
  hidden_from_browse: boolean | null;
  bed_types?: DormspaceBedTypeEntry[] | null;
};

export type DormspacePhotoRow = {
  id: string;
  dormspace_id: string;
  url: string;
  display_order: number;
  created_at: string;
};

export type DormspaceWalkTimeUniversity = {
  id: string;
  short_name: string;
  name: string;
  display_order?: number;
};

export type DormspaceWalkTimeRow = {
  walk_duration_seconds: number;
  walk_distance_meters: number;
  university_id: string;
  universities?: DormspaceWalkTimeUniversity | null;
};

export type DormspaceWalkTimeWithUniversity = DormspaceWalkTimeRow & {
  universities: DormspaceWalkTimeUniversity;
};

export type DormspaceWithPhotos = DormspaceRow & {
  dormspace_photos?: DormspacePhotoRow[] | null;
  dormspace_walk_times?: DormspaceWalkTimeRow[] | null;
};

export type DormspaceInquiryStatus = "new" | "responded" | "archived";

/** Matches `public.dormspace_inquiries` columns (name/email/phone, not sender_*). */
export type DormspaceInquiryRow = {
  id: string;
  dormspace_id: string;
  sender_user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: DormspaceInquiryStatus;
  created_at: string;
  read_at: string | null;
  responded_at: string | null;
};

export type DormspaceInquiryWithListing = DormspaceInquiryRow & {
  dormspace?: Pick<DormspaceRow, "id" | "title" | "landlord_user_id"> & {
    dormspace_photos?: DormspacePhotoRow[] | null;
  };
};

export function dormspaceStatusLabel(status: DormspaceStatus): string {
  switch (status) {
    case "pending":
      return "Pending verification";
    case "approved":
      return "Verified";
    case "rejected":
      return "Rejected";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}

export function dormspaceInquiryStatusLabel(status: DormspaceInquiryStatus): string {
  switch (status) {
    case "new":
      return "New";
    case "responded":
      return "Responded";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}

export const DORMSPACE_ROOM_TYPE_OPTIONS: { value: DormspaceRoomType; label: string }[] = [
  { value: "private", label: "Private room" },
  { value: "mixed", label: "Mixed (Male & Female)" },
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

/** Default bed count when room type changes (submit form / backfill). */
export function defaultTotalBedsFromRoomType(roomType: DormspaceRoomType): number {
  switch (roomType) {
    case "private":
      return 1;
    case "shared_2":
      return 2;
    case "shared_4":
      return 4;
    case "shared_6_plus":
      return 6;
    case "mixed":
      return 4;
    default:
      return 1;
  }
}

export function resolveDormspaceBedCounts(
  row: Pick<DormspaceRow, "room_type" | "total_beds" | "available_beds">,
): { total: number; available: number } {
  const totalRaw = row.total_beds;
  const total =
    totalRaw != null && Number.isFinite(Number(totalRaw)) && Number(totalRaw) >= 1
      ? Math.min(50, Math.max(1, Math.round(Number(totalRaw))))
      : defaultTotalBedsFromRoomType(row.room_type);
  const availRaw = row.available_beds;
  const available =
    availRaw != null && Number.isFinite(Number(availRaw))
      ? Math.max(0, Math.min(total, Math.round(Number(availRaw))))
      : total;
  return { total, available };
}

/** e.g. "Shared (4 beds)" using actual total_beds. */
export function dormspaceRoomCapacityLabel(
  roomType: DormspaceRoomType,
  totalBeds?: number | null,
): string {
  const total = totalBeds != null && totalBeds >= 1 ? totalBeds : defaultTotalBedsFromRoomType(roomType);
  const bedWord = total === 1 ? "bed" : "beds";
  switch (roomType) {
    case "private":
      return `Private (${total} ${bedWord})`;
    case "shared_2":
      return `Shared (${total} ${bedWord})`;
    case "shared_4":
      return `Shared (${total} ${bedWord})`;
    case "shared_6_plus":
      return `Shared (${total}+ ${bedWord})`;
    default:
      return `${total} ${bedWord}`;
  }
}

export type DormspaceBedAvailabilityDisplay = {
  roomLine: string;
  detailLine: string;
  shortLine: string;
  status: "full" | "all" | "partial";
};

export function dormspaceBedAvailability(
  row: DormspaceGenderBedInput & { room_type: DormspaceRoomType },
): DormspaceBedAvailabilityDisplay {
  const counts = resolveDormspaceGenderBedCounts(row);
  const cardLine = dormspaceCardAvailabilityText(row);
  const roomLine =
    row.room_type === "private"
      ? counts.maleTotal > 0
        ? "Private · Male"
        : counts.femaleTotal > 0
          ? "Private · Female"
          : "Private room"
      : dormspaceRoomCapacityLabel(row.room_type, counts.maleTotal + counts.femaleTotal);

  if (isDormspaceFullyBooked(row)) {
    return {
      roomLine,
      detailLine: "Currently full",
      shortLine: "Currently full",
      status: "full",
    };
  }
  if (cardLine) {
    return {
      roomLine,
      detailLine: cardLine,
      shortLine: cardLine,
      status: "partial",
    };
  }
  return {
    roomLine,
    detailLine: "Beds available",
    shortLine: "Available",
    status: "all",
  };
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

/** Use the public storage URL — Supabase render transforms often 404 without Image Transformations enabled. */
export function dormspaceListingPhotoSrc(url: string | null | undefined): string {
  const t = (url ?? "").trim();
  if (!t) return t;
  if (isSupabaseRenderUrl(t)) {
    return supabaseObjectUrlFromRenderUrl(t) ?? t;
  }
  return t;
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

/** Welcome mobile hero — student on bunk bed (Pexels, George Pak). */
export const DORMSPACE_WELCOME_MOBILE_HERO_IMAGE = "/images/dormspace-welcome-hero-mobile.png";

/** Welcome split-layout hero — students in shared living (Unsplash, high-res). */
export const DORMSPACE_WELCOME_HERO_IMAGE =
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1920&q=85&fm=webp";

/** Community banner — students socializing (Unsplash). */
export const DORMSPACE_COMMUNITY_BANNER_IMAGE =
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=80";

/** BahayGo cross-sell on dormspaces — Manila skyline at golden hour (Unsplash). */
export const BAHAYGO_MARKETPLACE_BANNER_IMAGE =
  "https://images.unsplash.com/photo-1511721464821-5641710d5bf2?auto=format&fit=crop&w=1600&q=80";
