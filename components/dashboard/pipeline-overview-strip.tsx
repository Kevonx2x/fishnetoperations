"use client";

import { GitBranch, LineChart, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PipelineOverviewStat = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  hintTone?: "positive" | "neutral";
  icon?: LucideIcon;
};

const DEFAULT_ICONS: Record<string, LucideIcon> = {
  inquiries: GitBranch,
  value: LineChart,
  score: Sparkles,
};

type Props = {
  stats: PipelineOverviewStat[];
  className?: string;
};

export function PipelineOverviewStrip({ stats, className }: Props) {
  return (
    <section className={cn(className)}>
      <div
        className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-pl-3 scroll-pr-6 px-3 pb-2 pt-0.5 scrollbar-hide touch-pan-x"
        style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain" }}
      >
        {stats.map((stat) => {
          const Icon = stat.icon ?? DEFAULT_ICONS[stat.id] ?? GitBranch;
          return (
            <div
              key={stat.id}
              className="w-[72vw] max-w-[300px] shrink-0 snap-start overflow-visible rounded-2xl bg-white px-4 py-4 shadow-[0_6px_24px_rgba(44,44,44,0.07)]"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-[#E8F0E9] text-[#6B9E6E]">
                <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
              </span>
              <p className="mt-3 text-[12px] font-medium text-[#888888]">{stat.label}</p>
              <p className="mt-1 font-serif text-[28px] font-bold leading-none tracking-tight text-[#2C2C2C]">
                {stat.value}
              </p>
              {stat.hint ? (
                <span
                  className={cn(
                    "mt-3 inline-flex max-w-full rounded-full px-2.5 py-1 text-[11px] font-semibold leading-snug",
                    stat.hintTone === "positive"
                      ? "bg-[#E8F0E9] text-[#2C5F32]"
                      : "bg-[#F3F0EA] text-[#888888]",
                  )}
                >
                  {stat.hint}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
