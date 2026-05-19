"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Mirrors `PIPELINE_STAGES` in agent-pipeline-tab (keep in sync). */
export const MOBILE_PIPELINE_STAGES = [
  { id: "lead", label: "Inquiry", short: "Inq" },
  { id: "viewing", label: "Viewing", short: "View" },
  { id: "offer", label: "Offer", short: "Offer" },
  { id: "reservation", label: "Reservation", short: "Res." },
  { id: "closed", label: "Closed", short: "Done" },
] as const;

export type MobilePipelineStageId = (typeof MOBILE_PIPELINE_STAGES)[number]["id"];

const STAGE_ORDER: MobilePipelineStageId[] = ["lead", "viewing", "offer", "reservation", "closed"];

function stageAccent(stage: MobilePipelineStageId): string {
  switch (stage) {
    case "lead":
    case "reservation":
      return "#6B9E6E";
    case "offer":
      return "#D4A843";
    case "viewing":
    case "closed":
    default:
      return "#2C2C2C";
  }
}

type AgentPipelineMobileStageNavProps = {
  filterStage: MobilePipelineStageId;
  onStageChange: (stage: MobilePipelineStageId) => void;
  counts: Record<MobilePipelineStageId, number>;
  /** Deals shown in the current stage list (after search/filters). */
  visibleInStageCount: number;
  /** Total active deals across all stages (optional). */
  totalDealCount?: number;
};

export function AgentPipelineMobileStageNav({
  filterStage,
  onStageChange,
  counts,
  visibleInStageCount,
  totalDealCount,
}: AgentPipelineMobileStageNavProps) {
  const activeIndex = STAGE_ORDER.indexOf(filterStage);
  const activeMeta = MOBILE_PIPELINE_STAGES.find((s) => s.id === filterStage);
  const progressPct =
    STAGE_ORDER.length > 1 ? Math.max(0, (activeIndex / (STAGE_ORDER.length - 1)) * 100) : 0;

  return (
    <div className="sticky top-0 z-20 -mx-1 space-y-3 rounded-2xl border border-[#2C2C2C]/[0.08] bg-white px-3 py-3 shadow-[0_2px_12px_rgba(44,44,44,0.06)] sm:mx-0 sm:px-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2C2C2C]/45">
            Your pipeline
          </p>
          <p className="mt-0.5 font-serif text-lg font-bold leading-tight text-[#2C2C2C]">
            {activeMeta?.label ?? "Pipeline"}
          </p>
        </div>
        {totalDealCount != null ? (
          <div className="shrink-0 rounded-full bg-[#FAF8F4] px-2.5 py-1 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#2C2C2C]/45">Active</p>
            <p className="text-sm font-bold tabular-nums text-[#2C2C2C]">{totalDealCount}</p>
          </div>
        ) : null}
      </div>

      <div className="relative">
        <div
          className="pointer-events-none absolute inset-x-0 top-[22px] h-0.5 rounded-full bg-[#2C2C2C]/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-0 top-[22px] h-0.5 rounded-full bg-[#6B9E6E] transition-[width] duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
          aria-hidden
        />

        <div
          className="scrollbar-hide -mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 snap-x snap-mandatory"
          role="tablist"
          aria-label="Pipeline stage"
        >
          {MOBILE_PIPELINE_STAGES.map((stage) => {
            const active = filterStage === stage.id;
            const count = counts[stage.id] ?? 0;
            const accent = stageAccent(stage.id);

            return (
              <button
                key={stage.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onStageChange(stage.id)}
                className={cn(
                  "snap-start flex min-w-[4.25rem] flex-1 flex-col items-center gap-1.5 rounded-xl px-1 py-1 transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B9E6E]/40 focus-visible:ring-offset-2",
                  active ? "bg-[#FAF8F4]" : "hover:bg-[#FAF8F4]/60",
                )}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums transition",
                    active
                      ? "border-[#6B9E6E] bg-[#6B9E6E] text-white shadow-sm"
                      : count > 0
                        ? "border-[#2C2C2C]/15 bg-white text-[#2C2C2C]"
                        : "border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/35",
                  )}
                  style={active ? { borderColor: accent, backgroundColor: accent } : undefined}
                >
                  {count}
                </span>
                <span
                  className={cn(
                    "max-w-[4.5rem] truncate text-center text-[10px] font-bold leading-tight sm:text-[11px]",
                    active ? "text-[#2C2C2C]" : "text-[#2C2C2C]/55",
                  )}
                >
                  <span className="sm:hidden">{stage.short}</span>
                  <span className="hidden sm:inline">{stage.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[#2C2C2C]/[0.06] pt-2.5">
        <p className="text-xs font-semibold text-[#2C2C2C]/70">
          <span className="font-bold text-[#2C2C2C]">{visibleInStageCount}</span>
          {visibleInStageCount === 1 ? " deal" : " deals"}
          <span className="text-[#2C2C2C]/40"> · </span>
          <span className="text-[#2C5F32]">{activeMeta?.label}</span>
        </p>
        <p className="text-[10px] font-medium text-[#2C2C2C]/45">Tap a stage to switch</p>
      </div>
    </div>
  );
}

type AgentPipelineMobileShellProps = {
  stageNav: ReactNode;
  children: ReactNode;
  searchBanner?: ReactNode;
};

export function AgentPipelineMobileShell({
  stageNav,
  children,
  searchBanner,
}: AgentPipelineMobileShellProps) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-3 lg:hidden">
      {searchBanner}
      {stageNav}
      <div className="touch-pan-y space-y-2.5 overscroll-contain pb-2 md:touch-auto">{children}</div>
    </div>
  );
}
