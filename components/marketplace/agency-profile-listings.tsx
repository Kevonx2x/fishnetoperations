"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NewlyListedCard } from "@/components/marketplace/fishnet-home-marketplace";
import type { DbProperty } from "@/lib/marketplace-property";
import { roomUrlsFor } from "@/lib/marketplace-property";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";
import { useAuth } from "@/contexts/auth-context";
import { usePropertyEngagementForProperties } from "@/hooks/use-property-engagement";

const CARD_WIDTH = "w-[220px] shrink-0 sm:w-[232px] lg:w-[240px]";

type AgencyProfileListingsProps = {
  properties: DbProperty[];
  loading?: boolean;
  totalCount?: number;
};

function scrollRow(ref: React.RefObject<HTMLDivElement | null>, dir: "prev" | "next") {
  const el = ref.current;
  if (!el) return;
  const step = Math.max(300, Math.round(el.clientWidth * 0.75));
  el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
}

export function AgencyProfileListings({
  properties,
  loading = false,
  totalCount,
}: AgencyProfileListingsProps) {
  const { user } = useAuth();
  const rowRef = useRef<HTMLDivElement>(null);
  const [cardRoomIdx, setCardRoomIdx] = useState<Record<string, number>>({});

  const { engagement } = usePropertyEngagementForProperties(properties);

  const connectedAgentsByPropertyId = useMemo(() => {
    const map = new Map<string, MarketplaceAgent[]>();
    for (const p of properties) {
      const pas = (p as { property_agents?: { agent?: unknown }[] }).property_agents ?? [];
      const agentsList = pas
        .map((pa) => pa.agent)
        .filter(Boolean)
        .map((row) => mapRowToMarketplaceAgent(row as Parameters<typeof mapRowToMarketplaceAgent>[0]));
      map.set(p.id, agentsList);
    }
    return map;
  }, [properties]);

  const countLabel =
    totalCount !== undefined && totalCount > properties.length
      ? `View all ${totalCount} listings`
      : "View all listings";

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-bold text-[#2C2C2C]">Active Listings</h2>
        {properties.length > 0 ? (
          <Link href="/" className="text-sm font-semibold text-[#6B9E6E] hover:text-[#5f7a62]">
            {countLabel} →
          </Link>
        ) : (
          <span className="text-sm font-semibold text-[#2C2C2C]/40">{countLabel} →</span>
        )}
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${CARD_WIDTH} h-[412px] animate-pulse rounded-2xl bg-black/5`} />
          ))}
        </div>
      ) : null}

      {!loading && properties.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#2C2C2C]/12 bg-white/80 px-6 py-10 text-center text-sm font-semibold text-[#2C2C2C]/55">
          This agency has no public listings yet. Check back soon or browse all properties on BahayGo.
        </p>
      ) : null}

      {!loading && properties.length > 0 ? (
        <div className="-mx-4 flex items-stretch gap-1 md:gap-2">
          <button
            type="button"
            onClick={() => scrollRow(rowRef, "prev")}
            className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex"
            aria-label="Scroll listings left"
          >
            <ChevronLeft className="h-4 w-4 text-[#2C2C2C]" />
          </button>
          <div
            ref={rowRef}
            className="min-w-0 flex-1 overflow-x-auto px-1 pb-2 scrollbar-hide"
          >
            <div className="flex w-max flex-nowrap gap-3">
              {properties.map((p, index) => (
                <NewlyListedCard
                  key={p.id}
                  property={p}
                  roomUrls={roomUrlsFor(p)}
                  roomIdx={cardRoomIdx[p.id] ?? 0}
                  onRoomPrev={() =>
                    setCardRoomIdx((s) => ({
                      ...s,
                      [p.id]:
                        (roomUrlsFor(p).length + (s[p.id] ?? 0) - 1) %
                        Math.max(1, roomUrlsFor(p).length),
                    }))
                  }
                  onRoomNext={() =>
                    setCardRoomIdx((s) => ({
                      ...s,
                      [p.id]: ((s[p.id] ?? 0) + 1) % Math.max(1, roomUrlsFor(p).length),
                    }))
                  }
                  engagement={engagement}
                  connectedAgents={connectedAgentsByPropertyId.get(p.id) ?? []}
                  grid
                  gridCardClassName={CARD_WIDTH}
                  viewerUserId={user?.id ?? null}
                  listingImageLoadEager={index < 2}
                  listingImagePriority={index === 0}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => scrollRow(rowRef, "next")}
            className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex"
            aria-label="Scroll listings right"
          >
            <ChevronRight className="h-4 w-4 text-[#2C2C2C]" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
