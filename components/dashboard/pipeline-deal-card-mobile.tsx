"use client";

import { useState } from "react";
import { ArrowRight, Bath, BedDouble, Clock, FileText, Heart, MoreHorizontal, Ruler } from "lucide-react";
import {
  agentPipelineStageDisplayLabel,
  type PipelineLeadRow,
  type PipelineStageId,
  PIPELINE_STAGES,
} from "@/components/dashboard/agent-pipeline-tab";
import { SupabasePublicImage } from "@/components/supabase-public-image";
import {
  getPipelineDealBadge,
  pipelineBadgeLabel,
  pipelineDealStatusHint,
  type PipelineDealBadge,
} from "@/lib/pipeline-badge-logic";
import { cn } from "@/lib/utils";

export type MobileDealPropertyMeta = {
  title: string;
  priceLine: string | null;
  beds: number | null;
  baths: number | null;
  sqft: string | null;
  propertyType: string | null;
  coverUrl: string | null;
};

const BADGE_STYLES: Record<PipelineDealBadge, string> = {
  new: "bg-[#6B9E6E]/15 text-[#2C5F32]",
  hot: "bg-orange-100 text-orange-700",
  follow_up: "bg-purple-100 text-purple-800",
};

const NEXT_STAGE: Partial<Record<PipelineStageId, PipelineStageId>> = {
  lead: "viewing",
  viewing: "offer",
  offer: "reservation",
  reservation: "closed",
};

function nextStageLabel(from: PipelineStageId): string | null {
  const next = NEXT_STAGE[from];
  if (!next) return null;
  const hit = PIPELINE_STAGES.find((s) => s.id === next);
  return hit?.label ?? null;
}

