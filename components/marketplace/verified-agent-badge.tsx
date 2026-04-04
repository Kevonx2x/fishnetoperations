"use client";

import { BadgeCheck } from "lucide-react";

export function VerifiedAgentBadge({
  show,
  className,
}: {
  show: boolean;
  className?: string;
}) {
  if (!show) return null;
  return (
    <span
      className={
        className ??
        "inline-flex items-center gap-1 rounded-full bg-[#D4A843]/18 px-2 py-1 text-[11px] font-bold text-[#8a6d32]"
      }
      title="Verified agent"
    >
      <BadgeCheck className="h-3.5 w-3.5 text-[#D4A843]" />
      Verified
    </span>
  );
}

