export const DORMSPACE_LANDLORD_LANGUAGE_OPTIONS = [
  "English",
  "Tagalog",
  "Cebuano",
  "Ilocano",
  "Hiligaynon",
  "Other",
] as const;

export type DormspaceLandlordPreferredContact = "email" | "phone" | "either";

export type LandlordPublicProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  landlord_bio: string | null;
  landlord_languages: string[] | null;
  landlord_preferred_contact: DormspaceLandlordPreferredContact | null;
  landlord_years_renting: number | null;
  created_at: string | null;
};

export type LandlordProfileTrust = {
  verified_landlord: boolean;
  free_listings: boolean;
  member_since: string | null;
};

export function formatLandlordMemberSince(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
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
