import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bath,
  Bed,
  DollarSign,
  ExternalLink,
  Square,
} from "lucide-react";
import type { Channel as StreamChannel } from "stream-chat";
import { cn } from "@/lib/utils";
import { fetchPropertySummary, type PropertySummary } from "@/lib/services/property-summary";

const BADGE_LABEL = "Inquired Property";
const EMPTY_STATE = "No property linked to this conversation";

type ChannelPropertyMetadata = {
  property_id?: string | null;
  property_name?: string | null;
  property_price?: string | null;
  property_image?: string | null;
};

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
  return (
    (summary?.hero_image ?? "").trim() ||
    (meta.property_image ?? "").trim() ||
    null
  );
}

/**
 * Desktop-only sidebar panel that shows the property context for the active conversation.
 * It reads quick metadata from the Stream channel, and (optionally) fetches a minimal property summary.
 */
export function ConversationContextPanel(props: {
  channel: StreamChannel | undefined;
  className?: string;
}) {
  const channelData = props.channel?.data as ChannelPropertyMetadata | undefined;
  const propertyId = (channelData?.property_id ?? "").trim() || null;

  const [cache, setCache] = useState<Record<string, PropertySummary>>({});
  const summary = propertyId ? cache[propertyId] ?? null : null;
  const [loading, setLoading] = useState(false);
  const hasCached = Boolean(propertyId && cache[propertyId]);

  useEffect(() => {
    if (!propertyId) return;
    if (hasCached) return;
    const ac = new AbortController();
    setLoading(true);
    void (async () => {
      const res = await fetchPropertySummary(propertyId, { signal: ac.signal });
      if (ac.signal.aborted) return;
      if (res.ok) {
        setCache((prev) => ({ ...prev, [propertyId]: res.data }));
      }
      setLoading(false);
    })();
    return () => ac.abort();
  }, [hasCached, propertyId]);

  const heroImage = useMemo(() => pickHeroImage(channelData ?? {}, summary), [channelData, summary]);
  const name = (summary?.name ?? channelData?.property_name ?? "").trim() || null;
  const address = (summary?.address ?? "").trim() || null;
  const price = (summary?.price ?? channelData?.property_price ?? "").trim() || null;

  const beds = toDisplayBeds(summary?.beds);
  const baths = toDisplayBaths(summary?.baths);
  const sqft = toDisplaySqft(summary?.sqft);

  if (!props.channel || !propertyId) {
    return (
      <div className={cn("px-4 py-4", props.className)}>
        <p className="text-sm font-semibold text-fg/45">{EMPTY_STATE}</p>
      </div>
    );
  }

  return (
    <div className={cn("px-4 py-4", props.className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center rounded-full border border-brand-sage/35 bg-brand-sage/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-fg">
          {BADGE_LABEL}
        </span>
        {loading ? <span className="text-xs font-semibold text-fg/35">Loading…</span> : null}
      </div>

      {heroImage ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-subtle bg-surface-panel">
          <div className="relative aspect-[4/3] w-full">
            <Image src={heroImage} alt="" fill className="object-cover" sizes="280px" unoptimized />
          </div>
        </div>
      ) : null}

      <div className="mt-3">
        <p className="text-base font-bold leading-snug text-fg">{name ?? "Property"}</p>
        {address ? (
          <p className="mt-0.5 text-sm font-medium text-fg/55">{address}</p>
        ) : null}
      </div>

      <ul className="mt-4 space-y-2 text-sm font-semibold text-fg/70">
        {price ? (
          <li className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-brand-sage" aria-hidden />
            <span>{price}</span>
          </li>
        ) : null}
        {beds ? (
          <li className="flex items-center gap-2">
            <Bed className="h-4 w-4 text-brand-sage" aria-hidden />
            <span>{beds} Beds</span>
          </li>
        ) : null}
        {baths ? (
          <li className="flex items-center gap-2">
            <Bath className="h-4 w-4 text-brand-sage" aria-hidden />
            <span>{baths} Baths</span>
          </li>
        ) : null}
        {sqft ? (
          <li className="flex items-center gap-2">
            <Square className="h-4 w-4 text-brand-sage" aria-hidden />
            <span>{sqft}</span>
          </li>
        ) : null}
      </ul>

      <div className="mt-5">
        <Link
          href={`/properties/${encodeURIComponent(propertyId)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-sage px-4 py-2 text-sm font-bold text-brand-sage hover:bg-brand-sage/10"
        >
          View Property Details
          <ExternalLink className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

