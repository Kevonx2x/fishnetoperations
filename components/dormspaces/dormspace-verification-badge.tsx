import type { DormspaceStatus } from "@/lib/dormspaces";

const PENDING_TOOLTIP = "This landlord has submitted documents — verification in progress";
const VERIFIED_TOOLTIP = "ID and proof of billing confirmed";

export function DormspaceVerificationBadge({ status }: { status: DormspaceStatus }) {
  if (status === "approved") {
    return (
      <span
        title={VERIFIED_TOOLTIP}
        className="inline-flex shrink-0 items-center rounded-full bg-[#6B9E6E]/12 px-2.5 py-1 text-[11px] font-semibold text-[#3d5a40] ring-1 ring-[#6B9E6E]/20"
      >
        ✓ Verified Landlord
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span
        title={PENDING_TOOLTIP}
        className="inline-flex shrink-0 items-center rounded-full bg-[#F0ECE6] px-2.5 py-1 text-[11px] font-medium text-[#5c5c5c] ring-1 ring-[#2C2C2C]/8"
      >
        ⏳ Pending verification
      </span>
    );
  }

  return null;
}
