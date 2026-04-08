"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import type { MarketplaceAgent } from "@/lib/marketplace-types";
import { AgentAvatarFill } from "@/components/marketplace/agent-avatar";
import { formatAgentScore } from "@/lib/format-agent-score";
import { cn } from "@/lib/utils";

function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-[#D4A843]/18 px-2 py-1 text-[11px] font-bold text-[#8a6d32]",
        className,
      )}
    >
      <Flame className="h-3.5 w-3.5 text-[#D4A843]" aria-hidden />
      Verified
    </span>
  );
}

export function AgentDirectoryCard({
  agent,
  className,
}: {
  agent: MarketplaceAgent;
  className?: string;
}) {
  const companyLine = agent.company || agent.brokerName;

  return (
    <Link
      href={`/agents/${encodeURIComponent(agent.id)}`}
      aria-label={`View profile for ${agent.name}`}
      className={cn(
        "group block cursor-pointer rounded-2xl border border-[#2C2C2C]/10 bg-white p-3 shadow-md",
        "transition-all duration-200 ease-in-out will-change-transform",
        "hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl hover:border-[#2C2C2C]/15",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A843] focus-visible:ring-offset-2",
        "lg:flex lg:h-[280px] lg:flex-col lg:items-stretch lg:p-5",
        className ?? "w-[320px] shrink-0",
      )}
    >
      {/* Mobile: horizontal compact layout */}
      <div className="lg:hidden">
        <div className="flex items-start gap-2.5">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
            <AgentAvatarFill
              name={agent.name}
              imageUrl={agent.image}
              sizes="48px"
              textClassName="text-base"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <p className="min-w-0 truncate text-sm font-bold text-[#2C2C2C]">{agent.name}</p>
              {agent.verified ? (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#D4A843]/18 px-1.5 py-0.5 text-[9px] font-bold leading-none text-[#8a6d32]">
                  <Flame className="h-2.5 w-2.5 text-[#D4A843]" aria-hidden />
                  Verified
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[10px] font-semibold text-[#2C2C2C]/55">{companyLine}</p>
            <div className="mt-1.5 flex min-w-0 flex-row flex-nowrap gap-1 text-[#2C2C2C]/60">
              <span className="shrink-0 rounded-full bg-[#6B9E6E]/12 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#2C2C2C]/60 whitespace-nowrap">
                {agent.closings} closings
              </span>
              <span className="shrink-0 rounded-full bg-[#6B9E6E]/12 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#2C2C2C]/60 whitespace-nowrap">
                Score {formatAgentScore(agent.score)}
              </span>
            </div>
          </div>
        </div>
        <span className="mt-3 inline-flex w-full justify-center rounded-full bg-[#2C2C2C] px-3 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-[#6B9E6E]">
          View Profile
        </span>
      </div>

      {/* Desktop: uniform centered column, fixed height card */}
      <div className="hidden min-h-0 flex-1 flex-col lg:flex">
        <div className="flex min-h-0 flex-1 flex-col items-center gap-2 px-1 text-center">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
            <AgentAvatarFill
              name={agent.name}
              imageUrl={agent.image}
              sizes="64px"
              textClassName="text-lg"
            />
          </div>
          <p className="w-full max-w-full truncate px-1 text-base font-bold text-[#2C2C2C]">{agent.name}</p>
          <div className="flex h-[26px] w-full shrink-0 items-center justify-center">
            {agent.verified ? <VerifiedBadge /> : null}
          </div>
          <p className="line-clamp-1 min-h-[1.25rem] w-full max-w-full px-1 text-xs font-semibold text-[#2C2C2C]/55">
            {companyLine.trim() ? companyLine : "\u00A0"}
          </p>
          <div className="mt-1 flex shrink-0 flex-row flex-nowrap items-center justify-center gap-2">
            <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-xs font-semibold text-[#2C2C2C]/60 whitespace-nowrap">
              {agent.closings} closings
            </span>
            <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-xs font-semibold text-[#2C2C2C]/60 whitespace-nowrap">
              Score {formatAgentScore(agent.score)}
            </span>
          </div>
        </div>
        <span className="mt-auto inline-flex w-full shrink-0 justify-center rounded-full bg-[#2C2C2C] px-4 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-[#6B9E6E]">
          View Profile
        </span>
      </div>
    </Link>
  );
}
