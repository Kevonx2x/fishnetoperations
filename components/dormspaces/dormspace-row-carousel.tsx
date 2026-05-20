"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";

import { DormspaceCard } from "@/components/dormspaces/dormspace-card";
import { DormspaceComingSoonCard } from "@/components/dormspaces/dormspace-coming-soon-card";
import { DORMSPACE_ROW_MIN_CARDS } from "@/lib/dormspace-browse-rows";
import type { DormspaceWithPhotos } from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

const CARD_WIDTH = "w-[260px] shrink-0 sm:w-[272px] lg:w-[280px]";

export function DormspaceRowCarousel({
  rowKey,
  title,
  subtitle,
  items,
  featured,
  titleHref,
}: {
  rowKey: string;
  title: string;
  subtitle: string;
  items: DormspaceWithPhotos[];
  featured?: boolean;
  titleHref?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const list = items.slice(0, 12);
  const fillerCount =
    list.length === 0 ? DORMSPACE_ROW_MIN_CARDS : list.length < DORMSPACE_ROW_MIN_CARDS ? DORMSPACE_ROW_MIN_CARDS - list.length : 0;

  const scroll = (dir: "prev" | "next") => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(280, Math.round(el.clientWidth * 0.85));
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  };

  const featuredClasses = featured ? "rounded-2xl border border-[#D4A843]/30 bg-[#D4A843]/5 px-3 pt-3 pb-1" : "";

  const track = (
    <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto px-1 pb-2 scrollbar-hide">
      <div className="flex w-max flex-nowrap gap-3">
        {list.map((listing) => (
          <div key={`${rowKey}-${listing.id}`} className={CARD_WIDTH}>
            <DormspaceCard listing={listing} />
          </div>
        ))}
        {Array.from({ length: fillerCount }).map((_, i) => (
          <DormspaceComingSoonCard key={`ph-${rowKey}-${i}`} cardWidthClass={CARD_WIDTH} />
        ))}
      </div>
    </div>
  );

  return (
    <section className={cn(featuredClasses)}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {featured ? <Star className="h-4 w-4 shrink-0 text-[#D4A843]" aria-hidden /> : null}
            {titleHref ? (
              <Link
                href={titleHref}
                className="font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] hover:underline sm:text-3xl"
              >
                {title}
              </Link>
            ) : (
              <h2 className="font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] sm:text-3xl">{title}</h2>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-[#484848]">{subtitle}</p>
        </div>
        <div className="hidden shrink-0 gap-1 sm:flex">
          <button
            type="button"
            onClick={() => scroll("prev")}
            className="rounded-full bg-white p-2 shadow-md ring-1 ring-black/5 hover:bg-[#FAF8F4]"
            aria-label={`Scroll ${title} left`}
          >
            <ChevronLeft className="h-5 w-5 text-[#2C2C2C]" />
          </button>
          <button
            type="button"
            onClick={() => scroll("next")}
            className="rounded-full bg-white p-2 shadow-md ring-1 ring-black/5 hover:bg-[#FAF8F4]"
            aria-label={`Scroll ${title} right`}
          >
            <ChevronRight className="h-5 w-5 text-[#2C2C2C]" />
          </button>
        </div>
      </div>

      <div className="relative -mx-1">{track}</div>
    </section>
  );
}
