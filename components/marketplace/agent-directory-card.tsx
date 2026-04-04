"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import type { MarketplaceAgent } from "@/lib/marketplace-types";
import { AgentAvatarFill } from "@/components/marketplace/agent-avatar";
import { cn } from "@/lib/utils";

export function AgentDirectoryCard({
  agent,
  className,
}: {
  agent: MarketplaceAgent;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-md",
        className ?? "w-[320px] shrink-0",
      )}
    >
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
          <AgentAvatarFill name={agent.name} imageUrl={agent.image} sizes="64px" textClassName="text-lg" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-[#2C2C2C]">{agent.name}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#D4A843]/18 px-2 py-1 text-[11px] font-bold text-[#8a6d32]">
              <Flame className="h-3.5 w-3.5 text-[#D4A843]" />
              Verified
            </span>
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-[#2C2C2C]/55">{agent.company || agent.brokerName}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-[#2C2C2C]/60">
            <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1">{agent.closings} closings</span>
            <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1">Score {Math.round(agent.score)}</span>
          </div>
        </div>
      </div>
      <Link
        href={`/agents/${encodeURIComponent(agent.id)}`}
        className="mt-4 inline-flex w-full justify-center rounded-full bg-[#2C2C2C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6B9E6E]"
      >
        View Profile
      </Link>
    </div>
  );
}
