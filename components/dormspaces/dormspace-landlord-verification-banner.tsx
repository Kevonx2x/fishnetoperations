import Link from "next/link";
import { AlertCircle, BadgeCheck, Clock } from "lucide-react";

import type { LandlordVerificationStatus } from "@/lib/landlord-verification";
import { cn } from "@/lib/utils";

type Props = {
  status: LandlordVerificationStatus;
  rejectionReason?: string | null;
  /** ISO timestamp when verification was submitted (pending banner). */
  submittedAt?: string | null;
  className?: string;
  /** Compact one-line style for submit form */
  variant?: "dashboard" | "submit";
};

function formatVerificationSubmittedDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export function DormspaceLandlordVerificationBanner({
  status,
  rejectionReason,
  submittedAt,
  className,
  variant = "dashboard",
}: Props) {
  if (status === "unverified" && variant === "submit") return null;

  if (status === "pending") {
    return (
      <div
        className={cn(
          "flex gap-3 rounded-2xl border border-[#D4A843]/35 bg-[#D4A843]/10 px-4 py-3.5 text-sm font-medium text-[#2C2C2C]",
          className,
        )}
        role="status"
      >
        <Clock className="mt-0.5 size-5 shrink-0 text-[#8a6d32]" aria-hidden />
        <p>
          <span className="font-bold">Verification under review.</span>{" "}
          {variant === "submit"
            ? "We'll notify you once approved. This listing will go live with pending status until we review it."
            : "We'll notify you once your ID and proof of billing are approved."}
        </p>
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div
        className={cn(
          "flex gap-3 rounded-2xl border border-[#6B9E6E]/35 bg-[#6B9E6E]/10 px-4 py-3.5 text-sm font-medium text-[#2C2C2C]",
          className,
        )}
        role="status"
      >
        <BadgeCheck className="mt-0.5 size-5 shrink-0 text-[#6B9E6E]" aria-hidden />
        <p>
          <span className="font-bold">Verified Landlord.</span>{" "}
          {variant === "submit"
            ? "Your new listing will go live with the verified badge."
            : "Your verified badge shows on all listings."}
        </p>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div
        className={cn(
          "flex gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-medium text-[#2C2C2C]",
          className,
        )}
        role="alert"
      >
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
        <div className="min-w-0">
          <p className="font-bold text-red-800">Verification rejected — please re-upload</p>
          {rejectionReason?.trim() ? (
            <p className="mt-1 text-[#484848]">{rejectionReason.trim()}</p>
          ) : null}
          {variant === "dashboard" ? (
            <Link
              href="/dormspaces/submit"
              className="mt-2 inline-flex text-sm font-bold text-[#6B9E6E] hover:underline"
            >
              Submit a listing with new documents →
            </Link>
          ) : (
            <p className="mt-1 text-[#484848]">Upload new ID and proof of billing below to continue.</p>
          )}
        </div>
      </div>
    );
  }

  if (status === "unverified" && variant === "dashboard") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2C2C2C]/12 bg-white px-4 py-3.5 text-sm shadow-sm",
          className,
        )}
      >
        <p className="font-medium text-[#484848]">Get verified to build trust with tenants.</p>
        <Link
          href="/dormspaces/submit"
          className="inline-flex h-9 items-center justify-center rounded-xl bg-[#6B9E6E] px-4 text-xs font-bold text-white hover:bg-[#5d8a60]"
        >
          Get verified
        </Link>
      </div>
    );
  }

  return null;
}
