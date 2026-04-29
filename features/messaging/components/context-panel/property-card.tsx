import Image from "next/image";
import Link from "next/link";
import { Bath, Bed, DollarSign, ExternalLink, Square } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PropertySummary } from "@/lib/services/property-summary";
import type { ChannelPropertyMetadata } from "@/features/messaging/types";

const BADGE_LABEL = "Inquired Property";

function toDisplaySqft(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  return v.toLowerCase().includes("sq") ? v : `${v} Sq Ft`;
}

function toDisplayBaths(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `${n}`;
}

function toDisplayBeds(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `${n}`;
}

function pickHeroImage(meta: ChannelPropertyMetadata, summary: PropertySummary | null): string | null {
  return (summary?.hero_image ?? "").trim() || (meta.property_image ?? "").trim() || null;
}

export function PropertyCard(props: {
  propertyId: string;
  channelMeta: ChannelPropertyMetadata;
  summary: PropertySummary | null;
  loading: boolean;
  className?: string;
}) {
  const removed = Boolean(props.summary?.listing_removed);
  const heroImage = pickHeroImage(props.channelMeta, props.summary);
  const name = (props.summary?.name ?? props.channelMeta.property_name ?? "").trim() || null;
  const address = (props.summary?.address ?? "").trim() || null;
  const price = (props.summary?.price ?? props.channelMeta.property_price ?? "").trim() || null;
  const beds = toDisplayBeds(props.summary?.beds);
  const baths = toDisplayBaths(props.summary?.baths);
  const sqft = toDisplaySqft(props.summary?.sqft);

  return (
    <div
      className={cn(
        "px-4 py-4",
        removed ? "pointer-events-none opacity-50" : null,
        props.className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center rounded-full border border-brand-sage/35 bg-brand-sage/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-fg">
          {BADGE_LABEL}
        </span>
        {props.loading ? <span className="text-xs font-semibold text-fg/35">Loading…</span> : null}
      </div>

      {removed ? (
        <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">Listing removed</p>
      ) : null}

      {heroImage ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-subtle bg-surface-panel">
          <div className={cn("relative aspect-[4/3] w-full", removed ? "opacity-90 grayscale" : null)}>
            <Image src={heroImage} alt="" fill className="object-cover" sizes="280px" unoptimized />
          </div>
        </div>
      ) : null}

      <div className="mt-3">
        <p className={cn("text-base font-bold leading-snug", removed ? "text-gray-400" : "text-fg")}>
          {name ?? "Property"}
        </p>
        {address ? (
          <p className={cn("mt-0.5 text-sm font-medium", removed ? "text-gray-400" : "text-fg/55")}>{address}</p>
        ) : null}
      </div>

      <ul className={cn("mt-4 space-y-2 text-sm font-semibold", removed ? "text-gray-400" : "text-fg/70")}>
        {price ? (
          <li className="flex items-center gap-2">
            <DollarSign className={cn("h-4 w-4", removed ? "text-gray-400" : "text-brand-sage")} aria-hidden />
            <span>{price}</span>
          </li>
        ) : null}
        {beds ? (
          <li className="flex items-center gap-2">
            <Bed className={cn("h-4 w-4", removed ? "text-gray-400" : "text-brand-sage")} aria-hidden />
            <span>{beds} Beds</span>
          </li>
        ) : null}
        {baths ? (
          <li className="flex items-center gap-2">
            <Bath className={cn("h-4 w-4", removed ? "text-gray-400" : "text-brand-sage")} aria-hidden />
            <span>{baths} Baths</span>
          </li>
        ) : null}
        {sqft ? (
          <li className="flex items-center gap-2">
            <Square className={cn("h-4 w-4", removed ? "text-gray-400" : "text-brand-sage")} aria-hidden />
            <span>{sqft}</span>
          </li>
        ) : null}
      </ul>

      <div className="mt-5">
        {removed ? (
          <span className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-bold text-gray-400">
            View Property Details
            <ExternalLink className="h-4 w-4" aria-hidden />
          </span>
        ) : (
          <Link
            href={`/properties/${encodeURIComponent(props.propertyId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-sage px-4 py-2 text-sm font-bold text-brand-sage hover:bg-brand-sage/10"
          >
            View Property Details
            <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}

