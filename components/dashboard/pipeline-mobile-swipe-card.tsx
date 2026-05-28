"use client";

import { useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { animate, motion, useMotionValue, type PanInfo } from "framer-motion";
import {
  getNextPipelineStage,
  pipelineStageToastLabel,
} from "@/lib/agent-pipeline-card-menu";
import type { PipelineLeadRow } from "@/components/dashboard/agent-pipeline-tab";
import { cn } from "@/lib/utils";

const SWIPE_COMMIT_RATIO = 0.6;

type SwipeIntent = "advance" | "decline" | null;

type Props = {
  deal: PipelineLeadRow;
  children: ReactNode;
  onSwipeAdvance: (deal: PipelineLeadRow) => void;
  onSwipeDecline: (deal: PipelineLeadRow) => void;
};

export function PipelineMobileSwipeCard({ deal, children, onSwipeAdvance, onSwipeDecline }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [intent, setIntent] = useState<SwipeIntent>(null);
  const [cardWidth, setCardWidth] = useState(320);

  const nextStage = getNextPipelineStage(deal.pipeline_stage);

  const measureWidth = () => {
    const w = rootRef.current?.offsetWidth;
    if (w && w > 0) setCardWidth(w);
  };

  const resetPosition = () => {
    animate(x, 0, { type: "spring", stiffness: 520, damping: 42 });
    setIntent(null);
  };

  const handleDrag = (_: unknown, info: PanInfo) => {
    const width = rootRef.current?.offsetWidth ?? 1;
    const ratio = Math.abs(info.offset.x) / width;
    if (info.offset.x > 12 && nextStage) {
      setIntent("advance");
    } else if (info.offset.x < -12) {
      setIntent("decline");
    } else if (ratio < 0.08) {
      setIntent(null);
    }
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const width = rootRef.current?.offsetWidth ?? 1;
    const threshold = width * SWIPE_COMMIT_RATIO;

    if (info.offset.x >= threshold && nextStage) {
      onSwipeAdvance(deal);
      x.set(0);
      setIntent(null);
      return;
    }
    if (info.offset.x <= -threshold) {
      onSwipeDecline(deal);
      x.set(0);
      setIntent(null);
      return;
    }
    resetPosition();
  };

  return (
    <div ref={rootRef} className="relative overflow-hidden rounded-xl" onPointerDown={measureWidth}>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center px-4 transition-opacity",
          intent === "advance" && "bg-[#E8F0E9]",
          intent === "decline" && "bg-[#FDF0EE]",
          !intent && "opacity-0",
        )}
        aria-hidden
      >
        {intent === "advance" && nextStage ? (
          <div className="ml-auto flex items-center gap-2 text-sm font-semibold text-[#2C5F32]">
            <ArrowRight className="size-5" aria-hidden />
            {pipelineStageToastLabel(nextStage)}
          </div>
        ) : null}
        {intent === "decline" ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-[#B85450]">
            <ArrowLeft className="size-5" aria-hidden />
            Decline
          </div>
        ) : null}
      </div>

      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -cardWidth, right: cardWidth }}
        dragElastic={0.14}
        dragMomentum={false}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        className="relative touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
}
