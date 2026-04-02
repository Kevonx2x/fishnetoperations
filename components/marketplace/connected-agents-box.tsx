"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { MarketplaceAgent } from "@/lib/marketplace-types";
import { VerifiedAgentBadge } from "@/components/marketplace/verified-agent-badge";

export function ConnectedAgentsBox({
  title = "Connected Agents",
  agents,
  defaultVisible = 3,
}: {
  title?: string;
  agents: MarketplaceAgent[];
  defaultVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(() => {
    const list = agents ?? [];
    return expanded ? list : list.slice(0, defaultVisible);
  }, [agents, expanded, defaultVisible]);

  const hiddenCount = Math.max(0, (agents?.length ?? 0) - defaultVisible);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 pt-4">
        <p className="text-sm font-semibold text-[#2C2C2C]">{title}</p>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full bg-[#FAF8F4] px-3 py-1.5 text-xs font-semibold text-[#2C2C2C]/70 ring-1 ring-black/10 hover:bg-[#FAF8F4]/70"
          >
            Show More
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      <div className="px-4 pb-4 pt-3">
        <div className="space-y-3">
          {visible.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="group rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] p-3 shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 overflow-hidden rounded-full bg-white ring-1 ring-black/10">
                  {a.image ? (
                    <Image src={a.image} alt={a.name} fill sizes="40px" className="object-cover" />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/agents/${encodeURIComponent(a.id)}`}
                      className="truncate font-semibold text-[#2C2C2C] hover:underline hover:decoration-[#C9A84C]/60 hover:underline-offset-4"
                    >
                      {a.name}
                    </Link>
                    <Link
                      href={`/agents/${encodeURIComponent(a.id)}`}
                      title="Trust Score"
                      className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-bold text-[#2C2C2C] ring-1 ring-black/10 hover:bg-[#FAF8F4]"
                      aria-label={`Trust Score ${Math.round(a.score)}`}
                    >
                      {Math.round(a.score)}
                    </Link>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#2C2C2C]/60">
                    {a.brokerId ? (
                      <Link
                        href={`/brokers/${encodeURIComponent(a.brokerId)}`}
                        className="truncate hover:text-[#2C2C2C] hover:underline hover:decoration-[#C9A84C]/60 hover:underline-offset-4"
                      >
                        {a.company || a.brokerName}
                      </Link>
                    ) : (
                      <span className="truncate">{a.company || a.brokerName || "Independent"}</span>
                    )}
                    <VerifiedAgentBadge show />
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-[#2C2C2C]/60">
                    {a.availability || "Available"}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-[#2C2C2C]/60">
                <Link
                  href={`/agents/${encodeURIComponent(a.id)}`}
                  title="Trust Score"
                  className="inline-flex items-center gap-1 hover:text-[#2C2C2C]"
                >
                  Score {Math.round(a.score)}
                </Link>
                <Link href={`/agents/${encodeURIComponent(a.id)}`} className="hover:text-[#2C2C2C]">
                  View →
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {!expanded && hiddenCount > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/70 to-transparent" />
      )}
    </div>
  );
}

