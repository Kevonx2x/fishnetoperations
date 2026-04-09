"use client";

import Link from "next/link";
import { BadgeCheck, ChevronRight, Flame } from "lucide-react";
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
  homepageCarousel,
}: {
  agent: MarketplaceAgent;
  className?: string;
  /** Homepage “Top Verified Agents” horizontal scroll: taller mobile cards. */
  homepageCarousel?: boolean;
}) {
  const companyLine = agent.company || agent.brokerName;

  return (
    <Link
      href={`/agents/${encodeURIComponent(agent.id)}`}
      aria-label={`View profile for ${agent.name}`}
      className={cn(
        "group block cursor-pointer rounded-2xl border border-[#2C2C2C]/10 bg-white p-3 shadow-md",
        "transition-all duration-200 ease-in-out will-change-transform",
        !homepageCarousel &&
          "max-lg:rounded-none max-lg:border-0 max-lg:border-b max-lg:border-[#2C2C2C]/10 max-lg:bg-white max-lg:p-3 max-lg:shadow-none",
        !homepageCarousel &&
          "max-lg:hover:translate-y-0 max-lg:hover:scale-100 max-lg:hover:shadow-none max-lg:hover:border-[#2C2C2C]/10",
        !homepageCarousel && "max-lg:hover:bg-[#6B9E6E15] max-lg:hover:underline",
        homepageCarousel && "max-lg:hover:bg-[#6B9E6E]/8",
        "hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl hover:border-[#2C2C2C]/15",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A843] focus-visible:ring-offset-2",
        "lg:flex lg:h-[280px] lg:flex-col lg:items-stretch lg:p-5",
        className ?? "w-[320px] shrink-0",
      )}
    >
      {homepageCarousel ? (
        <div className="flex min-h-0 flex-col items-center lg:hidden">
          <div className="relative mx-auto h-14 w-14 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
            <AgentAvatarFill
              name={agent.name}
              imageUrl={agent.image}
              sizes="56px"
              textClassName="text-base"
            />
          </div>
          <p className="mt-2 line-clamp-2 w-full text-center text-sm font-semibold text-[#2C2C2C]">{agent.name}</p>
          {agent.verified ? (
            <span className="mt-1 inline-flex shrink-0 items-center rounded-full bg-[#6B9E6E] px-2 py-0.5 text-[10px] font-semibold text-white">
              Verified
            </span>
          ) : null}
          <p className="mt-2 text-xs text-center text-gray-500">Score {formatAgentScore(agent.score)}</p>
          <p className="mt-0.5 text-xs text-center text-gray-500">{agent.closings} closings</p>
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
            <AgentAvatarFill
              name={agent.name}
              imageUrl={agent.image}
              sizes="32px"
              textClassName="text-sm"
            />
          </div>
          <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#2C2C2C] transition-colors duration-150 ease-out group-hover:text-[#2C2C2C]">
            {agent.name.length > 12 ? `${agent.name.slice(0, 12)}…` : agent.name}
          </span>
          {agent.verified ? (
            <BadgeCheck className="h-4 w-4 shrink-0 text-[#D4A843]" aria-label="Verified" />
          ) : null}
          <span className="shrink-0 text-xs font-bold text-[#2C2C2C]/80 transition-colors duration-150 ease-out group-hover:text-[#2C2C2C]">
            {formatAgentScore(agent.score)}
          </span>
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 text-[#6B9E6E] opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100"
            aria-hidden
          />
        </div>
      )}

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
