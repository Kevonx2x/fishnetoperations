"use client";

import Link from "next/link";
import { ChevronRight, User } from "lucide-react";

import { AgentAvatarFill } from "@/components/marketplace/agent-avatar";
import type { MarketplaceAgent } from "@/lib/marketplace-types";
import { cn } from "@/lib/utils";

type Props = {
  propertyHref: string;
  propertyTitle: string;
  agent?: MarketplaceAgent | null;
  className?: string;
};

/** Mobile BahayGo feed — inline availability prompt with listing agent avatar. */
export function BahayGoMobileCheckAvailabilityCta({
  propertyHref,
  propertyTitle,
  agent,
  className,
}: Props) {
  const agentName = agent?.name?.trim() || "Listing agent";

  return (
    <Link
      href={propertyHref}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "pointer-events-auto relative z-[15] flex w-full items-center gap-2 rounded-xl border border-[#6B9E6E]/35 bg-[#6B9E6E]/10 p-2 transition active:bg-[#6B9E6E]/15",
        className,
      )}
      aria-label={`Check availability for ${propertyTitle}`}
    >
      <span
        className="relative size-9 shrink-0 overflow-hidden rounded-full border border-[#6B9E6E]/25 bg-white shadow-sm"
        aria-hidden
      >
        {agent ? (
          <AgentAvatarFill name={agent.name} imageUrl={agent.image} sizes="36px" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-[#6B9E6E]/10">
            <User className="size-4 text-[#6B9E6E]" strokeWidth={2} />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-bold leading-tight text-[#2C2C2C]">
          Check availability
        </span>
        <span className="mt-0.5 block text-[10px] font-medium leading-snug text-[#717171]">
          {agent ? `Ask ${agentName} about your dates` : "Select your dates to see if this property is available."}
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#6B9E6E] px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-sm">
        Check now
        <ChevronRight className="size-3" strokeWidth={2.5} aria-hidden />
      </span>
    </Link>
  );
}
