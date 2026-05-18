"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTopCondosSectionData, type TopCondoPlaceholder } from "@/lib/top-condos-placeholder-data";

function TopCondoPlaceholderCard({ condo }: { condo: TopCondoPlaceholder }) {
  const countLabel = `${condo.listingCount} ${condo.listingCount === 1 ? "Property" : "Properties"}`;

  return (
    <article
      role="presentation"
      aria-label={condo.name}
      className="flex w-[148px] shrink-0 cursor-default flex-col overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-md sm:w-[160px]"
    >
      <div className="relative flex h-[100px] items-center justify-center bg-[#FAF8F4] p-3 sm:h-[110px]">
        <div className="relative h-16 w-full max-w-[120px] overflow-hidden rounded-xl bg-white ring-1 ring-black/5 sm:h-[72px] sm:max-w-[132px]">
          <Image
            src={condo.imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="160px"
            unoptimized
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-3 py-3 text-center">
        <p className="line-clamp-2 text-sm font-bold leading-snug text-[#2C2C2C]">{condo.name}</p>
        <p className="mt-1 text-xs font-semibold text-[#6B9E6E]">{countLabel}</p>
      </div>
    </article>
  );
}

export function TopCondosRow({ locationLabel }: { locationLabel: string | null }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const section = useMemo(() => getTopCondosSectionData(locationLabel), [locationLabel]);

  const scroll = useCallback((dir: "prev" | "next") => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(280, Math.round(el.clientWidth * 0.85));
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  }, []);

  return (
    <section className="mt-6 lg:mt-10" aria-labelledby="top-condos-heading">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="top-condos-heading"
            className="font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] sm:text-3xl"
          >
            {section.title}
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">{section.subtitle}</p>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/40">
          Coming soon
        </p>
      </div>

      <div className="-mx-2 mt-4 flex items-stretch gap-1 sm:mt-5 md:gap-2">
        <button
          type="button"
          onClick={() => scroll("prev")}
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4 text-[#2C2C2C]" strokeWidth={2.25} aria-hidden />
        </button>
        <div
          ref={scrollRef}
          className="min-w-0 flex-1 overflow-x-auto px-1 pb-2 scrollbar-hide"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex w-max flex-nowrap gap-3 sm:gap-4">
            {section.condos.map((condo) => (
              <TopCondoPlaceholderCard key={condo.id} condo={condo} />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => scroll("next")}
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4 text-[#2C2C2C]" strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    </section>
  );
}
