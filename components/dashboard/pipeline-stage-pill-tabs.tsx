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

/** Mobile pipeline stage row — five equal columns, label over count, no horizontal scroll. */
export function PipelineStagePillTabs({ activeStage, counts, onStageChange, className }: Props) {
  return (
    <div
      className={cn("grid grid-cols-5 gap-0.5 px-3 pb-2", className)}
      role="tablist"
      aria-label="Pipeline stages"
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
              "flex min-w-0 flex-col items-center justify-center rounded-full px-0.5 py-1.5 transition",
              isActive
                ? "bg-[#6B9E6E] text-white shadow-[0_4px_14px_rgba(107,158,110,0.28)]"
                : "bg-transparent text-[#2C2C2C]",
            )}
          >
            <span
              className={cn(
                "w-full text-center text-[10px] font-semibold leading-tight tracking-tight",
                isActive ? "text-white" : "text-[#2C2C2C]",
              )}
            >
              {label}
            </span>
            <span
              className={cn(
                "mt-0.5 text-[10px] font-medium leading-none",
                isActive ? "text-white/90" : "text-[#AAAAAA]",
              )}
            >
              ({count})
            </span>
          </button>
        );
      })}
    </div>
  );
}
