"use client";

// TODO: real scoring engine (closings + response time + reviews) — scoreOutOfTen prop; replace agents.score / placeholder with computed value

import Link from "next/link";
import { LineChart } from "lucide-react";
import {
  agentPipelineStageDisplayLabel,
  type PipelineStageId,
} from "@/components/dashboard/agent-pipeline-tab";
import { cn } from "@/lib/utils";

type PipelineHeroCardProps = {
  stageId: PipelineStageId;
  stageActiveCount: number;
  scoreOutOfTen: number;
  pipelineValueFormatted: string;
  className?: string;
};

function ScoreRing({ score, max = 10 }: { score: number; max?: number }) {
  const pct = Math.min(1, Math.max(0, score / max));
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  // TODO: dynamic color based on score band (red < 5, yellow 5-7, sage > 7)

  return (
    <svg width="92" height="92" viewBox="0 0 92 92" className="shrink-0" aria-hidden>
      <circle cx="46" cy="46" r={r} fill="none" stroke="#E5E0D6" strokeWidth="5" />
      <circle
        cx="46"
        cy="46"
        r={r}
        fill="none"
        stroke="#6B9E6E"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform="rotate(-90 46 46)"
      />
    </svg>
  );
}

export function PipelineHeroCard({
  stageId,
  stageActiveCount,
  scoreOutOfTen,
  pipelineValueFormatted,
  className,
}: PipelineHeroCardProps) {
  const stageLabel = agentPipelineStageDisplayLabel(stageId);
  const displayScore = Number.isFinite(scoreOutOfTen) ? scoreOutOfTen.toFixed(1) : "5.0";

  return (
    <section
      className={cn(
        "rounded-2xl bg-[#FAF8F4] p-6 shadow-[0_4px_24px_rgba(44,44,44,0.08)]",
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 sm:gap-6">
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2C2C2C]/45">
            Your pipeline
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-xl font-bold leading-tight text-[#2C2C2C] sm:text-2xl">
              {stageLabel}
            </h2>
            <span className="rounded-full border border-[#6B9E6E]/45 bg-white/60 px-2 py-0.5 text-[10px] font-bold text-[#2C5F32]">
              {stageActiveCount} active
            </span>
          </div>
          <p className="line-clamp-2 font-sans text-sm leading-snug text-gray-600">
            {/* TODO: compute percentile from agent score distribution once 50+ agents scored */}
            Performing better than <span className="font-semibold text-[#6B9E6E]">72%</span> of agents
          </p>
        </div>

        <div className="relative flex shrink-0 flex-col items-center justify-center px-0.5">
          <ScoreRing score={scoreOutOfTen} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-serif text-2xl font-bold leading-none text-[#2C2C2C]">{displayScore}</span>
            <span className="mt-0.5 font-sans text-[10px] font-semibold text-[#2C2C2C]/45">/ 10</span>
          </div>
        </div>

        <div className="min-w-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2C2C2C]/45">
            Pipeline value
          </p>
          <p className="mt-0.5 font-serif text-3xl font-bold leading-none tracking-tight text-[#2C2C2C] sm:text-4xl">
            {pipelineValueFormatted}
          </p>
          <div className="mt-2 flex items-center justify-end gap-2">
            <Link
              href="/analytics"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#2C2C2C]/10 bg-white text-[#6B9E6E] shadow-sm transition hover:border-[#6B9E6E]/30 hover:bg-white"
              aria-label="View analytics"
            >
              <LineChart className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <p className="mt-1.5 font-sans text-xs font-semibold text-[#6B9E6E]">
            {/* TODO: compute from pipeline_history snapshots, requires daily cron + history table */}
            ↑ 18% vs last 30 days
          </p>
        </div>
      </div>
    </section>
  );
}
