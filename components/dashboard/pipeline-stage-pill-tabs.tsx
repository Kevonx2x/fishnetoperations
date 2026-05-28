"use client";

import { PIPELINE_STAGES, type PipelineStageId } from "@/components/dashboard/agent-pipeline-tab";
import { cn } from "@/lib/utils";

const PILL_LABELS: Record<PipelineStageId, string> = {
  lead: "Inquiries",
  viewing: "Viewing",
  offer: "Offer",
  reservation: "Reservation",
  closed: "Closed",
};

type Props = {
  activeStage: PipelineStageId;
  counts: Record<PipelineStageId, number>;
  onStageChange: (stage: PipelineStageId) => void;
  className?: string;
};

export function PipelineStagePillTabs({ activeStage, counts, onStageChange, className }: Props) {
  return (
    <div
      className={cn(
        "-mx-3 flex snap-x snap-proximity gap-2 overflow-x-auto scroll-pl-3 scroll-pr-8 px-3 pb-1.5 scrollbar-hide touch-pan-x",
        className,
      )}
      role="tablist"
      aria-label="Pipeline stages"
      style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain" }}
    >
      {PIPELINE_STAGES.map((stage) => {
        const isActive = activeStage === stage.id;
        const count = counts[stage.id] ?? 0;
        const label = PILL_LABELS[stage.id] ?? stage.label;

        return (
          <button
            key={stage.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onStageChange(stage.id)}
            className={cn(
              "shrink-0 snap-start whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold transition",
              isActive
                ? "bg-[#6B9E6E] text-white shadow-[0_4px_14px_rgba(107,158,110,0.28)]"
                : "bg-transparent text-[#2C2C2C]",
            )}
          >
            {label}
            <span className={cn("ml-0.5 font-medium", isActive ? "text-white/90" : "text-[#AAAAAA]")}>
              ({count})
            </span>
          </button>
        );
      })}
    </div>
  );
}
