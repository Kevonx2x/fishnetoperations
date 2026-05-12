import Image from "next/image";
import Link from "next/link";
import { Bed, Droplets, ExternalLink, Ruler } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import type { PropertySummary } from "@/lib/services/property-summary";
import type { ChannelPropertyMetadata } from "@/features/messaging/types";

const BADGE_LABEL = "INQUIRED PROPERTY";

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

function priceFormatStatus(summary: PropertySummary | null): "for_sale" | "for_rent" | undefined {
  if (!summary) return undefined;
  const lt = (summary.listing_type ?? "").trim().toLowerCase();
  const st = (summary.listing_status ?? "").trim().toLowerCase();
  if (lt === "rent" || st === "for_rent") return "for_rent";
  if (lt === "sale" || st === "for_sale") return "for_sale";
  return undefined;
}

function pickRawPriceString(summary: PropertySummary | null, channelPrice: string): string {
  const ch = channelPrice.trim().replace(/^\$/u, "").trim();
  if (!summary) return ch;
  const lt = (summary.listing_type ?? "").trim().toLowerCase();
  const st = (summary.listing_status ?? "").trim().toLowerCase();
  const isRent = lt === "rent" || st === "for_rent";
  const primary = (isRent ? summary.rent_price : summary.price) ?? "";
  const secondary = (isRent ? summary.price : summary.rent_price) ?? "";
  const raw = (primary || secondary).trim();
  return raw || ch;
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
  const channelPriceRaw = (props.channelMeta.property_price ?? "").trim().replace(/^\$/u, "").trim();

  const formattedPrice = useMemo(() => {
    const raw = pickRawPriceString(props.summary, channelPriceRaw);
    if (!raw) return null;
    return formatPropertyPriceDisplay(raw, priceFormatStatus(props.summary));
  }, [props.summary, channelPriceRaw]);

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
        <span className="inline-flex items-center rounded-full border border-brand-sage/30 bg-brand-sage/[0.08] px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-brand-sage">
          {BADGE_LABEL}
        </span>
        {props.loading ? <span className="text-xs font-semibold text-fg/35">Loading…</span> : null}
      </div>

      {removed ? (
        <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">Listing removed</p>
      ) : null}

      {heroImage ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-subtle bg-surface-panel">
          <div className={cn("relative aspect-[4/3] w-full", removed ? "opacity-90 grayscale" : null)}>
            <Image src={heroImage} alt="" fill className="object-cover" sizes="280px" unoptimized />
          </div>
        </div>
      ) : null}

      <div className="mt-3">
        <p
          className={cn(
            "font-serif text-base font-semibold leading-snug text-[#2C2C2C]",
            removed ? "text-gray-400" : null,
          )}
        >
          {name ?? "Property"}
        </p>
        {address ? (
          <p className={cn("mt-0.5 text-sm font-medium", removed ? "text-gray-400" : "text-fg/55")}>{address}</p>
        ) : null}
      </div>

      <ul className={cn("mt-4 space-y-2.5 text-sm", removed ? "text-gray-400" : "text-fg")}>
        {formattedPrice ? (
          <li className="flex items-center justify-between gap-3">
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center text-[11px] font-bold leading-none text-brand-sage",
                removed ? "text-gray-400" : null,
              )}
              aria-hidden
            >
              ₱
            </span>
            <span className={cn("text-right font-semibold tabular-nums", removed ? "text-gray-400" : "text-fg")}>
              {formattedPrice}
            </span>
          </li>
        ) : null}
        {beds ? (
          <li className="flex items-center justify-between gap-3">
            <Bed className={cn("h-4 w-4 shrink-0 text-brand-sage", removed ? "text-gray-400" : null)} aria-hidden />
            <span className={cn("text-right font-semibold tabular-nums", removed ? "text-gray-400" : "text-fg/80")}>
              {beds} Beds
            </span>
          </li>
        ) : null}
        {baths ? (
          <li className="flex items-center justify-between gap-3">
            <Droplets
              className={cn("h-4 w-4 shrink-0 text-brand-sage", removed ? "text-gray-400" : null)}
              aria-hidden
            />
            <span className={cn("text-right font-semibold tabular-nums", removed ? "text-gray-400" : "text-fg/80")}>
              {baths} Baths
            </span>
          </li>
        ) : null}
        {sqft ? (
          <li className="flex items-center justify-between gap-3">
            <Ruler className={cn("h-4 w-4 shrink-0 text-brand-sage", removed ? "text-gray-400" : null)} aria-hidden />
            <span className={cn("text-right font-semibold tabular-nums", removed ? "text-gray-400" : "text-fg/80")}>
              {sqft}
            </span>
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
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}
