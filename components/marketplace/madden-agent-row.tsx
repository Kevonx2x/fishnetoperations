"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Zap } from "lucide-react";
import type { MarketplaceAgent } from "@/lib/marketplace-types";
import { AgentAvatarFill, agentAvatarInitials } from "@/components/marketplace/agent-avatar";
import {
  AgentAvailabilityBadge,
  isAgentAvailableNow,
} from "@/components/marketplace/agent-availability-badge";

export function MaddenAgentRow({
  agent,
  connected,
  locationLine,
  onAvailable,
}: {
  agent: MarketplaceAgent;
  connected: MarketplaceAgent[];
  locationLine?: string;
  onAvailable: () => void;
}) {
  const isNow = isAgentAvailableNow(agent.availability);
  const c = (connected ?? []).slice(0, 8);

  return (
    <motion.div
      layout
      className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
    >
      <div className="flex items-start gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl ring-1 ring-black/10">
          {agent.image?.trim() ? (
            <Image
              src={agent.image}
              alt={agent.name}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-[#6B9E6E] text-sm font-bold text-white">
              {agentAvatarInitials(agent.name)}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-serif text-lg font-bold text-[#2C2C2C]">
                {agent.name}
              </p>
              <p className="truncate text-sm font-medium text-[#2C2C2C]/55">
                {agent.company || agent.brokerName || "Independent"}
              </p>
              {locationLine ? (
                <p className="mt-1 truncate text-xs font-medium text-[#6B9E6E]">
                  {locationLine}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#D4A843]/18 px-2 py-1 text-[11px] font-bold text-[#8a6d32]">
                <Zap className="h-3.5 w-3.5" />
                {Math.round(agent.score)}
              </span>
              {agent.brokerLogo ? (
                <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-[#FAF8F4] ring-1 ring-black/10">
                  <Image
                    src={agent.brokerLogo}
                    alt={agent.brokerName || "Broker"}
                    fill
                    sizes="36px"
                    className="object-contain p-1.5"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#6B9E6E]/12 px-2.5 py-1">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-[#6B9E6E]" />
              <AgentAvailabilityBadge availability={agent.availability} updatedAt={agent.updatedAt} />
            </span>

            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={onAvailable}
              className="ml-auto inline-flex items-center gap-2 rounded-full bg-[#2C2C2C] px-4 py-2 text-xs font-semibold text-white shadow-md transition-colors hover:bg-[#6B9E6E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
            >
              {isNow ? "Available Now" : "Schedule"}
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {c.length > 0 ? (
                <div className="flex -space-x-2">
                  {c.map((a) => (
                    <div
                      key={a.id}
                      className="relative h-7 w-7 overflow-hidden rounded-full ring-2 ring-white shadow-sm"
                      title={a.name}
                    >
                      <AgentAvatarFill name={a.name} imageUrl={a.image} sizes="28px" />
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs font-medium text-[#2C2C2C]/40">
                  No connected agents yet
                </span>
              )}
            </div>

            <Link
              href={`/agents/${encodeURIComponent(agent.id)}`}
              className="shrink-0 text-xs font-semibold text-[#6B9E6E] hover:text-[#2C2C2C] transition-colors"
            >
              Read More →
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

