"use client";

import { createElement, Fragment } from "react";
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

export function PipelineStageScroller(props: PipelineStageScrollerProps) {
  return <ScrollerInner {...props} />;
}

function ScrollerInner({ activeStage, counts, onStageChange, className }: PipelineStageScrollerProps) {
  return createElement(
    "div",
    { className: cn("-mx-1 overflow-x-auto px-1 pb-1 scrollbar-hide", className) },
    createElement(
      "div",
      { className: "flex min-w-max items-start gap-0" },
      PIPELINE_STAGES.map((stage, index) => {
        const Icon = STAGE_ICONS[stage.id];
        const isActive = activeStage === stage.id;
        const count = counts[stage.id] ?? 0;
        return createElement(
          Fragment,
          { key: stage.id },
          index > 0
            ? createElement("div", {
                className: "mt-[22px] h-0 w-6 shrink-0 self-start border-t border-dashed border-[#2C2C2C]/20",
                "aria-hidden": true,
              })
            : null,
          createElement(
            "button",
            {
              type: "button",
              onClick: () => onStageChange(stage.id),
              className: "flex w-[4.25rem] shrink-0 flex-col items-center gap-1.5",
              "aria-current": isActive ? "step" : undefined,
            },
            createElement(
              "div",
              { className: "relative" },
              createElement(
                "div",
                {
                  className: cn(
                    "flex h-12 w-12 items-center justify-center rounded-full border-2 transition",
                    isActive
                      ? "border-[#6B9E6E] bg-[#1F3A2E] text-white"
                      : "border-[#6B9E6E]/50 bg-white text-[#2C2C2C]/40",
                  ),
                },
                createElement(Icon, { className: "h-5 w-5", "aria-hidden": true }),
              ),
              count > 0
                ? createElement(
                    "span",
                    {
                      className:
                        "absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#1F3A2E] px-1 text-[10px] font-bold text-white",
                    },
                    String(count),
                  )
                : null,
            ),
            createElement(
              "span",
              {
                className: cn(
                  "text-center font-sans text-[11px] font-semibold",
                  isActive ? "text-[#1F3A2E] underline decoration-[#6B9E6E] decoration-2 underline-offset-4" : "text-[#2C2C2C]/55",
                ),
              },
              stage.label,
            ),
          ),
        );
      }),
    ),
  );
}
