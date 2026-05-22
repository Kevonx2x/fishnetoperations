export const DORMSPACE_LANDLORD_LANGUAGE_OPTIONS = [
  "English",
  "Tagalog",
  "Cebuano",
  "Ilocano",
  "Hiligaynon",
  "Other",
] as const;

export const DORMSPACE_LANDLORD_SPECIALTY_OPTIONS = [
  "Student housing",
  "BPO housing",
  "Coliving",
  "Long-term tenants",
  "Short-term tenants",
] as const;

export type DormspaceLandlordPreferredContact = "email" | "phone" | "either";

export type LandlordPublicProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  email?: string | null;
  landlord_bio: string | null;
  landlord_languages: string[] | null;
  landlord_preferred_contact: DormspaceLandlordPreferredContact | null;
  landlord_years_renting: number | null;
  created_at: string | null;
  landlord_verification_status?: string | null;
  landlord_cover_url?: string | null;
  landlord_specialties?: string[] | null;
  landlord_operating_areas?: string[] | null;
  landlord_facebook_url?: string | null;
  landlord_instagram_url?: string | null;
  landlord_about_properties?: string | null;
  landlord_viber?: string | null;
  landlord_show_phone?: boolean | null;
  landlord_show_whatsapp?: boolean | null;
  landlord_show_email?: boolean | null;
  landlord_show_viber?: boolean | null;
  landlord_show_facebook?: boolean | null;
  landlord_show_instagram?: boolean | null;
};

export type LandlordProfileTrust = {
  verified_landlord: boolean;
  verification_pending: boolean;
  free_listings: boolean;
  member_since: string | null;
  active_listing_count: number;
};

export function formatLandlordMemberSince(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function formatLandlordMemberYear(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return String(d.getFullYear());
}

export function preferredContactLabel(v: DormspaceLandlordPreferredContact | null | undefined): string {
  switch (v) {
    case "email":
      return "Email";
    case "phone":
      return "Phone";
    case "either":
      return "Email or phone";
    default:
      return "Not set";
  }
}

export function preferredContactShort(v: DormspaceLandlordPreferredContact | null | undefined): string {
  switch (v) {
    case "email":
      return "Email";
    case "phone":
      return "Phone";
    case "either":
      return "Either";
    default:
      return "";
  }
}

const specialtySet = new Set<string>(DORMSPACE_LANDLORD_SPECIALTY_OPTIONS);

export function filterLandlordSpecialties(values: string[] | null | undefined): string[] {
  return (values ?? []).filter((v) => specialtySet.has(v));
}

export function filterLandlordLanguages(values: string[] | null | undefined): string[] {
  const langSet = new Set<string>(DORMSPACE_LANDLORD_LANGUAGE_OPTIONS);
  return (values ?? []).filter((v) => langSet.has(v));
}

export function normalizeOperatingAreas(values: string[] | null | undefined, max = 24): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values ?? []) {
    const t = raw.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

export function dormspaceLocationTags(
  rows: { city?: string | null; neighborhood?: string | null }[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const city = row.city?.trim();
    const hood = row.neighborhood?.trim();
    const tag = city && hood ? `${hood}, ${city}` : city || hood;
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

export function isValidOptionalUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const LANDLORD_BIO_SNIPPET_LEN = 100;
