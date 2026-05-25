/** Listing / agent verification exposed on cards and search (not buried in detail-only). */
export type ListingVerificationState =
  | "verified"
  | "pending"
  | "unverified"
  | "removed";

export type BahayGoTrustBadge = {
  id: string;
  label: string;
};

/** Shown under the search CTA on mobile home — trust at moment of action. */
export const BAHAYGO_SEARCH_TRUST_BADGES: BahayGoTrustBadge[] = [
  { id: "prc_verified", label: "PRC Verified Agents" },
  { id: "zero_scams", label: "0 Scams Guarantee" },
];

export type BahayGoVerificationBanner = {
  title: string;
  body: string;
};

export const BAHAYGO_HOME_VERIFICATION_BANNER: BahayGoVerificationBanner = {
  title: "Verified homes only",
  body: "Every listing is tied to a licensed agent. Report scams — we remove them fast.",
};

export function verificationStateFromAgent(
  verified: boolean,
  status: string,
): ListingVerificationState {
  if (status === "rejected" || status === "removed") return "removed";
  if (verified && status === "approved") return "verified";
  if (status === "pending") return "pending";
  return "unverified";
}
