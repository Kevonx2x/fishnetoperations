"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTopCondosSectionData, type TopCondoPlaceholder } from "@/lib/top-condos-placeholder-data";

const CARD_CLASS = "w-[168px] shrink-0 sm:w-[180px]";

function TopCondoCard({ condo }: { condo: TopCondoPlaceholder }) {
  const countLabel = `${condo.listingCount} ${condo.listingCount === 1 ? "Property" : "Properties"}`;

  return (
    <article
      role="presentation"
      aria-label={condo.name}
      className={`flex h-full ${CARD_CLASS} cursor-default flex-col overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-md transition hover:shadow-lg`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#2C2C2C]/5">
        <Image
          src={condo.imageUrl}
          alt=""
          fill
          className="object-cover"
          sizes="180px"
          unoptimized
        />
        <span className="absolute left-2.5 top-2.5 rounded-md bg-[#1F3B2C] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          {condo.areaLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
        <h3 className="line-clamp-2 min-h-[2.75rem] text-sm font-semibold leading-snug text-[#2C2C2C]">
          {condo.name}
        </h3>
        <p className="mt-auto pt-2 text-center text-sm font-semibold leading-none text-[#6B9E6E]">
          {countLabel}
        </p>
      </div>
    </article>
  );
}

type TopCondosRowProps = {
  locationLabel: string | null;
};

export function TopCondosRow({ locationLabel }: TopCondosRowProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const section = useMemo(() => getTopCondosSectionData(locationLabel), [locationLabel]);

  const scroll = useCallback((dir: "prev" | "next") => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(280, Math.round(el.clientWidth * 0.8));
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  }, []);

  return (
    <section className="mt-6 lg:mt-10" aria-labelledby="top-condos-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="top-condos-heading"
            className="font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] sm:text-3xl"
          >
            {section.title}
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">{section.subtitle}</p>
        </div>
        <span className="mt-1 shrink-0 rounded-full bg-[#D4A843]/18 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a6d32]">
          Coming soon
        </span>
      </div>

      <div className="-mx-4 mt-4 flex items-stretch gap-1 md:gap-2 lg:mt-5">
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
          <div className="flex w-max flex-nowrap items-stretch gap-3">
            {section.condos.map((condo) => (
              <TopCondoCard key={condo.id} condo={condo} />
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
