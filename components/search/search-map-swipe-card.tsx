"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { animate, motion, useMotionValue, type PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";

const SWIPE_COMMIT_PX = 80;
const SWIPE_COMMIT_RATIO = 0.25;

type SwipeIntent = "next" | "previous" | null;

type Props = {
  children: ReactNode;
  canSwipeNext: boolean;
  canSwipePrevious: boolean;
  onSwipeNext: () => void;
  onSwipePrevious: () => void;
};

export function SearchMapSwipeCard({
  children,
  canSwipeNext,
  canSwipePrevious,
  onSwipeNext,
  onSwipePrevious,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [intent, setIntent] = useState<SwipeIntent>(null);
  const [cardWidth, setCardWidth] = useState(320);

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

    if (info.offset.x < -12 && canSwipeNext) {
      setIntent("next");
    } else if (info.offset.x > 12 && canSwipePrevious) {
      setIntent("previous");
    } else if (ratio < 0.06) {
      setIntent(null);
    }
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const width = rootRef.current?.offsetWidth ?? 1;
    const threshold = Math.max(SWIPE_COMMIT_PX, width * SWIPE_COMMIT_RATIO);

    if (info.offset.x <= -threshold && canSwipeNext) {
      onSwipeNext();
      x.set(0);
      setIntent(null);
      return;
    }
    if (info.offset.x >= threshold && canSwipePrevious) {
      onSwipePrevious();
      x.set(0);
      setIntent(null);
      return;
    }
    resetPosition();
  };

  return (
    <div ref={rootRef} className="relative overflow-hidden" onPointerDown={measureWidth}>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center px-3 transition-opacity",
          intent === "next" && "bg-[#E8F0E9]",
          intent === "previous" && "bg-[#F3F0EA]",
          !intent && "opacity-0",
        )}
        aria-hidden
      >
        {intent === "next" && canSwipeNext ? (
          <div className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-[#2C5F32]">
            Next nearby
            <ChevronRight className="size-4" aria-hidden />
          </div>
        ) : null}
        {intent === "previous" && canSwipePrevious ? (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2C5F32]">
            <ChevronLeft className="size-4" aria-hidden />
            Previous
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
