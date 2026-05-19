"use client";

import { Fragment } from "react";
import { Bookmark, Eye, FileText, Handshake, Wrench, type LucideIcon } from "lucide-react";
import { PIPELINE_STAGES, type PipelineStageId } from "@/components/dashboard/agent-pipeline-tab";
import { cn } from "@/lib/utils";

const STAGE_ICONS: Record<PipelineStageId, LucideIcon> = {
  lead: FileText,
  viewing: Eye,
  offer: Handshake,
  reservation: Bookmark,
  closed: Wrench,
};

type PipelineStageScrollerProps = {
  activeStage: PipelineStageId;
  counts: Record<PipelineStageId, number>;
  onStageChange: (stage: PipelineStageId) => void;
  className?: string;
};

export function PipelineStageScroller({
  activeStage,
  counts,
  onStageChange,
  className,
}: PipelineStageScrollerProps) {
  return (
    <div
      className={cn("-mx-1 overflow-x-auto px-1 pb-0.5 scrollbar-hide", className)}
      role="tablist"
      aria-label="Pipeline stages"
    >
      <div className="flex min-w-max items-center">
        {PIPELINE_STAGES.map((stage, index) => {
          const Icon = STAGE_ICONS[stage.id];
          const isActive = activeStage === stage.id;
          const count = counts[stage.id] ?? 0;

          return (
            <Fragment key={stage.id}>
              {index > 0 ? (
                <div
                  className="mx-0.5 h-px w-5 shrink-0 border-t border-dashed border-[#2C2C2C]/18"
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? "step" : undefined}
                onClick={() => onStageChange(stage.id)}
                className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 py-0.5"
              >
                <span className="relative flex h-11 w-11 items-center justify-center">
                  {isActive ? (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1F3A2E] text-white shadow-[0_2px_8px_rgba(31,58,46,0.25)]">
                      <Icon className="h-[18px] w-[18px] stroke-[1.75]" aria-hidden />
                    </span>
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#2C2C2C]/14 bg-white text-[#2C2C2C]/38">
                      <Icon className="h-[18px] w-[18px] stroke-[1.75]" aria-hidden />
                    </span>
                  )}
                  {count > 0 ? (
                    <span
                      className="absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#1F3A2E] px-0.5 text-[9px] font-bold leading-none text-white ring-2 ring-[#FAF8F4]"
                      aria-hidden
                    >
                      {count}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "max-w-full truncate text-center font-sans text-[11px] font-semibold leading-tight",
                    isActive
                      ? "text-[#1F3A2E] underline decoration-[#6B9E6E] decoration-2 underline-offset-[5px]"
                      : "text-[#2C2C2C]/50",
                  )}
                >
                  {stage.label}
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
