"use client";

import { useDndMonitor, useDroppable } from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const PIPELINE_PULSE_DROP_IDS = {
  won: "kanban-zone:won",
  lost: "kanban-zone:lost",
  archive: "kanban-zone:archive",
} as const;

export type PipelinePulseStats = {
  pipelineValueLine: string;
  hotLeadsLine: string;
  hotLeadsCaughtUp: boolean;
  avgTimeLine: string;
};

function formatPesoAbbrev(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "₱0";
  if (n >= 1_000_000_000) return `₱${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(0)}K`;
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}

/** Sum property prices for active pipeline leads (client-side). */
export function computePipelinePulseStats(
  deals: { pipeline_stage: string; property_id: string | null; created_at: string; updated_at?: string | null }[],
  priceByPropertyId: Record<string, number>,
): PipelinePulseStats {
  const active = deals.filter((d) => {
    const s = String(d.pipeline_stage ?? "").trim().toLowerCase();
    return s !== "closed" && s !== "declined";
  });

  let sum = 0;
  for (const d of active) {
    if (!d.property_id?.trim()) continue;
    const n = priceByPropertyId[d.property_id.trim()];
    if (typeof n === "number" && Number.isFinite(n)) sum += n;
  }

  const now = Date.now();
  const cutoff = now - 48 * 3600 * 1000;
  let hot = 0;
  for (const d of active) {
    const u = new Date(d.updated_at ?? d.created_at).getTime();
    if (Number.isFinite(u) && u < cutoff) hot++;
  }

  let avgTimeLine = "—";
  if (active.length > 0) {
    let totalDays = 0;
    for (const d of active) {
      const c = new Date(d.created_at).getTime();
      if (Number.isFinite(c)) totalDays += (now - c) / 86400000;
    }
    avgTimeLine = `${Math.round(totalDays / active.length)} days`;
  }

  const pipelineValueLine = formatPesoAbbrev(sum);
  const hotLeadsCaughtUp = hot === 0;
  const hotLeadsLine = hotLeadsCaughtUp ? "All caught up" : `${hot} not touched in 48h`;

  return {
    pipelineValueLine,
    hotLeadsLine,
    hotLeadsCaughtUp,
    avgTimeLine,
  };
}

function PulseDropSlot({
  id,
  label,
  sub,
  tone,
}: {
  id: string;
  label: string;
  sub: string;
  tone: "won" | "lost" | "neutral";
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const labelTone =
    tone === "won" ? "text-[#2C5F32]" : tone === "lost" ? "text-red-600" : "text-[#2C2C2C]/70";
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[76px] min-w-0 flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-[#2C2C2C]/25 bg-white/70 px-2 py-2 text-center transition-[border-color,background-color,box-shadow] duration-150",
        isOver &&
          (tone === "lost"
            ? "border-red-400/70 bg-red-50/95 shadow-sm"
            : tone === "won"
              ? "border-[#6B9E6E]/55 bg-[#6B9E6E]/12 shadow-sm"
              : "border-[#2C2C2C]/35 bg-[#FAF8F4] shadow-sm"),
      )}
      aria-label={`${label}. ${sub}`}
    >
      <p className={cn("font-sans text-[11px] font-bold uppercase tracking-wide", labelTone)}>{label}</p>
      <p className="mt-0.5 max-w-[160px] font-sans text-[10px] font-medium leading-snug text-[#2C2C2C]/45">
        {sub}
      </p>
    </div>
  );
}

export function PipelinePulseBar({ stats }: { stats: PipelinePulseStats }) {
  const [dragging, setDragging] = useState(false);

  useDndMonitor({
    onDragStart: () => setDragging(true),
    onDragEnd: () => setDragging(false),
    onDragCancel: () => setDragging(false),
    onDragAbort: () => setDragging(false),
  });

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-20 border-t border-stone-200 bg-[#FAF8F4] py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]",
        "px-4 supports-[backdrop-filter]:bg-[#FAF8F4]/95 supports-[backdrop-filter]:backdrop-blur-sm",
        /* Desktop agent shell: aside is w-[180px] on non-messages tabs; align with main horizontal padding (md:px-8). */
        "lg:left-[180px] lg:px-8",
      )}
      data-tour="pipeline-pulse-bar"
    >
      <div className="relative mx-auto flex w-full max-w-[1600px] min-w-0 items-center justify-around">
        <AnimatePresence mode="wait" initial={false}>
          {!dragging ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="flex w-full flex-row flex-wrap items-start justify-around gap-4 sm:flex-nowrap sm:items-center"
            >
              <div className="min-w-0 flex-1 text-center">
                <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/50">
                  Pipeline value
                </p>
                <p className="mt-1 font-sans text-lg font-bold tabular-nums text-[#2C2C2C]">
                  {stats.pipelineValueLine}
                </p>
              </div>
              <div className="min-w-0 flex-1 text-center">
                <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/50">
                  Hot leads
                </p>
                <p
                  className={cn(
                    "mt-1 flex items-center justify-center gap-1.5 font-sans text-sm font-bold",
                    stats.hotLeadsCaughtUp ? "text-[#6B9E6E]" : "text-[#2C2C2C]",
                  )}
                >
                  {!stats.hotLeadsCaughtUp ? (
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#D4A843]" aria-hidden />
                  ) : null}
                  {stats.hotLeadsLine}
                </p>
              </div>
              <div className="min-w-0 flex-1 text-center">
                <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/50">
                  Avg time in pipeline
                </p>
                <p className="mt-1 font-sans text-lg font-bold tabular-nums text-[#2C2C2C]">{stats.avgTimeLine}</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="drag"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="flex w-full flex-row items-stretch justify-around gap-3"
            >
              <PulseDropSlot
                id={PIPELINE_PULSE_DROP_IDS.won}
                label="Won"
                sub="Mark closed as won"
                tone="won"
              />
              <PulseDropSlot id={PIPELINE_PULSE_DROP_IDS.lost} label="Lost" sub="Decline this deal" tone="lost" />
              <PulseDropSlot
                id={PIPELINE_PULSE_DROP_IDS.archive}
                label="Archive"
                sub="Hide from active pipeline"
                tone="neutral"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
