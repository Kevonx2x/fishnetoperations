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
  const arcColor = "#A8C5A8";

  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0" aria-hidden>
      <circle cx="44" cy="44" r={r} fill="none" stroke="#163024" strokeWidth="6" />
      <circle
        cx="44"
        cy="44"
        r={r}
        fill="none"
        stroke={arcColor}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform="rotate(-90 44 44)"
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
        "rounded-2xl bg-[#1F3A2E] p-5 text-white shadow-[0_8px_24px_rgba(31,58,46,0.35)]",
        className,
      )}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">YOUR PIPELINE</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <h2 className="font-serif text-xl font-bold leading-tight">{stageLabel}</h2>
            <span className="rounded-full bg-[#A8C5A8]/25 px-2 py-0.5 text-[10px] font-bold text-[#D4E8D4]">
              {stageActiveCount} active
            </span>
          </div>
          <p className="mt-2 text-[11px] font-medium leading-snug text-white/85">
            Keep it up! You&apos;re performing better than{" "}
            {/* TODO: compute percentile from agent score distribution once 50+ agents scored */}
            <span className="font-bold text-[#A8C5A8]">72%</span> of agents
          </p>
        </div>
        <div className="relative flex flex-col items-center justify-center px-1">
          <ScoreRing score={scoreOutOfTen} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-serif text-2xl font-bold leading-none">{displayScore}</span>
            <span className="text-[10px] font-semibold text-white/65">/ 10</span>
          </div>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">PIPELINE VALUE</p>
          <p className="mt-0.5 font-serif text-xl font-bold text-[#A8C5A8]">{pipelineValueFormatted}</p>
          <div className="mt-1 flex items-center justify-end gap-2">
            <Link
              href="/analytics"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#163024] text-white/90 transition hover:bg-[#0f2219]"
              aria-label="View analytics"
            >
              <LineChart className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <p className="mt-1 text-[10px] font-semibold text-[#A8C5A8]">
            {/* TODO: compute from pipeline_history snapshots, requires daily cron + history table */}
            ↑ 18% vs last 30 days
          </p>
        </div>
      </div>
    </section>
  );
}
