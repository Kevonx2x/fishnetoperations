"use client";

import Link from "next/link";
import { useCallback, useRef } from "react";
import { Bath, Bed, ChevronRight, Heart, Maximize2 } from "lucide-react";

import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import { usePinnedPropertyIds } from "@/hooks/use-property-engagement";
import { cn } from "@/lib/utils";

export type RecommendedPropertyCardModel = {
  id: string;
  name: string | null;
  city: string | null;
  price: string;
  status: "for_sale" | "for_rent" | "both" | "sold" | "rented";
  beds: number;
  baths: number;
  sqft: string;
  imageUrl: string | null;
};

function RecommendedSaveHeart(props: {
  propertyId: string;
  saved: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={props.saved ? "Remove from saved" : "Save property"}
      onClick={() => props.onToggle(props.propertyId)}
      className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-[#2C2C2C]/10 transition hover:bg-white"
    >
      <Heart
        className={cn("size-4", props.saved ? "fill-[#6B9E6E] text-[#6B9E6E]" : "text-[#2C2C2C]/35")}
        aria-hidden
      />
    </button>
  );
}

export function ClientDashboardRecommendedClient(props: { items: RecommendedPropertyCardModel[] }) {
  const { has, toggle } = usePinnedPropertyIds();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollBy = useCallback((dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 240, behavior: "smooth" });
  }, []);

  if (!props.items.length) return null;

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-[#2C2C2C]/[0.045] md:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold tracking-tight text-[#2C2C2C] md:text-xl">Recommended for you</h2>
        <Link href="/" className="shrink-0 text-sm font-semibold text-[#6B9E6E] hover:underline">
          See all
        </Link>
      </div>

      <div className="relative mt-3">
        <div
          ref={scrollerRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1.5 pr-11 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {props.items.map((p) => {
            const priceLabel = formatPropertyPriceDisplay(p.price, p.status);
            const cityLine = p.city?.trim() || "—";
            const href = `/properties/${p.id}`;
            return (
              <div
                key={p.id}
                className="w-[220px] min-w-[220px] snap-start overflow-hidden rounded-xl ring-1 ring-[#2C2C2C]/[0.045] transition-colors hover:bg-[#2C2C2C]/[0.02]"
              >
                <div className="relative h-28 w-full bg-[#2C2C2C]/[0.06] sm:h-32">
                  <Link href={href} className="absolute inset-0 z-0 block" aria-label={p.name?.trim() || "View property"}>
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- listing URLs may be arbitrary hosts
                      <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </Link>
                  <RecommendedSaveHeart
                    propertyId={p.id}
                    saved={has(p.id)}
                    onToggle={(id) => void toggle(id)}
                  />
                </div>
                <Link href={href} className="block p-2.5">
                  <p className="truncate text-sm font-medium text-[#2C2C2C]">{p.name?.trim() || "Property"}</p>
                  <p className="mt-0.5 truncate text-xs text-gray-600">{cityLine}</p>
                  <p className="mt-1.5 text-sm font-semibold text-[#D4A843]">{priceLabel}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <Bed className="size-3.5 shrink-0" aria-hidden />
                      {p.beds}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Bath className="size-3.5 shrink-0" aria-hidden />
                      {p.baths}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Maximize2 className="size-3.5 shrink-0" aria-hidden />
                      {p.sqft}
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Scroll recommendations right"
          onClick={() => scrollBy(1)}
          className="absolute right-0 top-1/2 z-[1] flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 shadow-sm transition hover:bg-[#FAF8F4]"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
    </section>
  );
}
