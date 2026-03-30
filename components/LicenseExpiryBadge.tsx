"use client";

import { isLicenseExpiringWithinDays } from "@/lib/license-expiry";

type Props = {
  licenseExpiry: string | null | undefined;
  className?: string;
};

export function LicenseExpiryBadge({ licenseExpiry, className = "" }: Props) {
  if (!isLicenseExpiringWithinDays(licenseExpiry, 30)) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 ${className}`}
    >
      License expires within 30 days
    </span>
  );
}
