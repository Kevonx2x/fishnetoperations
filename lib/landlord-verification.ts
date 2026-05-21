export type LandlordVerificationStatus = "unverified" | "pending" | "approved" | "rejected";

export function normalizeLandlordVerificationStatus(
  value: string | null | undefined,
): LandlordVerificationStatus {
  if (value === "pending" || value === "approved" || value === "rejected") return value;
  return "unverified";
}

/** Must upload ID + billing on submit (first time or after rejection). */
export function needsLandlordVerificationUpload(status: LandlordVerificationStatus): boolean {
  return status === "unverified" || status === "rejected";
}

export function isVerifiedLandlordProfile(status: LandlordVerificationStatus): boolean {
  return status === "approved";
}

export function landlordVerificationLabel(status: LandlordVerificationStatus): string {
  switch (status) {
    case "approved":
      return "Verified Landlord";
    case "pending":
      return "Verification under review";
    case "rejected":
      return "Verification rejected";
    default:
      return "Not verified";
  }
}
