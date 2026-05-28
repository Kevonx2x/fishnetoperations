"use client";

import { MapPin, MoreHorizontal } from "lucide-react";
import type { PipelineLeadRow } from "@/components/dashboard/agent-pipeline-tab";
import { SupabasePublicImage } from "@/components/supabase-public-image";

export type MobileDealPropertyMeta = {
  title: string;
  priceLine: string | null;
  locationLine: string | null;
  beds: number | null;
  baths: number | null;
  sqft: string | null;
  propertyType: string | null;
  coverUrl: string | null;
};

/** Locked — square thumb; card height matches this exactly. */
const PHOTO_SIZE_PX = 108;

function formatActivityTimestamp(dateIso: string | null | undefined): string {
  if (!dateIso) return "";
  try {
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) return "";
    const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${date} · ${time}`;
  } catch {
    return "";
  }
}

function bedLabel(property: MobileDealPropertyMeta): string {
  if (property.beds == null) return "—";
  if (property.beds <= 0 || String(property.propertyType ?? "").toLowerCase() === "studio") {
    return "Studio";
  }
  return `${property.beds} bed`;
}

function specsLine(property: MobileDealPropertyMeta): string {
  const parts = [
    bedLabel(property),
    property.baths != null ? `${property.baths} bath` : null,
  ].filter((p): p is string => Boolean(p));
  return parts.join(" · ");
}

type PipelineDealCardMobileProps = {
  deal: PipelineLeadRow & {
    property_cover_photo_url?: string | null;
    follow_up_at?: string | null;
    stage_changed_at?: string | null;
  };
  property: MobileDealPropertyMeta;
  onViewDocuments: (deal: PipelineLeadRow) => void;
  onOpenMenu?: (deal: PipelineLeadRow) => void;
  onOpenDeal?: (deal: PipelineLeadRow) => void;
};

export function PipelineDealCardMobile({
  deal,
  property,
  onOpenMenu,
  onOpenDeal,
}: PipelineDealCardMobileProps) {
  const thumb = property.coverUrl ?? deal.property_cover_photo_url ?? null;
  const timestamp = formatActivityTimestamp(deal.updated_at ?? deal.created_at);
  const bedsBathsLine = specsLine(property);

  return (
    <article
      className="relative flex overflow-hidden rounded-xl bg-white font-sans antialiased shadow-[0_4px_16px_rgba(44,44,44,0.06)] [text-rendering:optimizeLegibility]"
      style={{ height: PHOTO_SIZE_PX }}
    >
      <div
        className="relative shrink-0 bg-[#F3F0EA]"
        style={{ width: PHOTO_SIZE_PX, height: PHOTO_SIZE_PX }}
      >
        <button
          type="button"
          onClick={() => onOpenDeal?.(deal)}
          className="absolute inset-0"
          aria-label={`Open ${property.title}`}
        >
          {thumb ? (
            <SupabasePublicImage
              src={thumb}
              alt=""
              fill
              sizes={`${PHOTO_SIZE_PX}px`}
              className="object-cover object-center"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] font-medium text-[#BBBBBB]">
              No photo
            </div>
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={() => onOpenDeal?.(deal)}
        className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-0.5 overflow-hidden py-2 pl-2.5 pr-14 text-left"
      >
        <p className="line-clamp-2 text-[13px] font-semibold leading-[1.2] tracking-normal text-[#2C2C2C]">
          {property.title}
        </p>
        {property.locationLine ? (
          <p className="flex items-center gap-0.5 text-[11px] font-normal leading-[1.25] text-[#888888]">
            <MapPin className="size-2.5 shrink-0 text-[#6B9E6E]" aria-hidden />
            <span className="truncate">{property.locationLine}</span>
          </p>
        ) : null}
        {bedsBathsLine ? (
          <p className="truncate text-[11px] font-normal leading-[1.25] text-[#888888]">{bedsBathsLine}</p>
        ) : null}
        {timestamp ? (
          <p className="truncate text-[11px] font-normal leading-[1.25] text-[#888888]">{timestamp}</p>
        ) : null}
        {property.priceLine ? (
          <p className="truncate text-[13px] font-semibold leading-[1.2] text-[#6B9E6E]">{property.priceLine}</p>
        ) : null}
      </button>

      <div className="pointer-events-none absolute right-2.5 top-11 z-[1] flex w-11 flex-col items-center gap-0.5">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#E8F0E9] ring-2 ring-white shadow-[0_2px_6px_rgba(44,44,44,0.05)]">
          {deal.client_avatar_url ? (
            <SupabasePublicImage
              src={deal.client_avatar_url}
              alt=""
              fill
              sizes="36px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-[#6B9E6E]">
              {deal.name?.trim().charAt(0)?.toUpperCase() || "?"}
            </span>
          )}
          <span
            className="absolute bottom-0 right-0 size-2 rounded-full bg-[#6B9E6E] ring-[1.5px] ring-white"
            aria-hidden
          />
        </div>
        <p className="line-clamp-1 w-full text-center text-[11px] font-medium leading-[1.2] text-[#2C2C2C]">
          {deal.name}
        </p>
      </div>

      <button
        type="button"
        aria-label="Deal options"
        onClick={() => onOpenMenu?.(deal)}
        className="absolute right-2 top-2 z-[2] flex h-7 w-7 items-center justify-center rounded-full text-[#BBBBBB] active:bg-[#F3F0EA]"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
    </article>
  );
}
