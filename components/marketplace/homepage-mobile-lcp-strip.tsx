import Link from "next/link";

import { BahayGoWordmark } from "@/components/marketplace/bahaygo-wordmark";
import { HomepageMobilePeekRowSkeleton } from "@/components/marketplace/homepage-load-shell";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import { buildListingBedsBathsAreaLine } from "@/lib/format-property-floor-area";
import {
  HOMEPAGE_MOBILE_CAROUSEL_INSET,
  HOMEPAGE_MOBILE_TRENDING_CARD_WIDTH,
} from "@/lib/homepage-listing-card-layout";
import {
  pickMobileHomepageTrendingLead,
  resolveMobileHomepageLcpImageUrl,
} from "@/lib/homepage-mobile-lcp";
import type { HomepagePropertiesResult } from "@/lib/marketplace-home-fetchers";
import {
  MOBILE_FIXED_SEARCH_CHROME,
  MOBILE_PORTAL_TOP_NAV_COMPACT_OFFSET,
} from "@/lib/bahaygo-mobile/sticky-mobile-search-chrome";
import { cn } from "@/lib/utils";

function propertyLocationLine(property: {
  city?: string | null;
  neighborhood?: string | null;
  location?: string | null;
}): string {
  const city = property.city?.trim() || property.neighborhood?.trim();
  const loc = property.location?.trim();
  if (city && loc) return `${city} · ${loc}`;
  return city || loc || "Metro Manila";
}

/** Static mobile shell + first trending slide for LCP — no client JS. */
export function HomepageMobileLcpStrip({
  data,
  listingMode = "rent",
}: {
  data: HomepagePropertiesResult;
  listingMode?: "buy" | "rent" | "all";
}) {
  const lead = pickMobileHomepageTrendingLead(data);
  const heroSrc = resolveMobileHomepageLcpImageUrl(data);
  if (!lead || !heroSrc) return null;

  const href = `/properties/${encodeURIComponent(lead.id)}`;
  const priceLabel =
    listingMode === "rent" || lead.listing_type === "rent"
      ? formatPropertyPriceDisplay(lead.rent_price, "for_rent")
      : formatPropertyPriceDisplay(lead.price, lead.status);

  return (
    <div className="min-h-screen bg-[#FAF8F4] md:hidden">
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#FAF8F4]/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm supports-[backdrop-filter]:bg-[#FAF8F4]/90">
        <div className="flex items-center justify-between px-4 py-2.5">
          <Link href="/" aria-label="BahayGo home">
            <BahayGoWordmark />
          </Link>
          <div className="flex items-center gap-2" aria-hidden>
            <div className="size-9 rounded-full bg-[#2C2C2C]/6" />
            <div className="size-9 rounded-full bg-[#2C2C2C]/6" />
          </div>
        </div>
      </header>

      <div className={cn(MOBILE_FIXED_SEARCH_CHROME, MOBILE_PORTAL_TOP_NAV_COMPACT_OFFSET)}>
        <div className="space-y-1.5 px-4 py-1.5">
          <div className="flex h-11 items-center gap-2 rounded-xl border border-[#2C2C2C]/8 bg-white px-2.5 shadow-[0_6px_20px_rgba(44,44,44,0.08)]">
            <div className="size-4 shrink-0 rounded bg-[#2C2C2C]/10" aria-hidden />
            <div className="h-3 flex-1 rounded bg-[#2C2C2C]/8" aria-hidden />
          </div>
        </div>
      </div>

      <div className="overflow-x-clip pb-2">
        <div className="space-y-2 px-4 pt-1" aria-hidden>
          <div className="flex justify-center gap-2">
            <div className="h-9 w-[7.25rem] animate-pulse rounded-full bg-[#2C2C2C]/8" />
            <div className="h-9 w-[7.25rem] animate-pulse rounded-full bg-[#2C2C2C]/8" />
          </div>
          <div className="flex gap-1.5 pt-0.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`qc-ssr-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div className="size-[52px] rounded-2xl bg-[#2C2C2C]/8" />
                <div className="h-2 w-10 animate-pulse rounded bg-[#2C2C2C]/8" />
              </div>
            ))}
          </div>
        </div>

        <section className="mt-2">
          <div className="flex items-baseline justify-between px-4">
            <h2 className="font-serif text-[18px] font-semibold leading-tight text-[#2C2C2C]">
              Trending Near You <span aria-hidden>🔥</span>
            </h2>
          </div>
          <div
            className={cn(
              "mt-2 flex gap-2.5 overflow-x-hidden pb-0.5",
              HOMEPAGE_MOBILE_CAROUSEL_INSET,
            )}
          >
            <Link
              href={href}
              className={cn(
                HOMEPAGE_MOBILE_TRENDING_CARD_WIDTH,
                "relative block shrink-0 snap-start overflow-hidden rounded-2xl shadow-[0_12px_36px_rgba(44,44,44,0.16)] ring-1 ring-black/[0.06]",
              )}
            >
              <div className="relative aspect-[5/3] w-full bg-[#1a1a1a]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroSrc}
                  alt=""
                  fetchPriority="high"
                  loading="eager"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                  sizes="88vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a]/95 via-[#1a1a1a]/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="line-clamp-2 font-serif text-[15px] font-semibold leading-snug text-white">
                    {lead.name?.trim() || lead.location}
                  </h3>
                  <p className="mt-0.5 text-sm font-bold text-white">{priceLabel}</p>
                  <p className="mt-0.5 line-clamp-1 text-[10px] font-medium text-white/85">
                    {buildListingBedsBathsAreaLine({
                      beds: lead.beds,
                      baths: lead.baths,
                      sqft: lead.sqft,
                    })}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium text-white/75">
                    {propertyLocationLine(lead)}
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </section>

        <HomepageMobilePeekRowSkeleton />
      </div>
    </div>
  );
}