function formatCreated(dateIso: string): string {
  try {
    return new Date(dateIso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return "";
  }
}

function followUpLine(followUpAt: string | null | undefined): { relative: string; date: string } | null {
  if (!followUpAt) return null;
  const t = new Date(followUpAt).getTime();
  if (!Number.isFinite(t)) return null;
  const days = Math.ceil((t - Date.now()) / 86400000);
  const relative =
    days <= 0 ? "Follow up today" : days === 1 ? "Follow up tomorrow" : `Follow up in ${days} days`;
  const date = new Date(followUpAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return { relative, date };
}

type PipelineDealCardMobileProps = {
  deal: PipelineLeadRow & {
    property_cover_photo_url?: string | null;
    follow_up_at?: string | null;
    stage_changed_at?: string | null;
  };
  property: MobileDealPropertyMeta;
  moveBusy?: boolean;
  onMoveToNextStage?: (deal: PipelineLeadRow, nextStage: PipelineStageId) => void;
  onViewDocuments: (deal: PipelineLeadRow) => void;
  onOpenMenu?: (deal: PipelineLeadRow) => void;
  statusHint?: string | null;
};

export function PipelineDealCardMobile({
  deal,
  property,
  moveBusy,
  onMoveToNextStage,
  onViewDocuments,
  onOpenMenu,
  statusHint,
}: PipelineDealCardMobileProps) {
  const [fav, setFav] = useState(false);
  const badge = getPipelineDealBadge(deal);
  const next = NEXT_STAGE[deal.pipeline_stage];
  const moveLabel = next ? nextStageLabel(deal.pipeline_stage) : null;
  const followUp = followUpLine(deal.follow_up_at);
  const statusLine = statusHint ?? pipelineDealStatusHint(badge, followUp != null);
  const thumb = property.coverUrl ?? deal.property_cover_photo_url ?? null;

  return (
    <article className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-3 shadow-[0_2px_12px_rgba(44,44,44,0.06)] transition-shadow duration-200 hover:shadow-md active:scale-[0.98] active:shadow-sm">
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#FAF8F4]">
            {thumb ? (
              <SupabasePublicImage src={thumb} alt="" fill sizes="80px" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] font-bold uppercase tracking-wide text-[#2C2C2C]/35">
                No photo
              </div>
            )}
            <button
              type="button"
              aria-label={fav ? "Remove from favorites" : "Add to favorites"}
              onClick={() => setFav((v) => !v)}
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[#2C2C2C]/55 shadow-sm"
            >
              <Heart className={cn("h-3.5 w-3.5", fav && "fill-[#D4A843] text-[#D4A843]")} aria-hidden />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                {badge ? (
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      BADGE_STYLES[badge],
                    )}
                  >
                    {pipelineBadgeLabel(badge)}
                  </span>
                ) : null}
                <p className="truncate font-serif text-base font-bold leading-tight text-[#2C2C2C]">{deal.name}</p>
                <p className="truncate text-sm font-medium text-[#2C2C2C]/55">{property.title}</p>
              </div>
              <button
                type="button"
                aria-label="Deal options"
                onClick={() => onOpenMenu?.(deal)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#2C2C2C]/55 hover:bg-[#FAF8F4]"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          {property.priceLine ? (
            <p className="font-serif text-lg font-bold text-[#6B9E6E]">{property.priceLine}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-[#2C2C2C]/55">
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" aria-hidden />
              {property.beds != null
                ? property.beds <= 0 || String(property.propertyType ?? "").toLowerCase() === "studio"
                  ? "Studio"
                  : `${property.beds} bed${property.beds === 1 ? "" : "s"}`
                : "—"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Bath className="h-3.5 w-3.5" aria-hidden />
              {property.baths != null ? `${property.baths} bath${property.baths === 1 ? "" : "s"}` : "—"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5" aria-hidden />
              {property.sqft ? `${property.sqft} sqft` : "—"}
            </span>
          </div>
        </div>

        <div className="space-y-1 border-t border-[#2C2C2C]/[0.06] pt-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#2C2C2C]/55">
            <span className="rounded-full border border-[#6B9E6E]/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2C5F32]">
              {agentPipelineStageDisplayLabel(deal.pipeline_stage)}
            </span>
            <span>Created {formatCreated(deal.created_at)}</span>
          </div>
          {followUp ? (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#2C2C2C]/70">
              <Clock className="h-3.5 w-3.5 shrink-0 text-[#6B9E6E]" aria-hidden />
              <span>{followUp.relative}</span>
              <span className="text-[#2C2C2C]/40">·</span>
              <span className="text-[#2C2C2C]/55">{followUp.date}</span>
            </p>
          ) : statusLine ? (
            <p
              className={cn(
                "flex items-center gap-1 text-xs font-semibold",
                badge === "hot" ? "text-orange-700" : badge === "follow_up" ? "text-purple-800" : "text-[#2C2C2C]/70",
              )}
            >
              <span className="min-w-0 truncate">{statusLine}</span>
              <ArrowRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  badge === "hot" ? "text-orange-600" : badge === "follow_up" ? "text-purple-700" : "text-[#6B9E6E]",
                )}
                aria-hidden
              />
            </p>
          ) : null}
        </div>

        <div className={cn("flex gap-2", deal.pipeline_stage === "closed" && "flex-col")}>
          {deal.pipeline_stage !== "closed" && next && moveLabel ? (
            <button
              type="button"
              disabled={moveBusy || !onMoveToNextStage}
              onClick={() => onMoveToNextStage?.(deal, next)}
              className="flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-full bg-gradient-to-b from-[#7AAE7E] to-[#6B9E6E] px-3 py-2 text-sm font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">Move to {moveLabel}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onViewDocuments(deal)}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-full border-2 border-[#6B9E6E] px-3 py-2 text-sm font-bold text-[#2C5F32] transition active:scale-95",
              deal.pipeline_stage === "closed" ? "w-full" : "min-w-0 flex-1",
            )}
          >
            <FileText className="h-4 w-4 shrink-0" aria-hidden />
            View Documents
          </button>
        </div>
      </div>
    </article>
  );
}
