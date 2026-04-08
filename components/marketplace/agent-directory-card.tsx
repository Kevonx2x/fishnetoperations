"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import type { MarketplaceAgent } from "@/lib/marketplace-types";
import { AgentAvatarFill } from "@/components/marketplace/agent-avatar";
import { formatAgentScore } from "@/lib/format-agent-score";
import { cn } from "@/lib/utils";

export function AgentDirectoryCard({
  agent,
  className,
}: {
  agent: MarketplaceAgent;
  className?: string;
}) {
  return (
    <Link
      href={`/agents/${encodeURIComponent(agent.id)}`}
      aria-label={`View profile for ${agent.name}`}
      className={cn(
        "group block cursor-pointer rounded-2xl border border-[#2C2C2C]/10 bg-white p-3 shadow-md md:p-5",
        "transition-all duration-200 ease-in-out will-change-transform",
        "hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl hover:border-[#2C2C2C]/15",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A843] focus-visible:ring-offset-2",
        className ?? "w-[320px] shrink-0",
      )}
    >
      <div className="flex items-start gap-2.5 md:items-center md:gap-4">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10 md:h-16 md:w-16">
          <AgentAvatarFill
            name={agent.name}
            imageUrl={agent.image}
            sizes="(min-width: 768px) 64px, 48px"
            textClassName="text-base md:text-lg"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1 md:gap-2">
            <p className="min-w-0 truncate text-sm font-bold text-[#2C2C2C] md:text-base md:font-semibold">{agent.name}</p>
            {agent.verified ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#D4A843]/18 px-1.5 py-0.5 text-[9px] font-bold leading-none text-[#8a6d32] md:gap-1 md:px-2 md:py-1 md:text-[11px]">
                <Flame className="h-2.5 w-2.5 text-[#D4A843] md:h-3.5 md:w-3.5" />
                Verified
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[10px] font-semibold text-[#2C2C2C]/55 md:mt-1 md:text-xs">
            {agent.company || agent.brokerName}
          </p>
          <div className="mt-1.5 flex flex-row flex-nowrap items-center gap-1.5 text-xs font-semibold text-[#2C2C2C]/60 md:mt-2 md:flex-wrap md:gap-2">
            <span className="shrink-0 rounded-full bg-[#6B9E6E]/12 px-2 py-0.5 md:px-3 md:py-1">
              {agent.closings} closings
            </span>
            <span className="shrink-0 rounded-full bg-[#6B9E6E]/12 px-2 py-0.5 md:px-3 md:py-1">
              Score {formatAgentScore(agent.score)}
            </span>
          </div>
        </div>
      </div>
      <span className="mt-3 inline-flex w-full justify-center rounded-full bg-[#2C2C2C] px-3 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-[#6B9E6E] md:mt-4 md:px-4 md:py-2.5 md:text-sm">
        View Profile
      </span>
    </Link>
  );
}
